import time
import math
import numpy as np
import os
import joblib
from collections import deque
from sklearn.ensemble import RandomForestClassifier

# --- Topological Filter ---

def apply_topological_filter_1d(distance: float, sensor_config: dict, room: dict) -> bool:
    """
    Checks if a 1D distance is physically possible within the room bounds.
    If the distance is strictly greater than the maximum possible distance from 
    the sensor to any wall, or greater than sensor max_distance, it returns False (Blocked).
    """
    if not sensor_config or not room:
        return True # Cannot filter without topology

    max_allowed = sensor_config.get("max_distance", 8.0)
    
    # Calculate max distance to corners of the room as absolute worst-case scenario
    # Room center is (0,0). Corners are +/- width/2, +/- height/2
    w2 = room.get("width", 5.0) / 2
    h2 = room.get("height", 5.0) / 2
    
    sx = sensor_config.get("x", 0.0)
    sy = sensor_config.get("y", 0.0)
    
    corners = [
        (-w2, -h2), (w2, -h2),
        (-w2, h2), (w2, h2)
    ]
    
    max_dist_to_corner = 0
    for cx, cy in corners:
        dist = math.hypot(cx - sx, cy - sy)
        if dist > max_dist_to_corner:
            max_dist_to_corner = dist
            
    # Add a small buffer (0.5m) per inaccuracies
    max_physical = min(max_allowed, max_dist_to_corner + 0.5)
    
    if distance > max_physical:
        return False # Ghosting outside the walls
        
    return True

# --- Target Tracking ---

class Track:
    def __init__(self, track_id: int, initial_distance: float):
        self.track_id = track_id
        self.history = deque(maxlen=30) # Stores (timestamp, distance)
        self.add_point(initial_distance)
        self.last_update = time.time()
        
    def add_point(self, distance: float):
        self.history.append((time.time(), distance))
        self.last_update = time.time()
        
    def get_velocity(self) -> float:
        if len(self.history) < 2:
            return 0.0
            
        t1, d1 = self.history[0]
        t2, d2 = self.history[-1]
        dt = t2 - t1
        if dt == 0: return 0.0
        return (d2 - d1) / dt # meters per second
        
    def get_state(self) -> str:
        v = self.get_velocity()
        if v < -0.1: return 'approaching'
        if v > 0.1: return 'receding'
        return 'stationary'
        
    def get_features(self) -> list:
        # [current_distance, mean_velocity, is_approaching, is_receding]
        v = self.get_velocity()
        return [
            self.history[-1][1],
            v,
            1.0 if v < -0.1 else 0.0,
            1.0 if v > 0.1 else 0.0
        ]

class TargetTracker:
    def __init__(self, max_tracks=3, max_distance_match=1.5, track_timeout=5.0):
        self.tracks = {}
        self.next_id = 1
        self.max_tracks = max_tracks
        self.max_distance_match = max_distance_match
        self.track_timeout = track_timeout
        
    def update(self, distances: list) -> list:
        now = time.time()
        
        # Remove stale tracks
        stale_keys = [tid for tid, track in self.tracks.items() if now - track.last_update > self.track_timeout]
        for k in stale_keys:
            del self.tracks[k]
            
        active_tracks = []
        
        # Associate each new distance with an existing track (Nearest Neighbor)
        unmatched_distances = list(distances)
        
        # Calculate distance matrix
        for tid, track in list(self.tracks.items()):
            if not unmatched_distances:
                break
                
            last_d = track.history[-1][1]
            # Find closest distance
            closest_idx = min(range(len(unmatched_distances)), key=lambda i: abs(unmatched_distances[i] - last_d))
            closest_dist = unmatched_distances[closest_idx]
            
            if abs(closest_dist - last_d) <= self.max_distance_match:
                track.add_point(closest_dist)
                active_tracks.append(track)
                unmatched_distances.pop(closest_idx)
                
        # Create new tracks for unmatched distances
        for d in unmatched_distances:
            if len(self.tracks) < self.max_tracks:
                new_track = Track(self.next_id, d)
                self.tracks[self.next_id] = new_track
                active_tracks.append(new_track)
                self.next_id += 1
                
        return active_tracks

# --- Machine Learning ---

MODELS_DIR = "/data/ml_models" if os.path.exists("/data") else "./ml_models"
os.makedirs(MODELS_DIR, exist_ok=True)

def get_model_path(sensor_id: str) -> str:
    return os.path.join(MODELS_DIR, f"rf_model_{sensor_id}.joblib")

def train_sensor_model(sensor_id: str):
    from db import get_connection, db_lock
    
    with db_lock:
        conn = get_connection()
        cursor = conn.cursor()
        # Fetch events for this sensor
        cursor.execute("SELECT target_distance, is_false_positive, timestamp FROM sensor_events WHERE sensor_id = ? ORDER BY timestamp ASC", (sensor_id,))
        rows = cursor.fetchall()
        conn.close()
        
    if len(rows) < 50:
        print(f"Not enough data to train model for {sensor_id} (found {len(rows)} rows)")
        return
        
    X = []
    y = []
    
    # Simulate a tracker over historical data to generate features
    tracker = TargetTracker()
    for row in rows:
        tracks = tracker.update([row['target_distance']])
        if tracks:
            features = tracks[0].get_features()
            X.append(features)
            y.append(row['is_false_positive'])
            
    if sum(y) == 0 or sum(y) == len(y):
        print(f"Dataset for {sensor_id} only has one class. Skipping training.")
        return
        
    clf = RandomForestClassifier(n_estimators=50, max_depth=5, random_state=42)
    clf.fit(X, y)
    
    joblib.dump(clf, get_model_path(sensor_id))
    print(f"Model trained for {sensor_id} with {len(X)} samples.")

def predict_presence(sensor_id: str, track: Track) -> bool:
    """Returns True if valid human, False if False Positive."""
    model_path = get_model_path(sensor_id)
    if not os.path.exists(model_path):
        return True # Default to true if no model
        
    try:
        clf = joblib.load(model_path)
        features = np.array([track.get_features()])
        prediction = clf.predict(features)
        return prediction[0] == 0 # 0 is valid human, 1 is false positive
    except Exception as e:
        print(f"Prediction error: {e}")
        return True
