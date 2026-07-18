import logging
import json
import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt
from collections import defaultdict, deque

from db import init_db, insert_sensor_event

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("presence_ai_backend")

from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    try:
        mqtt_client.connect(MQTT_HOST, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        logger.error(f"Failed to connect to MQTT: {e}")
    
    yield
    
    # Shutdown
    mqtt_client.loop_stop()
    mqtt_client.disconnect()

app = FastAPI(title="Presence Sensor Filter AI Backend", lifespan=lifespan)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration from HA Add-on options or environment variables
MQTT_HOST = os.environ.get("MQTT_HOST", "core-mosquitto")
MQTT_PORT = int(os.environ.get("MQTT_PORT", 1883))
MQTT_USER = os.environ.get("MQTT_USER", "mqtt")
MQTT_PASS = os.environ.get("MQTT_PASS", "")
MQTT_BASE_TOPIC = os.environ.get("MQTT_BASE_TOPIC", "zigbee2mqtt")
MQTT_DISCOVERY_PREFIX = os.environ.get("MQTT_DISCOVERY_PREFIX", "homeassistant")

if os.path.exists("/data/options.json"):
    try:
        with open("/data/options.json") as f:
            options = json.load(f)
            MQTT_HOST = options.get("mqtt_server", MQTT_HOST)
            MQTT_PORT = int(options.get("mqtt_port", MQTT_PORT))
            MQTT_USER = options.get("mqtt_user", MQTT_USER)
            MQTT_PASS = options.get("mqtt_password", MQTT_PASS)
            MQTT_BASE_TOPIC = options.get("mqtt_base_topic", MQTT_BASE_TOPIC)
            MQTT_DISCOVERY_PREFIX = options.get("mqtt_discovery_prefix", MQTT_DISCOVERY_PREFIX)
    except Exception as e:
        logger.error(f"Failed to read options.json: {e}")

mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

# State management
connected_websockets = []
sensor_buffers = defaultdict(lambda: deque(maxlen=100))

async def broadcast_websocket(message: dict):
    for connection in connected_websockets:
        try:
            await connection.send_json(message)
        except Exception:
            pass

def publish_discovery(sensor_id: str):
    """Publish Home Assistant MQTT Discovery payload for the filtered sensor."""
    discovery_topic = f"{MQTT_DISCOVERY_PREFIX}/binary_sensor/presence_ai_{sensor_id}/config"
    state_topic = f"presence_ai/sensor/{sensor_id}/state"
    
    payload = {
        "name": f"AI Filtered {sensor_id.replace('_', ' ').title()}",
        "unique_id": f"presence_ai_{sensor_id}",
        "state_topic": state_topic,
        "device_class": "motion",
        "payload_on": "ON",
        "payload_off": "OFF",
        "device": {
            "identifiers": [f"presence_ai_{sensor_id}"],
            "name": "Presence AI Hub",
            "manufacturer": "Custom AI"
        }
    }
    mqtt_client.publish(discovery_topic, json.dumps(payload), retain=True)

def on_connect(client, userdata, flags, reason_code, properties):
    logger.info(f"Connected to MQTT broker with result code {reason_code}")
    client.subscribe(f"{MQTT_BASE_TOPIC}/+")

def on_message(client, userdata, msg):
    try:
        topic_parts = msg.topic.split("/")
        if len(topic_parts) != 2:
            return
            
        sensor_id = topic_parts[1]
        payload = json.loads(msg.payload.decode())
        
        if "target_distance" in payload or "presence" in payload:
            distance = payload.get("target_distance", 0.0)
            presence = payload.get("presence", False)
            
            # Data Ingestion
            insert_sensor_event(sensor_id, distance, presence, payload)
            
            # Add to memory buffer for ML / Heuristics
            sensor_buffers[sensor_id].append(distance)
            
            # TODO: Run ML inference here on sensor_buffers[sensor_id]
            is_valid_human = presence # Placeholder
            
            state_topic = f"presence_ai/sensor/{sensor_id}/state"
            client.publish(state_topic, "ON" if is_valid_human else "OFF")
            
            # Broadcast to UI
            asyncio.run_coroutine_threadsafe(
                broadcast_websocket({
                    "type": "radar_update",
                    "sensor_id": sensor_id,
                    "distance": distance,
                    "presence": presence,
                    "ai_filtered_presence": is_valid_human
                }),
                asyncio.get_event_loop()
            )
            
    except Exception as e:
        logger.error(f"Error processing MQTT message: {e}")

mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

if MQTT_USER and MQTT_PASS:
    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_websockets.append(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        connected_websockets.remove(websocket)

@app.post("/api/calibrate/{sensor_id}")
async def start_calibration(sensor_id: str):
    # This triggers the "Walk-to-Calibrate" mode
    return {"status": "calibration_started", "sensor_id": sensor_id}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
