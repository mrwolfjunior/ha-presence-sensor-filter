import React, { useState, useEffect } from 'react';
import { 
  Box, Drawer, Button, Typography, TextField, FormControl, InputLabel, 
  Select, MenuItem, IconButton, Card, CardContent, Switch, List, ListItem, ListItemText, ListItemButton, ListItemIcon, Divider, CssBaseline, ThemeProvider, createTheme, Chip, Paper, Tooltip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Grid, Slider, Autocomplete, FormControlLabel
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import SettingsIcon from '@mui/icons-material/Settings';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import SensorsIcon from '@mui/icons-material/Sensors';
import WindowIcon from '@mui/icons-material/Window';
import DeleteIcon from '@mui/icons-material/Delete';
import HomeIcon from '@mui/icons-material/Home';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import InfoIcon from '@mui/icons-material/Info';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SecurityIcon from '@mui/icons-material/Security';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import AddIcon from '@mui/icons-material/Add';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import './index.css';
import Map3D from './components/Map3D';
import CalibrationWizard from './components/CalibrationWizard';
import AlarmReviewPanel from './components/AlarmReviewPanel';

const basePath = window.location.pathname.replace(/\/$/, "");

const theme = createTheme({
  palette: {
    primary: { main: '#3f51b5' },
    secondary: { main: '#f50057' },
    background: { default: '#f5f5f5' }
  },
  typography: { fontFamily: 'Roboto, sans-serif' }
});

function DimensionInput({ label, value, onChange }) {
  const [localVal, setLocalVal] = useState(String(value));
  
  useEffect(() => {
    setLocalVal(String(value));
  }, [value]);

  const handleBlur = () => {
    const parsed = parseFloat(localVal);
    if (!isNaN(parsed) && parsed > 0.5) {
      onChange(parsed);
    } else {
      setLocalVal(String(value));
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.target.blur();
    }
  };

  return (
    <TextField 
      label={label} 
      size="small" 
      type="number" 
      value={localVal} 
      onChange={(e) => setLocalVal(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      inputProps={{ step: 0.1, min: 0.5 }}
    />
  );
}

function App() {
  const [rooms, setRooms] = useState([]);
  const [floors, setFloors] = useState([]);
  const [doors, setDoors] = useState([]);
  const [dbSensors, setDbSensors] = useState([]); 
  const [sensors, setSensors] = useState({});     
  const [selectedElement, setSelectedElement] = useState(null);
  
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  
  const [newRoomName, setNewRoomName] = useState("");
  const [newFloorName, setNewFloorName] = useState("");
  const [activeFloorId, setActiveFloorId] = useState(null);
  const [currentTab, setCurrentTab] = useState(0); 
  const [settingsSection, setSettingsSection] = useState('status');
  const [cameraZoom, setCameraZoom] = useState(50);
  const [connected, setConnected] = useState(false);

  // --- Calibration Wizard State ---
  const [calibrationWizardOpen, setCalibrationWizardOpen] = useState(false);
  const [calibrationRoom, setCalibrationRoom] = useState(null);
  const [calibrationSensor, setCalibrationSensor] = useState(null);

  // --- Topology History State ---
  const [historyState, setHistoryState] = useState({ entries: [], index: -1 });

  const pushToHistory = (newRooms, newDoors, newSensors = dbSensors) => {
    setHistoryState(prev => {
      const current = prev.entries[prev.index];
      if (current && 
          JSON.stringify(current.rooms) === JSON.stringify(newRooms) &&
          JSON.stringify(current.doors) === JSON.stringify(newDoors) &&
          JSON.stringify(current.sensors) === JSON.stringify(newSensors)) {
        return prev;
      }
      const newEntries = prev.entries.slice(0, prev.index + 1);
      newEntries.push({ rooms: newRooms, doors: newDoors, sensors: newSensors });
      return { entries: newEntries, index: newEntries.length - 1 };
    });
    setRooms(newRooms);
    setDoors(newDoors);
    setDbSensors(newSensors);
  };

  const undo = () => {
    if (historyState.index > 0) {
      const newIndex = historyState.index - 1;
      const state = historyState.entries[newIndex];
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      setRooms(state.rooms);
      setDoors(state.doors);
      setDbSensors(state.sensors);
      setSelectedElement(null);
    }
  };

  const redo = () => {
    if (historyState.index < historyState.entries.length - 1) {
      const newIndex = historyState.index + 1;
      const state = historyState.entries[newIndex];
      setHistoryState(prev => ({ ...prev, index: newIndex }));
      setRooms(state.rooms);
      setDoors(state.doors);
      setDbSensors(state.sensors);
      setSelectedElement(null);
    }
  };

  const saveTopology = async () => {
    const current = historyState.entries[historyState.index];
    if (!current) return;
    try {
      const topoRes = await fetch(`${basePath}/api/topology/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms: current.rooms, doors: current.doors })
      });
      if (!topoRes.ok) {
        const text = await topoRes.text();
        throw new Error("Topology sync failed: " + text);
      }
      
      // Save sensors
      for (const sensor of current.sensors) {
        const sensorRes = await fetch(`${basePath}/api/sensors/${encodeURIComponent(sensor.sensor_id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(sensor)
        });
        if (!sensorRes.ok) {
          const text = await sensorRes.text();
          throw new Error("Sensor " + sensor.sensor_id + " save failed: " + text);
        }
      }
      
      fetchData(); 
    } catch(e) {
      alert('Errore durante il salvataggio: ' + e.message);
    }
  };

  useEffect(() => {
    fetchData();

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}${basePath}/ws`;
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => setConnected(true);

    socket.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'mqtt_state' || data.type === 'initial_state') {
         setSensors(prev => ({
           ...prev,
           [data.sensor_id]: { ...prev[data.sensor_id], ...data.data }
         }));
      }
    };

    socket.onclose = () => setConnected(false);

    return () => socket.close();
  }, []);

  useEffect(() => {
    if (floors.length > 0 && !activeFloorId) {
      setActiveFloorId(floors[0].id);
    }
  }, [floors, activeFloorId]);

  const [systemStatus, setSystemStatus] = useState(null);
  const [pendingRetention, setPendingRetention] = useState(7);

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch(`${basePath}/api/system/status`);
      const data = await res.json();
      setSystemStatus(data);
      setPendingRetention(data.db_retention_days);
    } catch (e) {
      console.error(e);
    }
  };

  const updateDbRetention = async (days) => {
    try {
      await fetch(`${basePath}/api/system/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ db_retention_days: days })
      });
      fetchSystemStatus();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchData = async () => {
    try {
      const floorsRes = await fetch(`${basePath}/api/floors`);
      const roomsRes = await fetch(`${basePath}/api/rooms`);
      const doorsRes = await fetch(`${basePath}/api/doors`);
      const sensorsRes = await fetch(`${basePath}/api/sensors`);
      
      const floorsData = await floorsRes.json();
      const roomsData = await roomsRes.json();
      const doorsData = await doorsRes.json();
      const sensorsData = await sensorsRes.json();

      setFloors(floorsData);
      setDbSensors(sensorsData);
      
      setRooms(roomsData);
      setDoors(doorsData);
      
      setHistoryState({ entries: [{ rooms: roomsData, doors: doorsData, sensors: sensorsData }], index: 0 });
    } catch (error) {
      console.error("Error fetching data:", error);
    }
  };

  const addFloor = async () => {
    if(!newFloorName) return;
    const newFloor = { id: `floor_${Date.now()}`, name: newFloorName, level: 0 };
    await fetch(`${basePath}/api/floors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newFloor)
    });
    setNewFloorName("");
    setFloorDialogOpen(false);

    fetchData();
  };

  const addRoom = async () => {
    if (!newRoomName || !activeFloorId) return;
    
    const activeRooms = rooms.filter(r => r.floor_id === activeFloorId);
    let defaultX = 0; let defaultY = 0;
    
    if (activeRooms.length > 0) {
      const lastRoom = activeRooms[activeRooms.length - 1];
      defaultX = lastRoom.x + lastRoom.width + 0.5; 
      defaultY = lastRoom.y;
    }

    const newRoom = { 
      id: `room_${Date.now()}`, name: newRoomName, floor_id: activeFloorId, 
      width: 4, height: 4, x: defaultX, y: defaultY 
    };
    
    pushToHistory([...rooms, newRoom], doors);
    setNewRoomName("");
    setRoomDialogOpen(false);
  };

  const addDoorWindow = (type) => {
    if (!activeFloorId || selectedElement?.type !== 'room') return;

    const targetRoomId = selectedElement.id;
    const targetRoom = rooms.find(r => r.id === targetRoomId);
    if (!targetRoom) return;

    const width = 1.5;
    const margin = width / 2;
    
    // Function to check overlap
    const checkOverlap = (px, py, prot) => {
      const hw = width / 2;
      const ht = 0.2;
      const isHorizontal = prot === 0 || prot === 180;
      const r1 = {
        left: px - (isHorizontal ? hw : ht), right: px + (isHorizontal ? hw : ht),
        top: py - (isHorizontal ? ht : hw), bottom: py + (isHorizontal ? ht : hw),
      };
      for (const other of doors) {
        if (other.room_id !== targetRoomId) continue;
        const otherIsHorizontal = other.rotation === 0 || other.rotation === 180;
        const hwOther = other.width / 2;
        const r2 = {
          left: other.x - (otherIsHorizontal ? hwOther : ht), right: other.x + (otherIsHorizontal ? hwOther : ht),
          top: other.y - (otherIsHorizontal ? ht : hwOther), bottom: other.y + (otherIsHorizontal ? ht : hwOther),
        };
        if (!(r1.left >= r2.right || r1.right <= r2.left || r1.top >= r2.bottom || r1.bottom <= r2.top)) {
          return true;
        }
      }
      return false;
    };

    // Generate possible spots around the perimeter in local coordinates
    const spots = [];
    const step = 0.5;
    // Bottom
    for (let x = -targetRoom.width/2 + margin; x <= targetRoom.width/2 - margin; x += step) spots.push({ x, y: targetRoom.height/2, rot: 0 });
    // Top
    for (let x = -targetRoom.width/2 + margin; x <= targetRoom.width/2 - margin; x += step) spots.push({ x, y: -targetRoom.height/2, rot: 180 });
    // Left
    for (let y = -targetRoom.height/2 + margin; y <= targetRoom.height/2 - margin; y += step) spots.push({ x: -targetRoom.width/2, y, rot: -90 });
    // Right
    for (let y = -targetRoom.height/2 + margin; y <= targetRoom.height/2 - margin; y += step) spots.push({ x: targetRoom.width/2, y, rot: 90 });

    let spawnX = 0;
    let spawnY = targetRoom.height / 2;
    let spawnRot = 0;

    // Find first free spot
    for (const spot of spots) {
      if (!checkOverlap(spot.x, spot.y, spot.rot)) {
        spawnX = spot.x;
        spawnY = spot.y;
        spawnRot = spot.rot;
        break;
      }
    }

    const newObj = {
      id: `${type}_${Date.now()}`,
      room_id: targetRoomId,
      type: type,
      name: type === 'door' ? 'Nuova Porta' : 'Nuova Finestra',
      x: spawnX,
      y: spawnY,
      width: width,
      height: 0.2,
      rotation: spawnRot,
      is_magnetic: false,
      sensor_id: '',
      ha_entity_id: '',
      target_room_id: ''
    };
    
    pushToHistory(rooms, [...doors, newObj]);
    setSelectedElement({ type: type, id: newObj.id });
  };

  const updateRoomLocal = (id, updates) => {
    const oldRoom = rooms.find(r => r.id === id);
    if (!oldRoom) return;

    const newRooms = rooms.map(r => r.id === id ? { ...r, ...updates } : r);

    const dw = updates.width !== undefined ? updates.width - oldRoom.width : 0;
    const dh = updates.height !== undefined ? updates.height - oldRoom.height : 0;

    let newDoors = doors;
    let newSensors = dbSensors;

    if (dw !== 0 || dh !== 0) {
      newDoors = doors.map(d => {
        if (d.room_id !== id) return d;
        let nx = d.x;
        let ny = d.y;
        if (dw !== 0 && Math.abs(d.x) > 0.1) nx += Math.sign(d.x) * (dw / 2);
        if (dh !== 0 && Math.abs(d.y) > 0.1) ny += Math.sign(d.y) * (dh / 2);
        return { ...d, x: nx, y: ny };
      });

      newSensors = dbSensors.map(s => {
        if (s.room_id !== id) return s;
        let nx = s.x;
        let ny = s.y;
        if (dw !== 0 && Math.abs(s.x) > 0.1) nx += Math.sign(s.x) * (dw / 2);
        if (dh !== 0 && Math.abs(s.y) > 0.1) ny += Math.sign(s.y) * (dh / 2);
        return { ...s, x: nx, y: ny };
      });
    }

    pushToHistory(newRooms, newDoors, newSensors);
  };

  const deleteRoomLocal = (id) => {
    const newRooms = rooms.filter(r => r.id !== id);
    const newDoors = doors.filter(d => d.room_id !== id);
    pushToHistory(newRooms, newDoors);
    if (selectedElement?.id === id) setSelectedElement(null);
  };

  const updateDoorLocal = (id, updates) => {
    setDoors(prevDoors => {
      const newDoors = prevDoors.map(d => d.id === id ? { ...d, ...updates } : d);
      pushToHistory(rooms, newDoors);
      return newDoors;
    });
  };

  const deleteDoorLocal = (id) => {
    const newDoors = doors.filter(d => d.id !== id);
    pushToHistory(rooms, newDoors);
    if (selectedElement?.id === id) setSelectedElement(null);
  };

  const placeNewSensor = (sensor_id) => {
    let spawnX = 0;
    let spawnY = 0;
    let room_id = activeRooms[0]?.id || null;

    if (activeRooms.length > 0) {
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      activeRooms.forEach(r => {
        const halfW = r.width / 2;
        const halfH = r.height / 2;
        minX = Math.min(minX, r.x - halfW);
        maxX = Math.max(maxX, r.x + halfW);
        minY = Math.min(minY, r.y - halfH);
        maxY = Math.max(maxY, r.y + halfH);
      });
      if (minX === Infinity) {
        minX = -2; maxX = 2; maxY = 2;
      }
      
      const absSpawnX = minX + (Math.random() * (maxX - minX));
      const absSpawnY = maxY + 2.0;
      const roundedAbsSpawnX = Math.round(absSpawnX * 2) / 2;

      // Convert to local coords of the assigned room
      const room = activeRooms[0];
      spawnX = roundedAbsSpawnX - room.x;
      spawnY = absSpawnY - room.y;
    }

    updateSensorLocal(sensor_id, { x: spawnX, y: spawnY, room_id });
  };

  const updateSensorLocal = (id, updates) => {
    setDbSensors(prevSensors => {
      const newSensors = prevSensors.map(s => s.sensor_id === id ? { ...s, ...updates } : s);
      pushToHistory(rooms, doors, newSensors);
      if (updates.room_id === null && selectedElement?.id === id) {
        setSelectedElement(null);
      }
      return newSensors;
    });
  };

  const updateSensorConfig = async (id, updates) => {
    try {
      const response = await fetch(`${basePath}/api/sensors/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (response.ok) {
        setDbSensors(prev => prev.map(s => s.sensor_id === id ? { ...s, ...updates } : s));
      } else {
        const errText = await response.text();
        alert(`Errore aggiornamento sensore: ${response.status} ${errText}`);
      }
    } catch (e) {
      console.error("Errore aggiornamento sensore", e);
      alert("Errore di rete durante aggiornamento sensore: " + e.message);
    }
  };

  useEffect(() => {
    if (settingsSection === 'ml') {
      fetchSystemStatus();
    }
  }, [settingsSection]);

  const handleDeviceAdd = async (friendly_name, is_door) => {
    try {
      await fetch(`${basePath}/api/sync_ha`, { method: 'POST' });
      alert("Sincronizzazione Home Assistant avviata");
      fetchData();
    } catch (error) {
      alert("Errore durante la sincronizzazione: " + error.message);
    }
  };

  const handleSyncHA = async () => {
    try {
      await fetch(`${basePath}/api/sync_ha`, { method: 'POST' });
      alert("Sincronizzazione Home Assistant avviata");
      fetchData();
    } catch (error) {
      alert("Errore durante la sincronizzazione: " + error.message);
    }
  };

  const handleResetTopology = async () => {
    if (window.confirm("Sei sicuro di voler eliminare tutta la planimetria (piani, stanze, porte)? I sensori verranno mantenuti ma scollegati.")) {
      try {
        await fetch(`${basePath}/api/reset_topology`, { method: 'POST' });
        alert("Planimetria azzerata con successo.");
        setActiveFloorId(null);
        setSelectedElement(null);
        fetchData();
      } catch (error) {
        alert("Errore durante il reset: " + error.message);
      }
    }
  };

  const activeRooms = rooms.filter(r => r.floor_id === activeFloorId);
  const activeRoomsIds = activeRooms.map(r => r.id);
  const activeDoors = doors.filter(d => activeRoomsIds.includes(d.room_id));
  
  const mapSensors = dbSensors.filter(s => activeRoomsIds.includes(s.room_id) && s.is_enabled);
  const unlinkedSensors = dbSensors.filter(s => !s.room_id && s.is_enabled);

  const renderSidebar = () => {
    if (!selectedElement) return null;

    if (selectedElement.type === 'room') {
      const room = rooms.find(r => r.id === selectedElement.id);
      if(!room) return null;
      
      const roomSensors = dbSensors.filter(s => s.room_id === room.id);
      
      const isDoorTouchingRoom = (d, r) => {
        if (d.room_id === r.id) return true;
        const dRoom = rooms.find(rm => rm.id === d.room_id);
        if (!dRoom) return false;
        
        const absX = dRoom.x + d.x;
        const absY = dRoom.y + d.y;
        
        const localX = absX - r.x;
        const localY = -(absY - r.y);
        
        const isVertical = d.rotation === 90 || d.rotation === -90 || d.rotation === 270;
        const hw = r.width / 2;
        const hh = r.height / 2;
        
        if (isVertical) {
          if (Math.abs(Math.abs(localX) - hw) < 0.5) {
            if (localY + d.width/2 >= -hh && localY - d.width/2 <= hh) return true;
          }
        } else {
          if (Math.abs(Math.abs(localY) - hh) < 0.5) {
            if (localX + d.width/2 >= -hw && localX - d.width/2 <= hw) return true;
          }
        }
        return false;
      };

      const touchingDoors = doors.filter(d => isDoorTouchingRoom(d, room));
      const adjacentRooms = rooms.filter(r => 
        r.id !== room.id && 
        r.floor_id === room.floor_id &&
        touchingDoors.some(d => isDoorTouchingRoom(d, r))
      );

      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Nome" size="small" value={room.name} onChange={(e) => updateRoomLocal(room.id, {name: e.target.value})} />
          <DimensionInput label="Larghezza (m)" value={room.width} onChange={(val) => updateRoomLocal(room.id, {width: val})} />
          <DimensionInput label="Lunghezza (m)" value={room.height} onChange={(val) => updateRoomLocal(room.id, {height: val})} />
          
          <FormControl size="small" fullWidth>
            <InputLabel>Materiale Muri</InputLabel>
            <Select 
              value={room.wall_material || 'mattone'} 
              label="Materiale Muri" 
              onChange={(e) => updateRoomLocal(room.id, {wall_material: e.target.value})}
            >
              <MenuItem value="mattone">Mattone (Default)</MenuItem>
              <MenuItem value="cartongesso">Cartongesso</MenuItem>
              <MenuItem value="cemento">Cemento Armato</MenuItem>
              <MenuItem value="assente">Assente (Ringhiera)</MenuItem>
            </Select>
          </FormControl>
          
          <Button 
            variant="contained" 
            color="secondary" 
            disabled={roomSensors.length === 0}
            onClick={() => {
              setCalibrationRoom(room);
              // Pre-select first sensor if available
              setCalibrationSensor(roomSensors.length > 0 ? roomSensors[0] : null);
              setCalibrationWizardOpen(true);
            }}
          >
            Avvia Calibrazione IA
          </Button>
          
          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" fontWeight="bold">Entità Collegate</Typography>
          
          <Typography variant="body2" color="textSecondary" sx={{ mt: -1 }}>Sensori ({roomSensors.length})</Typography>
          {roomSensors.length > 0 ? (
            <List dense sx={{ pt: 0, pb: 0, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {roomSensors.map(s => (
                <ListItem key={s.sensor_id} disablePadding>
                  <ListItemButton onClick={() => setSelectedElement({ type: 'sensor', id: s.sensor_id })}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <SensorsIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={s.psf_friendly_name || s.friendly_name || s.name || "Sensore Sconosciuto"} secondary={s.sensor_id} secondaryTypographyProps={{ noWrap: true, title: s.sensor_id }} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
             <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Nessun sensore</Typography>
          )}

          <Typography variant="body2" color="textSecondary">Porte e Finestre ({touchingDoors.length})</Typography>
          {touchingDoors.length > 0 ? (
            <List dense sx={{ pt: 0, pb: 0, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {touchingDoors.map(d => (
                <ListItem key={d.id} disablePadding>
                  <ListItemButton onClick={() => setSelectedElement({ type: d.type, id: d.id })}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {d.type === 'window' ? <WindowIcon fontSize="small" color="info" /> : <MeetingRoomIcon fontSize="small" color="action" />}
                    </ListItemIcon>
                    <ListItemText primary={d.type === 'window' ? 'Finestra' : 'Porta'} secondary={d.room_id !== room.id ? "Condivisa" : ""} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
             <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Nessuna porta/finestra</Typography>
          )}

          <Typography variant="body2" color="textSecondary">Stanze Adiacenti ({adjacentRooms.length})</Typography>
          {adjacentRooms.length > 0 ? (
            <List dense sx={{ pt: 0, pb: 0, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {adjacentRooms.map(r => (
                <ListItem key={r.id} disablePadding>
                  <ListItemButton onClick={() => setSelectedElement({ type: 'room', id: r.id })}>
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <HomeIcon fontSize="small" color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={r.name || "Stanza"} />
                  </ListItemButton>
                </ListItem>
              ))}
            </List>
          ) : (
             <Typography variant="caption" sx={{ display: 'block', mb: 1 }}>Nessuna stanza adiacente</Typography>
          )}

          <Divider sx={{ my: 1 }} />
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => deleteRoomLocal(room.id)}>Elimina Stanza</Button>
        </Box>
      );
    }

    if (selectedElement.type === 'sensor') {
      const sensor = dbSensors.find(s => s.sensor_id === selectedElement.id);
      if(!sensor) return null;
      const rtState = sensors[sensor.sensor_id] || {};
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6">{sensor.friendly_name || sensor.sensor_id}</Typography>
          <Typography variant="body2" color="text.secondary">ID: {sensor.sensor_id}</Typography>
          
          <Box sx={{ bgcolor: rtState.presence ? '#e8f5e9' : '#fafafa', p: 1, borderRadius: 1, border: '1px solid #ddd' }}>
             <Typography><b>Presenza:</b> {rtState.presence ? 'Rilevata' : 'Nessuna'}</Typography>
             <Typography><b>Illuminamento:</b> {rtState.illuminance !== undefined ? `${rtState.illuminance} lx` : 'N/D'}</Typography>
             <Typography><b>Batteria:</b> {rtState.battery !== undefined ? `${rtState.battery}%` : 'N/D'}</Typography>
          </Box>

          <Button variant="outlined" color="warning" onClick={() => updateSensorLocal(sensor.sensor_id, {room_id: null, x: null, y: null})}>
            Rimuovi dalla mappa
          </Button>
        </Box>
      );
    }
    
    if (selectedElement.type === 'door' || selectedElement.type === 'window') {
      const door = doors.find(d => d.id === selectedElement.id);
      if(!door) return null;
      
      const availableContactSensors = dbSensors.filter(s => s.is_magnetic || s.sensor_id.includes('contact') || s.friendly_name?.toLowerCase().includes('contact'));
      const contactSensorNames = availableContactSensors.map(s => s.sensor_id);
      
      return (
         <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6">{door.type === 'window' ? 'Finestra' : 'Porta'}</Typography>
          <DimensionInput label="Larghezza (m)" value={door.width} onChange={(val) => updateDoorLocal(door.id, {width: val})} />
          
          {door.type === 'window' && (
            <FormControlLabel 
              control={<Switch size="small" checked={door.is_french_window || false} onChange={(e) => updateDoorLocal(door.id, {is_french_window: e.target.checked})} />} 
              label="È una porta finestra" 
            />
          )}

          <FormControl size="small" fullWidth>
            <InputLabel>Frequenza di Passaggio</InputLabel>
            <Select 
              value={door.usage_frequency || 'normal'} 
              label="Frequenza di Passaggio" 
              onChange={(e) => updateDoorLocal(door.id, {usage_frequency: e.target.value})}
            >
              <MenuItem value="rare">Mai / Raramente</MenuItem>
              <MenuItem value="normal">Normale</MenuItem>
              <MenuItem value="frequent">Frequente</MenuItem>
            </Select>
          </FormControl>

          <Divider sx={{ my: 1 }} />
          <Typography variant="subtitle2" fontWeight="bold">Associa Sensore Magnetico</Typography>
          
          {(() => {
            const currentSensors = door.sensor_id ? door.sensor_id.split(',') : [];
            const handleSensorChange = (index, newValue) => {
              const updated = [...currentSensors];
              updated[index] = newValue || '';
              updateDoorLocal(door.id, {sensor_id: updated.join(',')});
            };
            const handleRemoveSensor = (index) => {
              const updated = [...currentSensors];
              updated.splice(index, 1);
              updateDoorLocal(door.id, {sensor_id: updated.join(',')});
            };
            const handleAddSensor = () => {
              const updated = [...currentSensors, ''];
              updateDoorLocal(door.id, {sensor_id: updated.join(',')});
            };
            const assignedSensors = new Set(currentSensors);
            const unassignedSensorNames = contactSensorNames.filter(name => !assignedSensors.has(name));

            return (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {currentSensors.map((sensorValue, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Autocomplete
                      freeSolo
                      options={unassignedSensorNames}
                      value={sensorValue || ''}
                      onChange={(e, newValue) => handleSensorChange(idx, newValue)}
                      onInputChange={(e, newInputValue) => handleSensorChange(idx, newInputValue)}
                      sx={{ flexGrow: 1 }}
                      renderInput={(params) => (
                        <TextField {...params} label="ID Entità HA (Contatto)" size="small" placeholder="es. binary_sensor.door_contact" />
                      )}
                    />
                    <IconButton size="small" color="error" onClick={() => handleRemoveSensor(idx)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                ))}
                <Button 
                  variant="outlined" 
                  color="primary"
                  size="small" 
                  startIcon={<AddIcon />} 
                  onClick={handleAddSensor}
                  disabled={unassignedSensorNames.length === 0}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none', mt: 1 }}
                >
                  Aggiungi sensore contatto
                </Button>
              </Box>
            );
          })()}

          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => deleteDoorLocal(door.id)} sx={{ mt: 2 }}>Elimina</Button>
        </Box>
      );
    }

    return null;
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ width: '100vw', height: '100vh', display: 'flex', bgcolor: '#f5f5f5', overflow: 'hidden', position: 'relative' }}>
        
        {/* LEFT TOOLBAR */}
        <Box sx={{ width: 280, minWidth: 280, height: '100vh', bgcolor: 'background.paper', borderRight: '1px solid #ddd', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
          {currentTab === 0 ? (
            <>
              {/* HEADER MAPPA */}
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                <HomeIcon color="primary" sx={{ mr: 1 }} />
                <Typography variant="h6" color="primary" sx={{ fontWeight: 'bold', flexGrow: 1 }}>Presence AI</Typography>
                <Chip label={connected ? "Online" : "Offline"} color={connected ? "success" : "error"} size="small" />
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Gestione Piani</Typography>
                  <FormControl size="small" fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Piano Attivo</InputLabel>
                    <Select value={activeFloorId || ''} label="Piano Attivo" onChange={(e) => setActiveFloorId(e.target.value)} disabled={floors.length === 0}>
                      {floors.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button variant="outlined" size="small" fullWidth onClick={() => setFloorDialogOpen(true)}>+ Nuovo Piano</Button>
                </Box>

                <Box sx={{ p: 2, borderBottom: '1px solid #eee' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Struttura</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Button variant="contained" color="primary" onClick={() => setRoomDialogOpen(true)} disabled={!activeFloorId} startIcon={<MeetingRoomIcon/>}>Aggiungi Stanza</Button>
                  </Box>
                </Box>

                <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Sensori da posizionare</Typography>
                  {unlinkedSensors.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">Tutti i sensori sono posizionati.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {unlinkedSensors.map(s => (
                        <Button key={s.sensor_id} variant="outlined" color="info" startIcon={<SensorsIcon />} size="small" sx={{ justifyContent: 'flex-start', textTransform: 'none' }} onClick={() => placeNewSensor(s.sensor_id)}>
                          {s.friendly_name || s.sensor_id}
                        </Button>
                      ))}
                    </Box>
                  )}
                </Box>
              </Box>

              <Box sx={{ p: 2, borderTop: '1px solid #eee' }}>
                <Button variant="text" color="inherit" onClick={() => setCurrentTab(1)} startIcon={<SettingsIcon/>} fullWidth sx={{ justifyContent: 'flex-start' }}>
                  Impostazioni
                </Button>
              </Box>
            </>
          ) : (
            <>
              {/* HEADER IMPOSTAZIONI */}
              <Box sx={{ p: 2, display: 'flex', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                <IconButton onClick={() => setCurrentTab(0)} sx={{ mr: 1, ml: -1 }}><ArrowBackIcon /></IconButton>
                <Typography variant="h6" color="text.primary" sx={{ fontWeight: 'bold' }}>Impostazioni</Typography>
              </Box>

              <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Button variant={settingsSection === 'status' ? 'contained' : 'text'} color={settingsSection === 'status' ? 'primary' : 'inherit'} sx={{ justifyContent: 'flex-start' }} startIcon={<InfoIcon />} onClick={() => setSettingsSection('status')}>
                  Status Sistema
                </Button>                
                <Button variant={settingsSection === 'devices' ? 'contained' : 'text'} color={settingsSection === 'devices' ? 'primary' : 'inherit'} sx={{ justifyContent: 'flex-start' }} startIcon={<SensorsIcon />} onClick={() => setSettingsSection('devices')}>
                  Dispositivi
                </Button>
                <Button variant={settingsSection === 'security' ? 'contained' : 'text'} color={settingsSection === 'security' ? 'primary' : 'inherit'} sx={{ justifyContent: 'flex-start' }} startIcon={<SecurityIcon />} onClick={() => setSettingsSection('security')}>
                  Sicurezza & Allarmi
                </Button>
                <Button variant={settingsSection === 'ml' ? 'contained' : 'text'} color={settingsSection === 'ml' ? 'primary' : 'inherit'} sx={{ justifyContent: 'flex-start' }} startIcon={<AnalyticsIcon />} onClick={() => setSettingsSection('ml')}>
                  Statistiche ML
                </Button>
              </Box>
            </>
          )}
        </Box>

        {/* RIGHT MAIN AREA */}
        <Box sx={{ display: 'flex', flexGrow: 1, height: '100vh', overflow: 'hidden', bgcolor: '#f5f5f5', position: 'relative' }}>
          {currentTab === 0 ? (
            <>
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}>
                
                {/* TOP FLOATING TOOLBAR */}
                <Paper sx={{ 
                  position: 'absolute', top: 20, 
                  left: selectedElement ? 'calc(50% - 160px)' : '50%', 
                  transform: 'translateX(-50%)', 
                  transition: 'left 0.3s ease-in-out',
                  zIndex: 1000, display: 'flex', alignItems: 'center', gap: 1, p: '4px 8px', borderRadius: 2,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}>
                  <Tooltip title="Annulla">
                    <span>
                      <IconButton onClick={undo} disabled={historyState.index <= 0} color="inherit">
                        <UndoIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Ripeti">
                    <span>
                      <IconButton onClick={redo} disabled={historyState.index >= historyState.entries.length - 1} color="inherit">
                        <RedoIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Box sx={{ width: '1px', height: 24, bgcolor: '#ccc', mx: 1 }} />
                  
                  {/* Draggable items */}
                  <IconButton 
                    onClick={() => addDoorWindow('door')}
                    disabled={selectedElement?.type !== 'room'}
                    color="primary"
                    size="small"
                    title="Aggiungi Porta alla stanza selezionata"
                  >
                    <MeetingRoomIcon />
                  </IconButton>
                  <IconButton 
                    onClick={() => addDoorWindow('window')}
                    disabled={selectedElement?.type !== 'room'}
                    color="primary"
                    size="small"
                    title="Aggiungi Finestra alla stanza selezionata"
                  >
                    <WindowIcon />
                  </IconButton>

                  <Box sx={{ width: '1px', height: 24, bgcolor: '#ccc', mx: 1 }} />
                  
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="small" 
                    startIcon={<SaveIcon />} 
                    onClick={saveTopology}
                    disabled={historyState.index <= 0} 
                    sx={{ textTransform: 'none', fontWeight: 'bold' }}
                  >
                    Salva Modifiche
                  </Button>
                </Paper>

                <Map3D 
                  rooms={activeRooms} 
                  sensors={mapSensors.map(s => ({...s, presence: sensors[s.sensor_id]?.presence}))} 
                  doors={activeDoors}
                  selectedElement={selectedElement}
                  onSelectElement={setSelectedElement}
                  updateRoom={updateRoomLocal}
                  updateSensorConfig={updateSensorLocal}
                  updateDoor={updateDoorLocal}
                  deleteRoom={deleteRoomLocal}
                  deleteDoor={deleteDoorLocal}
                  onCameraChange={setCameraZoom}
                  onDropElement={(type, x, y) => addDoorWindow(type, x, y)}
                />
                
                {(() => {
                  let meters = 1;
                  if (cameraZoom * 1 < 40) {
                    if (cameraZoom * 2 >= 40) meters = 2;
                    else if (cameraZoom * 5 >= 40) meters = 5;
                    else if (cameraZoom * 10 >= 40) meters = 10;
                    else if (cameraZoom * 20 >= 40) meters = 20;
                    else if (cameraZoom * 50 >= 40) meters = 50;
                    else meters = 100;
                  }
                  
                  const barWidth = cameraZoom * meters;
                  const squareText = meters === 1 ? "1 quadrato" : `${meters} quadrati`;
                  const text = `${meters} m (${squareText})`;

                  return (
                    <div style={{ 
                      position: 'absolute', bottom: 20, 
                      right: selectedElement ? 340 : 20, 
                      transition: 'right 0.3s ease-in-out',
                      background: 'rgba(255,255,255,0.85)', padding: '6px 12px', borderRadius: 4, border: '1px solid #ccc', fontSize: '11px', fontWeight: 'bold', color: '#444', display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' 
                    }}>
                      <span style={{ marginBottom: 4 }}>{text}</span>
                      <div style={{ width: barWidth, height: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #333', borderLeft: '2px solid #333', borderRight: '2px solid #333' }}>
                        <div style={{ width: 1, height: 3, background: '#333' }} />
                        <div style={{ width: 1, height: 3, background: '#333' }} />
                      </div>
                    </div>
                  );
                })()}
              </Box>

              {/* SLIDING RIGHT SIDEBAR */}
              <Box sx={{ 
                position: 'absolute', top: 0, right: 0, height: '100%', 
                width: 320, minWidth: 320, bgcolor: '#fff', borderLeft: '1px solid #eee', 
                display: 'flex', flexDirection: 'column', zIndex: 10, 
                boxShadow: '-2px 0 10px rgba(0,0,0,0.05)',
                transform: selectedElement ? 'translateX(0)' : 'translateX(100%)',
                transition: 'transform 0.3s ease-in-out'
              }}>
                <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #eee' }}>
                  <Typography variant="subtitle1" fontWeight="bold">Proprietà Oggetto</Typography>
                  <IconButton onClick={() => setSelectedElement(null)} size="small">X</IconButton>
                </Box>
                <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>{renderSidebar()}</Box>
              </Box>
            </>
          ) : (
            <Box sx={{ width: '100%', height: '100%', py: 6, px: 6, overflowY: 'auto', bgcolor: 'background.default', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {settingsSection === 'status' && (
                <Box sx={{ width: '100%', maxWidth: 800 }}>
                  <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">Status Sistema</Typography>
                  <Card elevation={0} sx={{ mb: 3, border: '1px solid #eee', maxWidth: 800 }}>
                    <CardContent sx={{ display: 'flex', gap: 4, justifyContent: 'space-around', py: 4 }}>
                      <Box sx={{ textAlign: 'center' }}><Typography variant="h3" color="primary">{floors.length}</Typography><Typography variant="subtitle1" color="text.secondary">Piani Gestiti</Typography></Box>
                      <Box sx={{ textAlign: 'center' }}><Typography variant="h3" color="primary">{rooms.length}</Typography><Typography variant="subtitle1" color="text.secondary">Stanze Totali</Typography></Box>
                      <Box sx={{ textAlign: 'center' }}><Typography variant="h3" color="primary">{dbSensors.length}</Typography><Typography variant="subtitle1" color="text.secondary">Sensori Rilevati</Typography></Box>
                    </CardContent>
                  </Card>
                  <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 800 }}>
                    Presence AI sta monitorando in tempo reale l'occupazione delle stanze utilizzando i dati provenienti dai sensori distribuiti nella struttura.
                  </Typography>

                  <Typography variant="h5" gutterBottom fontWeight="bold" sx={{ mt: 5 }}>Dettaglio Stanze e Calibrazione</Typography>
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee', mb: 4, maxWidth: 800 }}>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell><b>Stanza</b></TableCell>
                          <TableCell><b>Sensori</b></TableCell>
                          <TableCell><b>Stato</b></TableCell>
                          <TableCell><b>Ultima Calibrazione</b></TableCell>
                          <TableCell align="right"><b>Azioni</b></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {rooms.map(room => {
                          const roomSensors = dbSensors.filter(s => s.room_id === room.id);
                          const calibratedSensors = roomSensors.filter(s => s.last_calibrated_at);
                          const isCalibrated = roomSensors.length > 0 && calibratedSensors.length > 0;
                          const hasSensors = roomSensors.length > 0;
                          
                          let lastDate = null;
                          if (isCalibrated) {
                            // last_calibrated_at is a string like "2023-10-25 14:32:00" coming from SQLite CURRENT_TIMESTAMP
                            // ensure we can parse it by replacing space with T if needed, though Date() usually parses it
                            const dates = calibratedSensors.map(s => {
                              const d = new Date(s.last_calibrated_at.replace(' ', 'T'));
                              return isNaN(d.getTime()) ? 0 : d.getTime();
                            });
                            const maxTime = Math.max(...dates, 0);
                            if (maxTime > 0) {
                              lastDate = new Date(maxTime).toLocaleString();
                            }
                          }

                          return (
                            <TableRow key={room.id}>
                              <TableCell>{room.name}</TableCell>
                              <TableCell>{roomSensors.length}</TableCell>
                              <TableCell>
                                {!hasSensors ? (
                                  <Chip label="Nessun Sensore" size="small" />
                                ) : isCalibrated ? (
                                  <Chip label="Calibrata" color="success" size="small" />
                                ) : (
                                  <Chip label="Da Calibrare" color="warning" size="small" />
                                )}
                              </TableCell>
                              <TableCell>{lastDate || '-'}</TableCell>
                              <TableCell align="right">
                                <Button 
                                  variant="outlined" 
                                  size="small" 
                                  disabled={!hasSensors}
                                  onClick={() => {
                                    setCalibrationRoom(room);
                                    setCalibrationSensor(roomSensors.length > 0 ? roomSensors[0] : null);
                                    setCalibrationWizardOpen(true);
                                  }}
                                >
                                  Calibra
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {rooms.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                              Nessuna stanza configurata
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
              {settingsSection === 'devices' && (
                <Box sx={{ width: '100%', maxWidth: 800 }}>
                  <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">Gestione Dispositivi</Typography>
                  <Card elevation={0} sx={{ mb: 3, border: '1px solid #eee', maxWidth: 800 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Sincronizzazione Home Assistant</Typography>
                      <Typography variant="body2" color="text.secondary" paragraph>Forza un aggiornamento manuale dei dispositivi integrati tramite l'integrazione di Home Assistant.</Typography>
                      <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button variant="contained" color="secondary" onClick={handleSyncHA}>Sincronizza Ora</Button>
                        <Button variant="outlined" color="error" onClick={handleResetTopology}>Reset Planimetria</Button>
                      </Box>
                    </CardContent>
                  </Card>
                  <Card elevation={0} sx={{ border: '1px solid #eee', maxWidth: 800 }}>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>Sensori Z2M Scoperti</Typography>
                      <List disablePadding>
                        {dbSensors.map((sensor) => (
                          <ListItem key={sensor.sensor_id} divider sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <ListItemText primary={sensor.friendly_name || sensor.sensor_id} secondary={`ID: ${sensor.sensor_id}`} />
                              <Switch edge="end" onChange={(e) => updateSensorConfig(sensor.sensor_id, {is_enabled: e.target.checked})} checked={sensor.is_enabled === 1 || sensor.is_enabled === true} />
                            </Box>
                            {(sensor.is_enabled === 1 || sensor.is_enabled === true) && (
                              <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
                                <TextField 
                                  size="small" 
                                  label="Nome Sensore Virtuale (HA)" 
                                  defaultValue={sensor.psf_friendly_name || `PSF ${sensor.friendly_name || sensor.sensor_id}`}
                                  onBlur={(e) => updateSensorConfig(sensor.sensor_id, {psf_friendly_name: e.target.value})}
                                  fullWidth
                                />
                                <Tooltip title="Questo è il nome con cui il sensore ripulito apparirà in Home Assistant tramite l'MQTT Discovery.">
                                  <InfoIcon color="action" />
                                </Tooltip>
                              </Box>
                            )}
                          </ListItem>
                        ))}
                      </List>
                    </CardContent>
                  </Card>
                </Box>
              )}
              {settingsSection === 'ml' && (
                <Box sx={{ width: '100%', maxWidth: 800 }}>
                  <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">Statistiche Machine Learning</Typography>
                  <Card elevation={0} sx={{ border: '1px solid #eee', maxWidth: 800, p: 4 }}>
                    <Typography variant="h6" gutterBottom>Stato del Database e Manutenzione</Typography>
                    
                    {systemStatus ? (
                      <Box sx={{ mt: 3, mb: 4 }}>
                        <Grid container spacing={3}>
                          <Grid item xs={4}>
                            <Typography color="text.secondary" variant="body2">Dimensione DB</Typography>
                            <Typography variant="h5">{systemStatus.db_size_mb} MB</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography color="text.secondary" variant="body2">Eventi Sensori (Memoria)</Typography>
                            <Typography variant="h5">{systemStatus.sensor_events_count}</Typography>
                          </Grid>
                          <Grid item xs={4}>
                            <Typography color="text.secondary" variant="body2">Allarmi Registrati</Typography>
                            <Typography variant="h5">{systemStatus.alarmo_events_count}</Typography>
                          </Grid>
                        </Grid>

                        <Box sx={{ mt: 5 }}>
                          <Typography variant="subtitle1" gutterBottom>
                            Ritenzione Dati Telemetria (Giorni)
                          </Typography>
                          <Typography variant="body2" color="text.secondary" paragraph>
                            I dati più vecchi di questo limite verranno eliminati automaticamente ogni notte per non saturare la memoria. I modelli ML verranno riaddestrati giornalmente.
                          </Typography>
                          <Slider
                            value={pendingRetention}
                            min={1}
                            max={365}
                            step={1}
                            marks={[
                              { value: 1, label: '1g' },
                              { value: 30, label: '1m' },
                              { value: 180, label: '6m' },
                              { value: 365, label: '1a' }
                            ]}
                            onChange={(e, val) => setPendingRetention(val)}
                            valueLabelDisplay="auto"
                          />
                          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button 
                              variant="contained" 
                              color="primary" 
                              startIcon={<SaveIcon />}
                              onClick={() => updateDbRetention(pendingRetention)}
                            >
                              Salva ed Esegui Pulizia
                            </Button>
                          </Box>
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary">Caricamento stato database...</Typography>
                    )}
                  </Card>
                </Box>
              )}
              {settingsSection === 'security' && (
                <Box sx={{ width: '100%', maxWidth: 1000 }}>
                  <Typography variant="h4" gutterBottom fontWeight="bold" color="primary">Sicurezza e Eventi Alarmo</Typography>
                  <Typography variant="body1" color="text.secondary" paragraph>
                    Da qui puoi revisionare gli allarmi scattati in Home Assistant e segnalare eventuali falsi positivi per addestrare i Sensori Virtuali PSF a ignorarli in futuro.
                  </Typography>
                  <AlarmReviewPanel basePath={basePath} />
                </Box>
              )}
            </Box>
          )}
        </Box>

        <Dialog open={floorDialogOpen} onClose={() => setFloorDialogOpen(false)}>
          <DialogTitle>Aggiungi Nuovo Piano</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Nome del Piano" fullWidth variant="standard" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFloorDialogOpen(false)}>Annulla</Button>
            <Button onClick={addFloor}>Aggiungi</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={roomDialogOpen} onClose={() => setRoomDialogOpen(false)}>
          <DialogTitle>Aggiungi Nuova Stanza</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Nome della Stanza" fullWidth variant="standard" value={newRoomName} onChange={e => setNewRoomName(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRoomDialogOpen(false)}>Annulla</Button>
            <Button onClick={addRoom}>Aggiungi</Button>
          </DialogActions>
        </Dialog>

        <CalibrationWizard 
          open={calibrationWizardOpen}
          onClose={() => setCalibrationWizardOpen(false)}
          room={calibrationRoom}
          sensor={calibrationSensor}
          onCalibrationComplete={(sensorId, maxDist, sens) => {
            console.log("Calibration complete:", sensorId, maxDist, sens);
            // Optionally update local sensor state with new params
          }}
        />

      </Box>
    </ThemeProvider>
  );
}

export default App;
