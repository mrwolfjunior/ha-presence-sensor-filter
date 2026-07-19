import logging
import json
import os
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import paho.mqtt.client as mqtt
from collections import defaultdict, deque

from db import (
    init_db, insert_sensor_event, upsert_sensor, is_sensor_enabled, 
    get_all_sensors, set_sensor_enabled, update_sensor_config,
    get_floors, upsert_floor, delete_floor,
    get_rooms, upsert_room, delete_room,
    get_doors_windows, upsert_door_window, delete_door_window
)
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Optional
logger = logging.getLogger("presence_ai_backend")

from contextlib import asynccontextmanager

main_loop = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    global main_loop
    main_loop = asyncio.get_running_loop()
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
    client.subscribe(f"{MQTT_BASE_TOPIC}/bridge/devices")

def on_message(client, userdata, msg):
    try:
        topic_parts = msg.topic.split("/")
        if len(topic_parts) != 2 and not msg.topic.endswith("bridge/devices"):
            return
            
        payload = json.loads(msg.payload.decode())
        
        # Handle bridge devices to prepopulate sensor list
        if msg.topic.endswith("bridge/devices"):
            if isinstance(payload, list):
                for device in payload:
                    if not device.get("friendly_name") or device["friendly_name"] == "Coordinator":
                        continue
                    
                    is_presence_or_magnetic = False
                    if "exposes" in device.get("definition", {}):
                        # Prepopulate everything that could be a sensor to allow user selection
                        for expose in device["definition"]["exposes"]:
                            if expose.get("property") in ["presence", "occupancy", "contact"]:
                                is_presence_or_magnetic = True
                                break
                    if is_presence_or_magnetic:
                        upsert_sensor(device["friendly_name"], is_enabled=False)
            return

        sensor_id = topic_parts[1]
        
        # Support multiple keys: 'occupancy' vs 'presence', 'distance' vs 'target_distance'
        has_presence = "presence" in payload or "occupancy" in payload
        has_distance = "target_distance" in payload or "distance" in payload
        
        if has_presence or has_distance:
            distance = payload.get("target_distance", payload.get("distance", 0.0))
            presence = payload.get("presence", payload.get("occupancy", False))
            
            # Register sensor if new, do not overwrite settings
            upsert_sensor(sensor_id, is_enabled=False)
            
            # Broadcast raw data for the settings UI, regardless of enabled status
            if main_loop and main_loop.is_running():
                asyncio.run_coroutine_threadsafe(
                    broadcast_websocket({
                        "type": "radar_update",
                        "sensor_id": sensor_id,
                        "distance": distance,
                        "presence": presence,
                        "ai_filtered_presence": presence # Raw for now
                    }),
                    main_loop
                )
            
            # Only process ML and broadcast HA Discovery if enabled
            if not is_sensor_enabled(sensor_id):
                return
            
            # Data Ingestion
            insert_sensor_event(sensor_id, distance, presence, payload)
            
            # Add to memory buffer for ML / Heuristics
            sensor_buffers[sensor_id].append(distance)
            
            # TODO: Run ML inference here on sensor_buffers[sensor_id]
            is_valid_human = presence # Placeholder
            
            state_topic = f"presence_ai/sensor/{sensor_id}/state"
            client.publish(state_topic, "ON" if is_valid_human else "OFF")
            
            # Publish Discovery for enabled sensors
            publish_discovery(sensor_id)
            
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

@app.get("/api/sensors")
async def get_sensors_list():
    return get_all_sensors()

class SensorConfig(BaseModel):
    is_enabled: Optional[bool] = None
    room_id: Optional[str] = None
    x: Optional[float] = None
    y: Optional[float] = None
    fov_angle: Optional[float] = None
    heading_angle: Optional[float] = None
    max_distance: Optional[float] = None

@app.post("/api/sensors/{sensor_id}")
async def update_sensor(sensor_id: str, config: SensorConfig):
    if config.is_enabled is not None:
        set_sensor_enabled(sensor_id, config.is_enabled)
    update_sensor_config(
        sensor_id, config.room_id, config.x, config.y, 
        config.fov_angle, config.heading_angle, config.max_distance
    )
    return {"status": "success"}

# ---- Floors API ----
class FloorConfig(BaseModel):
    id: str
    name: str
    level: int

@app.get("/api/floors")
async def api_get_floors():
    return get_floors()

@app.post("/api/floors")
async def api_upsert_floor(floor: FloorConfig):
    upsert_floor(floor.id, floor.name, floor.level)
    return {"status": "success"}

@app.delete("/api/floors/{floor_id}")
async def api_delete_floor(floor_id: str):
    delete_floor(floor_id)
    return {"status": "success"}

