import sqlite3
import json
from datetime import datetime
import os
import threading

db_lock = threading.Lock()

DB_PATH = os.environ.get("DB_PATH", "/data/presence_ai.db")

def get_connection():
    # In Home Assistant Add-ons, persistent data should be stored in /data/
    # For local development, we fallback to a local file
    os.makedirs(os.path.dirname(DB_PATH) if os.path.dirname(DB_PATH) else ".", exist_ok=True)
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Enable Write-Ahead Logging for better concurrency
    cursor.execute("PRAGMA journal_mode=WAL;")
    
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
    
    # Table for sensor configuration (Calibration & Offset & Enabled status)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sensors (
            sensor_id TEXT PRIMARY KEY,
            friendly_name TEXT,
            calibration_offset REAL DEFAULT 0.0,
            room_id TEXT,
            is_enabled BOOLEAN DEFAULT 0,
            x REAL DEFAULT 0.0,
            y REAL DEFAULT 0.0,
            fov_angle REAL DEFAULT 120.0,
            heading_angle REAL DEFAULT 0.0,
            max_distance REAL DEFAULT 8.0
        )
    """)
    
    # Table for floors
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS floors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            level INTEGER DEFAULT 0
        )
    """)

    # Table for rooms
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rooms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            floor_id TEXT,
            ha_area_id TEXT,
            width REAL DEFAULT 4.0,
            height REAL DEFAULT 4.0,
            x REAL DEFAULT 0.0,
            y REAL DEFAULT 0.0,
            wall_material TEXT DEFAULT 'mattone',
            FOREIGN KEY (floor_id) REFERENCES floors(id)
        )
    """)

    # Table for doors and windows
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS doors_windows (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            room_id TEXT,
            type TEXT, -- 'door', 'window'
            x REAL DEFAULT 0.0,
            y REAL DEFAULT 0.0,
            width REAL DEFAULT 1.0,
            is_magnetic BOOLEAN DEFAULT 0,
            sensor_id TEXT,
            rotation REAL DEFAULT 0.0
        )
    """)

    # Simple migration if the column doesn't exist
    try:
        cursor.execute("ALTER TABLE sensors ADD COLUMN is_enabled BOOLEAN DEFAULT 0")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE sensors ADD COLUMN x REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE sensors ADD COLUMN y REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE sensors ADD COLUMN fov_angle REAL DEFAULT 120.0")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE sensors ADD COLUMN heading_angle REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass
        
    try:
        cursor.execute("ALTER TABLE sensors ADD COLUMN max_distance REAL DEFAULT 8.0")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE doors_windows ADD COLUMN rotation REAL DEFAULT 0.0")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE doors_windows ADD COLUMN ha_entity_id TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE doors_windows ADD COLUMN target_room_id TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE rooms ADD COLUMN wall_material TEXT DEFAULT 'mattone'")
    except sqlite3.OperationalError:
        pass

    try:
        cursor.execute("ALTER TABLE rooms ADD COLUMN ha_area_id TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

# ---- CRUD per Floors ----
def get_floors():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM floors ORDER BY level DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def upsert_floor(floor_id: str, name: str, level: int):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO floors (id, name, level) VALUES (?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET name=excluded.name, level=excluded.level
    """, (floor_id, name, level))
    conn.commit()
    conn.close()

def delete_floor(floor_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM floors WHERE id=?", (floor_id,))
    # Cascade delete rooms
    cursor.execute("DELETE FROM rooms WHERE floor_id=?", (floor_id,))
    conn.commit()
    conn.close()

# ---- CRUD per Rooms ----
def get_rooms(floor_id: str = None):
    conn = get_connection()
    cursor = conn.cursor()
    if floor_id:
        cursor.execute("SELECT * FROM rooms WHERE floor_id=?", (floor_id,))
    else:
        cursor.execute("SELECT * FROM rooms")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def upsert_room(room_id: str, name: str, floor_id: str, ha_area_id: str, width: float, height: float, x: float, y: float, wall_material: str = 'mattone'):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO rooms (id, name, floor_id, ha_area_id, width, height, x, y, wall_material) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
            name=excluded.name, floor_id=excluded.floor_id, ha_area_id=excluded.ha_area_id, 
            width=excluded.width, height=excluded.height, x=excluded.x, y=excluded.y, wall_material=excluded.wall_material
    """, (room_id, name, floor_id, ha_area_id, width, height, x, y, wall_material))
    conn.commit()
    conn.close()

def delete_room(room_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM rooms WHERE id=?", (room_id,))
    conn.commit()
    conn.close()

def get_all_sensors():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sensors")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def upsert_sensor(sensor_id: str, is_enabled: bool = False):
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            # Insert if not exists, do not overwrite is_enabled if already exists
            cursor.execute("""
                INSERT INTO sensors (sensor_id, is_enabled) 
                VALUES (?, ?)
                ON CONFLICT(sensor_id) DO NOTHING
            """, (sensor_id, is_enabled))
            conn.commit()
        finally:
            conn.close()

def set_sensor_enabled(sensor_id: str, is_enabled: bool):
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                UPDATE sensors SET is_enabled = ? WHERE sensor_id = ?
            """, (is_enabled, sensor_id))
            # If it updated 0 rows, it means the sensor doesn't exist yet, insert it
            if cursor.rowcount == 0:
                cursor.execute("""
                    INSERT INTO sensors (sensor_id, is_enabled) VALUES (?, ?)
                """, (sensor_id, is_enabled))
            conn.commit()
        finally:
            conn.close()

def update_sensor_config(sensor_id: str, room_id: str = None, x: float = None, y: float = None, fov_angle: float = None, heading_angle: float = None, max_distance: float = None):
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            
            updates = []
            params = []
            if room_id is not None:
                updates.append("room_id = ?")
                params.append(room_id)
            if x is not None:
                updates.append("x = ?")
                params.append(x)
            if y is not None:
                updates.append("y = ?")
                params.append(y)
            if fov_angle is not None:
                updates.append("fov_angle = ?")
                params.append(fov_angle)
            if heading_angle is not None:
                updates.append("heading_angle = ?")
                params.append(heading_angle)
            if max_distance is not None:
                updates.append("max_distance = ?")
                params.append(max_distance)
                
            if not updates:
                return
                
            params.append(sensor_id)
            query = f"UPDATE sensors SET {', '.join(updates)} WHERE sensor_id = ?"
            cursor.execute(query, params)
            conn.commit()
        finally:
            conn.close()

# ---- CRUD per Doors/Windows ----
def get_doors_windows():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM doors_windows")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def reset_topology():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM doors_windows")
    cursor.execute("DELETE FROM rooms")
    cursor.execute("DELETE FROM floors")
    # Non eliminiamo i sensori, ma li scolleghiamo dalle stanze
    cursor.execute("UPDATE sensors SET room_id = NULL")
    conn.commit()
    conn.close()

def sync_topology(rooms: list, doors: list):
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            
            cursor.execute("SELECT id FROM rooms")
            current_room_ids = {row['id'] for row in cursor.fetchall()}
            
            cursor.execute("SELECT id FROM doors_windows")
            current_door_ids = {row['id'] for row in cursor.fetchall()}
            
            new_room_ids = {r['id'] for r in rooms}
            new_door_ids = {d['id'] for d in doors}
            
            for rid in current_room_ids - new_room_ids:
                cursor.execute("DELETE FROM rooms WHERE id=?", (rid,))
                
            for did in current_door_ids - new_door_ids:
                cursor.execute("DELETE FROM doors_windows WHERE id=?", (did,))
                
            for r in rooms:
                cursor.execute("""
                    INSERT INTO rooms (id, name, floor_id, ha_area_id, width, height, x, y, wall_material) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                        name=excluded.name, floor_id=excluded.floor_id, ha_area_id=excluded.ha_area_id, 
                        width=excluded.width, height=excluded.height, x=excluded.x, y=excluded.y, wall_material=excluded.wall_material
                """, (r['id'], r['name'], r.get('floor_id'), r.get('ha_area_id', ''), r['width'], r['height'], r['x'], r['y'], r.get('wall_material', 'mattone')))
                
            for d in doors:
                cursor.execute("""
                    INSERT INTO doors_windows (id, name, room_id, type, x, y, width, is_magnetic, sensor_id, rotation, ha_entity_id, target_room_id) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO UPDATE SET 
                        name=excluded.name, room_id=excluded.room_id, type=excluded.type, 
                        x=excluded.x, y=excluded.y, width=excluded.width, is_magnetic=excluded.is_magnetic, 
                        sensor_id=excluded.sensor_id, rotation=excluded.rotation,
                        ha_entity_id=excluded.ha_entity_id, target_room_id=excluded.target_room_id
                """, (d['id'], d['name'], d['room_id'], d['type'], d['x'], d['y'], d['width'], d.get('is_magnetic', False), d.get('sensor_id', ''), d.get('rotation', 0.0), d.get('ha_entity_id', ''), d.get('target_room_id', '')))
                
            conn.commit()
        finally:
            conn.close()

def upsert_door_window(item_id: str, name: str, room_id: str, type: str, x: float, y: float, width: float, is_magnetic: bool, sensor_id: str, rotation: float = 0.0, ha_entity_id: str = "", target_room_id: str = ""):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO doors_windows (id, name, room_id, type, x, y, width, is_magnetic, sensor_id, rotation, ha_entity_id, target_room_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET 
            name=excluded.name, room_id=excluded.room_id, type=excluded.type,
            x=excluded.x, y=excluded.y, width=excluded.width,
            is_magnetic=excluded.is_magnetic, sensor_id=excluded.sensor_id,
            rotation=excluded.rotation, ha_entity_id=excluded.ha_entity_id,
            target_room_id=excluded.target_room_id
    """, (item_id, name, room_id, type, x, y, width, is_magnetic, sensor_id, rotation))
    conn.commit()
    conn.close()

def delete_door_window(item_id: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM doors_windows WHERE id=?", (item_id,))
    conn.commit()
    conn.close()

def is_sensor_enabled(sensor_id: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT is_enabled FROM sensors WHERE sensor_id = ?", (sensor_id,))
    row = cursor.fetchone()
    conn.close()
    return bool(row['is_enabled']) if row else False

def insert_sensor_event(sensor_id: str, target_distance: float, presence: bool, payload: dict):
    with db_lock:
        conn = get_connection()
        try:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO sensor_events (sensor_id, target_distance, presence, raw_payload)
                VALUES (?, ?, ?, ?)
            """, (sensor_id, target_distance, presence, json.dumps(payload)))
            conn.commit()
        finally:
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
