import sqlite3
import os
import db

db.init_db()

conn = db.get_connection()
cursor = conn.cursor()

# Insert Floors
cursor.execute("INSERT OR REPLACE INTO floors (id, name, level) VALUES ('piano_terra', 'Piano Terra', 0)")
cursor.execute("INSERT OR REPLACE INTO floors (id, name, level) VALUES ('primo_piano', 'Primo Piano', 1)")

# Insert Rooms
cursor.execute("INSERT OR REPLACE INTO rooms (id, name, floor_id, ha_area_id, width, height, x, y) VALUES ('soggiorno', 'Soggiorno', 'piano_terra', 'soggiorno_area', 6.0, 5.0, 0, 0)")
cursor.execute("INSERT OR REPLACE INTO rooms (id, name, floor_id, ha_area_id, width, height, x, y) VALUES ('cucina', 'Cucina', 'piano_terra', 'cucina_area', 4.0, 5.0, 6, 0)")

cursor.execute("INSERT OR REPLACE INTO rooms (id, name, floor_id, ha_area_id, width, height, x, y) VALUES ('camera', 'Camera', 'primo_piano', 'camera_area', 5.0, 4.0, 0, 0)")

# Insert Doors
cursor.execute("INSERT OR REPLACE INTO doors_windows (id, name, room_id, type, x, y, width, is_magnetic, sensor_id, rotation) VALUES ('porta_ingresso', 'Porta Ingresso', 'soggiorno', 'door', 0, 2.5, 1.0, 0, '', 0)")
cursor.execute("INSERT OR REPLACE INTO doors_windows (id, name, room_id, type, x, y, width, is_magnetic, sensor_id, rotation) VALUES ('finestra_cucina', 'Finestra Cucina', 'cucina', 'window', 8.0, 5.0, 1.2, 0, '', 90)")

# Insert Sensors
cursor.execute("INSERT OR REPLACE INTO sensors (sensor_id, friendly_name, room_id, is_enabled, x, y, fov_angle, heading_angle, max_distance) VALUES ('sensor.soggiorno_presence', 'Sensore Soggiorno', 'soggiorno', 1, 3.0, 2.5, 120, 0, 6.0)")

conn.commit()
conn.close()
print("Mock data populated!")
