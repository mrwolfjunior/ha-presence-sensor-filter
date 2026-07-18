import sqlite3
import json
from datetime import datetime
import os

DB_PATH = os.environ.get("DB_PATH", "/data/presence_ai.db")

def get_connection():
    # In Home Assistant Add-ons, persistent data should be stored in /data/
    # For local development, we fallback to a local file
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Table for storing raw sensor telemetry (Data Ingestion for ML)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sensor_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sensor_id TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            target_distance REAL,
            presence BOOLEAN,
            raw_payload TEXT
        )
    """)
    
    # Table for sensor configuration (Calibration & Offset)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sensors (
            sensor_id TEXT PRIMARY KEY,
            friendly_name TEXT,
            calibration_offset REAL DEFAULT 0.0,
            room_id TEXT
        )
    """)
    
    conn.commit()
    conn.close()

def insert_sensor_event(sensor_id: str, target_distance: float, presence: bool, payload: dict):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO sensor_events (sensor_id, target_distance, presence, raw_payload)
        VALUES (?, ?, ?, ?)
    """, (sensor_id, target_distance, presence, json.dumps(payload)))
    conn.commit()
    conn.close()

def get_recent_events(sensor_id: str, limit: int = 100):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT * FROM sensor_events
        WHERE sensor_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
    """, (sensor_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]
