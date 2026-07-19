import React, { useState, useEffect } from 'react';
import { 
  Box, Drawer, Button, Typography, TextField, FormControl, InputLabel, 
  Select, MenuItem, IconButton, Card, CardContent, Switch, List, ListItem, ListItemText, CssBaseline, ThemeProvider, createTheme, Chip, Paper
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
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import './index.css';
import Map3D from './components/Map3D';

const basePath = window.location.pathname.replace(/\/$/, "");

const theme = createTheme({
  palette: {
    primary: { main: '#3f51b5' },
    secondary: { main: '#f50057' },
    background: { default: '#f5f5f5' }
  },
  typography: { fontFamily: 'Roboto, sans-serif' }
});

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

  // --- Topology History State ---
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const pushToHistory = (newRooms, newDoors) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ rooms: newRooms, doors: newDoors });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setRooms(newRooms);
    setDoors(newDoors);
  };

  const undo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setRooms(history[newIndex].rooms);
      setDoors(history[newIndex].doors);
    }
  };

  const redo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setRooms(history[newIndex].rooms);
      setDoors(history[newIndex].doors);
    }
  };

  const saveTopology = async () => {
    const current = history[historyIndex];
    if (!current) return;
    try {
      await fetch(`${basePath}/api/topology/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rooms: current.rooms, doors: current.doors })
      });
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
      
      setHistory([{ rooms: roomsData, doors: doorsData }]);
      setHistoryIndex(0);
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

  const addDoorWindow = async (type) => {
    if (!activeFloorId || rooms.filter(r => r.floor_id === activeFloorId).length === 0) {
       alert("Devi prima creare una stanza."); return;
    }
    const defaultRoom = rooms.filter(r => r.floor_id === activeFloorId)[0];
    const newDoor = {
       id: `door_${Date.now()}`, room_id: defaultRoom.id, type: type,
       width: 1, x: defaultRoom.x, y: defaultRoom.y + defaultRoom.height/2, rotation: 0
    };
    pushToHistory(rooms, [...doors, newDoor]);
  };

  const updateRoomLocal = (id, updates) => {
    const newRooms = rooms.map(r => r.id === id ? { ...r, ...updates } : r);
    pushToHistory(newRooms, doors);
  };

  const deleteRoomLocal = (id) => {
    const newRooms = rooms.filter(r => r.id !== id);
    const newDoors = doors.filter(d => d.room_id !== id);
    pushToHistory(newRooms, newDoors);
    if (selectedElement?.id === id) setSelectedElement(null);
  };

  const updateDoorLocal = (id, updates) => {
    const newDoors = doors.map(d => d.id === id ? { ...d, ...updates } : d);
    pushToHistory(rooms, newDoors);
  };

  const deleteDoorLocal = (id) => {
    const newDoors = doors.filter(d => d.id !== id);
    pushToHistory(rooms, newDoors);
    if (selectedElement?.id === id) setSelectedElement(null);
  };

  const updateSensorConfig = async (id, updates) => {
    await fetch(`${basePath}/api/sensors/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    fetchData();
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
      return (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label="Nome" size="small" value={room.name} onChange={(e) => updateRoomLocal(room.id, {name: e.target.value})} />
          <TextField label="Larghezza (m)" size="small" type="number" value={room.width} onChange={(e) => updateRoomLocal(room.id, {width: parseFloat(e.target.value)})} />
          <TextField label="Lunghezza (m)" size="small" type="number" value={room.height} onChange={(e) => updateRoomLocal(room.id, {height: parseFloat(e.target.value)})} />
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

          <Button variant="outlined" color="warning" onClick={() => updateSensorConfig(sensor.sensor_id, {room_id: null})}>
            Rimuovi dalla mappa
          </Button>
        </Box>
      );
    }
    
    if (selectedElement.type === 'door' || selectedElement.type === 'window') {
      const door = doors.find(d => d.id === selectedElement.id);
      if(!door) return null;
      return (
         <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Typography variant="h6">{door.type === 'window' ? 'Finestra' : 'Porta'}</Typography>
          <TextField label="Larghezza (m)" size="small" type="number" value={door.width} onChange={(e) => updateDoorLocal(door.id, {width: parseFloat(e.target.value)})} />
          <Button variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => deleteDoorLocal(door.id)}>Elimina</Button>
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
                    <Button variant="outlined" color="primary" onClick={() => addDoorWindow('door')} disabled={activeRooms.length === 0} startIcon={<MeetingRoomIcon/>}>Aggiungi Porta</Button>
                    <Button variant="outlined" color="primary" onClick={() => addDoorWindow('window')} disabled={activeRooms.length === 0} startIcon={<WindowIcon/>}>Aggiungi Finestra</Button>
                  </Box>
                </Box>

                <Box sx={{ p: 2, flexGrow: 1, overflowY: 'auto' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>Sensori da posizionare</Typography>
                  {unlinkedSensors.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">Tutti i sensori sono posizionati.</Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {unlinkedSensors.map(s => (
                        <Button key={s.sensor_id} variant="outlined" color="info" startIcon={<SensorsIcon />} size="small" sx={{ justifyContent: 'flex-start', textTransform: 'none' }} onClick={() => updateSensorConfig(s.sensor_id, { x: 0, y: 0, room_id: activeRooms[0]?.id || '' })}>
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
                  Gestione Dispositivi
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
                  <IconButton disabled={historyIndex <= 0} onClick={undo} color="primary" size="small">
                    <UndoIcon />
                  </IconButton>
                  <IconButton disabled={historyIndex >= history.length - 1} onClick={redo} color="primary" size="small">
                    <RedoIcon />
                  </IconButton>
                  <Box sx={{ width: '1px', height: 24, bgcolor: '#ccc', mx: 1 }} />
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="small" 
                    startIcon={<SaveIcon />} 
                    onClick={saveTopology}
                    disabled={historyIndex <= 0} 
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
                  updateSensorConfig={updateSensorConfig}
                  updateDoor={updateDoorLocal}
                  deleteRoom={deleteRoomLocal}
                  deleteDoor={deleteDoorLocal}
                  onCameraChange={setCameraZoom}
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
                  <Card elevation={0} sx={{ border: '1px solid #eee', maxWidth: 800, p: 4, textAlign: 'center' }}>
                    <AnalyticsIcon sx={{ fontSize: 60, color: '#ccc', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary">Modulo ML non ancora addestrato</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      Il sistema sta raccogliendo i dati sulle transizioni porta/sensore per valutare i falsi positivi. I modelli saranno disponibili dopo 24h di raccolta dati.
                    </Typography>
                  </Card>
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

      </Box>
    </ThemeProvider>
  );
}

export default App;