# ---- Rooms API ----
class RoomConfig(BaseModel):
    id: str
    name: str
    floor_id: str
    ha_area_id: str = ""
    width: float = 4.0
    height: float = 4.0
    x: float = 0.0
    y: float = 0.0

@app.get("/api/rooms")
async def api_get_rooms(floor_id: Optional[str] = None):
    return get_rooms(floor_id)

@app.post("/api/rooms")
async def api_upsert_room(room: RoomConfig):
    upsert_room(room.id, room.name, room.floor_id, room.ha_area_id, room.width, room.height, room.x, room.y)
    return {"status": "success"}

@app.delete("/api/rooms/{room_id}")
async def api_delete_room(room_id: str):
    delete_room(room_id)
    return {"status": "success"}

# ---- Doors / Windows API ----
class DoorWindowConfig(BaseModel):
    id: str
    name: str
    room_id: str
    type: str
    x: float = 0.0
    y: float = 0.0
    width: float = 1.0
    is_magnetic: bool = False
    sensor_id: str = ""

@app.get("/api/doors")
async def api_get_doors():
    return get_doors_windows()

@app.post("/api/doors")
async def api_upsert_door(item: DoorWindowConfig):
    upsert_door_window(item.id, item.name, item.room_id, item.type, item.x, item.y, item.width, item.is_magnetic, item.sensor_id)
    return {"status": "success"}

@app.delete("/api/doors/{item_id}")
async def api_delete_door(item_id: str):
    delete_door_window(item_id)
    return {"status": "success"}

import websockets

@app.post("/api/sync_ha")
async def sync_ha_topology():
    token = os.environ.get("SUPERVISOR_TOKEN")
    if not token:
        return {"status": "error", "message": "SUPERVISOR_TOKEN non trovato. Sei sicuro di essere in un Add-on?"}
        
    try:
        async with websockets.connect("ws://supervisor/core/websocket") as ws:
            # 1. Attendi auth_required
            msg1 = json.loads(await ws.recv())
            if msg1.get("type") != "auth_required":
                return {"status": "error", "message": "Auth non richiesta o errore"}
                
            # 2. Invia auth
            await ws.send(json.dumps({"type": "auth", "access_token": token}))
            msg2 = json.loads(await ws.recv())
            if msg2.get("type") != "auth_ok":
                return {"status": "error", "message": f"Auth fallita: {msg2}"}
                
            # 3. Richiedi Floors
            await ws.send(json.dumps({"id": 1, "type": "config/floor_registry/list"}))
            msg_floors = json.loads(await ws.recv())
            ha_floors = msg_floors.get("result", [])
            
            # 4. Richiedi Aree
            await ws.send(json.dumps({"id": 2, "type": "config/area_registry/list"}))
            msg_areas = json.loads(await ws.recv())
            ha_areas = msg_areas.get("result", [])
            
            # Upsert Floors
            for f in ha_floors:
                floor_id = f.get("floor_id")
                name = f.get("name")
                level = f.get("level", 0)
                if floor_id and name:
                    upsert_floor(floor_id, name, level)
            
            # Upsert Rooms (Areas)
            # Fetch existing rooms to keep their width/height/x/y
            existing_rooms = {r["id"]: r for r in get_rooms()}
            
            for a in ha_areas:
                area_id = a.get("area_id")
                name = a.get("name")
                floor_id = a.get("floor_id")
                
                if not area_id or not name:
                    continue
                    
                # Se la stanza esiste già, mantieni dimensioni e coordinate. Altrimenti default 4.0
                width = 4.0
                height = 4.0
                x = 0.0
                y = 0.0
                
                if area_id in existing_rooms:
                    width = existing_rooms[area_id].get("width", 4.0)
                    height = existing_rooms[area_id].get("height", 4.0)
                    x = existing_rooms[area_id].get("x", 0.0)
                    y = existing_rooms[area_id].get("y", 0.0)
                    
                # Salviamo la stanza con ID uguale all'area_id di HA e floor_id uguale a quello di HA
                upsert_room(area_id, name, floor_id, area_id, width, height, x, y)
                
            return {"status": "success", "floors_synced": len(ha_floors), "areas_synced": len(ha_areas)}
            
    except Exception as e:
        logger.error(f"Errore durante il sync con HA: {e}")
        return {"status": "error", "message": str(e)}

# Mount the static frontend
# Assumes /frontend/dist exists (built by Vite)
if os.path.exists("/frontend/dist"):
    app.mount("/", StaticFiles(directory="/frontend/dist", html=True), name="frontend")
else:
    # For local development fallback
    logger.warning("/frontend/dist not found, UI will not be served natively.")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8099)
