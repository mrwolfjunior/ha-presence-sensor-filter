import { useState, useEffect } from 'react';
import { 
  ThemeProvider, createTheme, CssBaseline, 
  AppBar, Toolbar, Typography, Box, Tabs, Tab,
  Card, CardContent, Button, Grid, 
  List, ListItem, ListItemText, ListItemSecondaryAction,
  Chip, Select, MenuItem, FormControl, InputLabel, TextField, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Drawer, Divider, IconButton
} from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import SettingsIcon from '@mui/icons-material/Settings';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import WindowIcon from '@mui/icons-material/Window';
import SensorsIcon from '@mui/icons-material/Sensors';
import DeleteIcon from '@mui/icons-material/Delete';
import { Rnd } from 'react-rnd';
import './index.css';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#03A9F4' },
    background: { default: '#111111', paper: '#1c1c1c' },
    success: { main: '#4caf50' },
    error: { main: '#f44336' }
  },
  components: {
    MuiAppBar: { styleOverrides: { root: { backgroundColor: '#03A9F4', color: '#ffffff' } } },
    MuiCard: { styleOverrides: { root: { borderRadius: 12 } } }
  }
});

const PIXELS_PER_METER = 50;

function App() {
  const [currentTab, setCurrentTab] = useState(0); 
  const [connected, setConnected] = useState(false);
  
  const basePath = window.location.pathname.replace(/\/$/, "");
  
  // Data states
  const [sensors, setSensors] = useState({}); 
  const [dbSensors, setDbSensors] = useState([]); 
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [doors, setDoors] = useState([]);
  
  // Selection states
  const [activeFloorId, setActiveFloorId] = useState('');
  const [selectedElement, setSelectedElement] = useState(null); 
  // { type: 'room'|'sensor'|'door', id: string }

  // Dialog States
  const [floorDialogOpen, setFloorDialogOpen] = useState(false);
  const [floorName, setFloorName] = useState('');
  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [roomName, setRoomName] = useState('');
  
  // Fetch routines
  const fetchData = async () => {
    try {
      const [fRes, rRes, sRes, dRes] = await Promise.all([
        fetch(`${basePath}/api/floors`), fetch(`${basePath}/api/rooms`), fetch(`${basePath}/api/sensors`), fetch(`${basePath}/api/doors`)
      ]);
      const fData = await fRes.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      const dData = await dRes.json();
      
      setFloors(fData);
      setRooms(rData);
      setDbSensors(sData);
      setDoors(dData);
      
      if (fData.length > 0 && !activeFloorId) {
        setActiveFloorId(fData[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  useEffect(() => { fetchData(); }, [activeFloorId]);

  // WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port; 
    const wsUrl = `${protocol}//${host}:${port}${basePath}/ws`;
    
    let ws = new WebSocket(wsUrl);
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'radar_update') {
        setSensors(prev => ({ ...prev, [data.sensor_id]: data }));
      }
    };
    return () => ws.close();
  }, []);

  // API Handlers
  const handleAddFloorSubmit = async () => {
    if (!floorName) return;
    const id = floorName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await fetch(`${basePath}/api/floors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: floorName, level: floors.length })
    });
    setFloorDialogOpen(false);
    setFloorName('');
    setActiveFloorId(id);
    fetchData();
  };

  const handleAddRoomSubmit = async () => {
    if (!roomName || !activeFloorId) return;
    const id = roomName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await fetch(`${basePath}/api/rooms`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name: roomName, floor_id: activeFloorId, ha_area_id: '', width: 4.0, height: 4.0, x: 0.0, y: 0.0 })
    });
    setRoomDialogOpen(false);
    setRoomName('');
    fetchData();
  };

  const handleSyncHA = async () => {
    try {
      const res = await fetch(`${basePath}/api/sync_ha`, { method: 'POST' });
      const text = await res.text();
      try {
        const data = JSON.parse(text);
        if (data.status === 'success') {
          alert(`Sincronizzati ${data.floors_synced} piani e ${data.areas_synced} stanze da Home Assistant.`);
          fetchData();
        } else {
          alert(`Errore di Sincronizzazione: ${data.message}`);
        }
      } catch (err) {
        alert(`Errore del server (HTTP ${res.status}): ${text.substring(0, 100)}`);
      }
    } catch (e) {
      alert(`Errore di rete: ${e.message}`);
    }
  };

  const updateRoom = async (room_id, updates) => {
    const room = rooms.find(r => r.id === room_id);
    const updated = { ...room, ...updates };
    await fetch(`${basePath}/api/rooms`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    fetchData();
  };

  const updateSensorConfig = async (sensor_id, updates) => {
    await fetch(`${basePath}/api/sensors/${sensor_id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    fetchData();
  };

  const updateDoor = async (door_id, updates) => {
    const door = doors.find(d => d.id === door_id);
    const updated = { ...door, ...updates };
    await fetch(`${basePath}/api/doors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });
    fetchData();
  };

  const addDoorWindow = async (type) => {
    const id = `${type}_${Date.now()}`;
    await fetch(`${basePath}/api/doors`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id, name: `Nuova ${type}`, room_id: activeRooms[0]?.id || '', type, x: 2.0, y: 2.0, width: 1.0, is_magnetic: false, sensor_id: ''
      })
    });
    fetchData();
  };

  // Drag and Drop
  const onDragStart = (e, data) => {
    e.dataTransfer.setData('application/json', JSON.stringify(data));
  };

  const onDropMap = async (e) => {
    e.preventDefault();
    const mapRect = e.currentTarget.getBoundingClientRect();
    const dropX = (e.clientX - mapRect.left) / PIXELS_PER_METER;
    const dropY = (e.clientY - mapRect.top) / PIXELS_PER_METER;
    
    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data.type === 'sensor') {
        // Assegna alla mappa (può restare senza room_id ma avere coordinate, o possiamo calcolare in quale stanza cade)
        const fallingRoom = activeRooms.find(r => 
          dropX >= r.x && dropX <= r.x + r.width &&
          dropY >= r.y && dropY <= r.y + r.height
        );
        
        await updateSensorConfig(data.id, { 
          x: dropX, 
          y: dropY, 
          room_id: fallingRoom ? fallingRoom.id : null 
        });
        setSelectedElement({ type: 'sensor', id: data.id });
      } else if (data.type === 'door' || data.type === 'window') {
        const id = `${data.type}_${Date.now()}`;
        const fallingRoom = activeRooms.find(r => 
          dropX >= r.x && dropX <= r.x + r.width &&
          dropY >= r.y && dropY <= r.y + r.height
        );
        await fetch(`${basePath}/api/doors`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id, name: `Nuova ${data.type}`, room_id: fallingRoom ? fallingRoom.id : '', 
            type: data.type, x: dropX, y: dropY, width: 1.0, is_magnetic: false, sensor_id: ''
          })
        });
        fetchData();
        setSelectedElement({ type: 'door', id });
      }
    } catch(err) {
      console.error(err);
    }
  };

  const activeRooms = rooms.filter(r => r.floor_id === activeFloorId);
  const mapSensors = dbSensors.filter(s => s.is_enabled && (s.room_id ? activeRooms.some(r => r.id === s.room_id) : s.x > 0));
  const unlinkedSensors = dbSensors.filter(s => s.is_enabled && !s.room_id && s.x === 0 && s.y === 0);
  const activeDoors = doors.filter(d => activeRooms.some(r => r.id === d.room_id) || (d.x > 0 && d.y > 0));

  // Render SVG Cone
  const renderCone = (s) => {
    const radius = (s.max_distance || 8.0) * PIXELS_PER_METER;
    const fov = s.fov_angle || 120;
    const heading = s.heading_angle || 0;
    
    // Convert angles
    const startAngle = (heading - fov / 2) * (Math.PI / 180);
    const endAngle = (heading + fov / 2) * (Math.PI / 180);
    
    const x1 = Math.sin(startAngle) * radius;
    const y1 = -Math.cos(startAngle) * radius;
    const x2 = Math.sin(endAngle) * radius;
    const y2 = -Math.cos(endAngle) * radius;
    
    const largeArcFlag = fov > 180 ? 1 : 0;
    const pathData = `M 0 0 L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    const liveData = sensors[s.sensor_id];
    const isPresent = liveData?.presence;

    return (
      <svg style={{ position: 'absolute', top: -radius, left: -radius, width: radius*2, height: radius*2, pointerEvents: 'none' }}>
        <g transform={`translate(${radius}, ${radius})`}>
          <path d={pathData} fill={isPresent ? 'rgba(244, 67, 54, 0.2)' : 'rgba(76, 175, 80, 0.1)'} stroke={isPresent ? '#f44336' : '#4caf50'} strokeWidth="1" strokeDasharray="5,5" />
        </g>
      </svg>
    );
  };

  // Sidebar Properties Panel
  const renderSidebar = () => {
    if (!selectedElement) return <Typography color="text.secondary" align="center" sx={{mt: 4}}>Seleziona un elemento sulla mappa.</Typography>;
    
    if (selectedElement.type === 'room') {
      const room = activeRooms.find(r => r.id === selectedElement.id);
      if(!room) return null;
      return (
        <Box>
          <Typography variant="h6" gutterBottom>Stanza: {room.name}</Typography>
          <TextField fullWidth size="small" label="Nome" value={room.name} onChange={e => updateRoom(room.id, {name: e.target.value})} sx={{mb: 2}} />
          <TextField fullWidth size="small" type="number" label="Larghezza (m)" value={room.width} onChange={e => updateRoom(room.id, {width: parseFloat(e.target.value)})} sx={{mb: 2}} />
          <TextField fullWidth size="small" type="number" label="Lunghezza (m)" value={room.height} onChange={e => updateRoom(room.id, {height: parseFloat(e.target.value)})} sx={{mb: 2}} />
          <Button fullWidth variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => {
            fetch(`${basePath}/api/rooms/${room.id}`, {method:'DELETE'}).then(fetchData);
            setSelectedElement(null);
          }}>Elimina Stanza</Button>
        </Box>
      );
    }
    
    if (selectedElement.type === 'sensor') {
      const s = dbSensors.find(x => x.sensor_id === selectedElement.id);
      if(!s) return null;
      return (
        <Box>
          <Typography variant="h6" gutterBottom>Sensore: {s.friendly_name}</Typography>
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Stanza</InputLabel>
            <Select value={s.room_id || ''} label="Stanza" onChange={e => updateSensorConfig(s.sensor_id, {room_id: e.target.value})}>
              <MenuItem value="">Nessuna</MenuItem>
              {activeRooms.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={6}><TextField fullWidth size="small" type="number" label="X (m)" value={s.x || 0} onChange={e => updateSensorConfig(s.sensor_id, {x: parseFloat(e.target.value)})} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Y (m)" value={s.y || 0} onChange={e => updateSensorConfig(s.sensor_id, {y: parseFloat(e.target.value)})} /></Grid>
          </Grid>
          <TextField fullWidth size="small" type="number" label="Orientamento (Gradi)" value={s.heading_angle || 0} onChange={e => updateSensorConfig(s.sensor_id, {heading_angle: parseFloat(e.target.value)})} sx={{mb: 2}} />
          <TextField fullWidth size="small" type="number" label="FOV (Gradi)" value={s.fov_angle || 120} onChange={e => updateSensorConfig(s.sensor_id, {fov_angle: parseFloat(e.target.value)})} sx={{mb: 2}} />
          <TextField fullWidth size="small" type="number" label="Distanza Max (m)" value={s.max_distance || 8} onChange={e => updateSensorConfig(s.sensor_id, {max_distance: parseFloat(e.target.value)})} sx={{mb: 2}} />
          <Button fullWidth variant="outlined" color="warning" onClick={() => {
            updateSensorConfig(s.sensor_id, {room_id: null, x: 0, y: 0});
            setSelectedElement(null);
          }}>Slega dalla Mappa</Button>
        </Box>
      );
    }

    if (selectedElement.type === 'door') {
      const d = doors.find(x => x.id === selectedElement.id);
      if(!d) return null;
      return (
        <Box>
          <Typography variant="h6" gutterBottom>{d.type === 'door' ? 'Porta' : 'Finestra'}: {d.name}</Typography>
          <TextField fullWidth size="small" label="Nome" value={d.name} onChange={e => updateDoor(d.id, {name: e.target.value})} sx={{mb: 2}} />
          <FormControl fullWidth size="small" sx={{ mb: 2 }}>
            <InputLabel>Stanza</InputLabel>
            <Select value={d.room_id || ''} label="Stanza" onChange={e => updateDoor(d.id, {room_id: e.target.value})}>
              <MenuItem value="">Nessuna</MenuItem>
              {activeRooms.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
            </Select>
          </FormControl>
          <Grid container spacing={1} sx={{ mb: 2 }}>
            <Grid item xs={6}><TextField fullWidth size="small" type="number" label="X (m)" value={d.x || 0} onChange={e => updateDoor(d.id, {x: parseFloat(e.target.value)})} /></Grid>
            <Grid item xs={6}><TextField fullWidth size="small" type="number" label="Y (m)" value={d.y || 0} onChange={e => updateDoor(d.id, {y: parseFloat(e.target.value)})} /></Grid>
          </Grid>
          <TextField fullWidth size="small" type="number" label="Larghezza (m)" value={d.width || 1.0} onChange={e => updateDoor(d.id, {width: parseFloat(e.target.value)})} sx={{mb: 2}} />
          
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
            <Typography variant="body2">Sensore Magnetico Z2M?</Typography>
            <Switch checked={d.is_magnetic || false} onChange={e => updateDoor(d.id, {is_magnetic: e.target.checked})} />
          </Box>
          
          {d.is_magnetic && (
            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
              <InputLabel>Sensore MQTT</InputLabel>
              <Select value={d.sensor_id || ''} label="Sensore MQTT" onChange={e => updateDoor(d.id, {sensor_id: e.target.value})}>
                <MenuItem value="">Nessuno</MenuItem>
                {dbSensors.map(s => <MenuItem key={s.sensor_id} value={s.sensor_id}>{s.friendly_name}</MenuItem>)}
              </Select>
            </FormControl>
          )}

          <Button fullWidth variant="outlined" color="error" startIcon={<DeleteIcon />} onClick={() => {
            fetch(`${basePath}/api/doors/${d.id}`, {method:'DELETE'}).then(fetchData);
            setSelectedElement(null);
          }}>Elimina</Button>
        </Box>
      );
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <MapIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Presence Sensor Filter AI
            </Typography>
            <Chip label={connected ? "Connected" : "Offline"} color={connected ? "success" : "error"} size="small" />
          </Toolbar>
        </AppBar>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} centered>
            <Tab icon={<MapIcon />} label="Blueprint Map" />
            <Tab icon={<SettingsIcon />} label="Settings & Sensori" />
          </Tabs>
        </Box>

        <Box sx={{ flexGrow: 1, overflow: 'hidden', display: 'flex' }}>
          
          {/* TAB 0: BLUEPRINT MAP */}
          {currentTab === 0 && (
            <Box sx={{ display: 'flex', width: '100%', height: '100%' }}>
              
              {/* LEFT TOOLBAR */}
              <Box sx={{ width: 250, bgcolor: '#1a1a1a', borderRight: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
                  <Typography variant="subtitle2" color="text.secondary">PIANI</Typography>
                  <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <Select value={activeFloorId || ''} onChange={e => setActiveFloorId(e.target.value)}>
                      {floors.map(f => <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <Button fullWidth variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => setFloorDialogOpen(true)}>+ Nuovo Piano</Button>
                  <Button fullWidth variant="outlined" size="small" sx={{ mt: 1 }} onClick={() => setRoomDialogOpen(true)} disabled={!activeFloorId}>+ Nuova Stanza</Button>
                </Box>
                
                <Box sx={{ p: 2, borderBottom: '1px solid #333' }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>AGGIUNGI ELEMENTI</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{mb:1}}>Trascina sulla mappa:</Typography>
                  <Box 
                    draggable onDragStart={(e) => onDragStart(e, {type: 'door'})}
                    sx={{ p: 1, mb: 1, border: '1px dashed #666', borderRadius: 1, cursor: 'grab', display: 'flex', alignItems: 'center' }}
                  >
                    <MeetingRoomIcon sx={{mr:1}} /> Porta
                  </Box>
                  <Box 
                    draggable onDragStart={(e) => onDragStart(e, {type: 'window'})}
                    sx={{ p: 1, mb: 1, border: '1px dashed #666', borderRadius: 1, cursor: 'grab', display: 'flex', alignItems: 'center' }}
                  >
                    <WindowIcon sx={{mr:1}} /> Finestra
                  </Box>
                </Box>

                <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>SENSORI SLEGATI</Typography>
                  {unlinkedSensors.length === 0 && <Typography variant="caption" color="text.secondary">Nessun sensore slegato. Abilitali nei settings.</Typography>}
                  {unlinkedSensors.map(s => (
                    <Box 
                      key={s.sensor_id}
                      draggable onDragStart={(e) => onDragStart(e, {type: 'sensor', id: s.sensor_id})}
                      sx={{ p: 1, mb: 1, bgcolor: '#222', border: '1px solid #444', borderRadius: 1, cursor: 'grab', display: 'flex', alignItems: 'center' }}
                    >
                      <SensorsIcon sx={{mr:1, color: '#03A9F4'}} />
                      <Typography variant="body2" noWrap>{s.friendly_name}</Typography>
                    </Box>
                  ))}
                </Box>
              </Box>

              {/* CENTER MAP */}
              <Box sx={{ flexGrow: 1, position: 'relative', bgcolor: '#0a0a0a', overflow: 'hidden' }}
                   onDragOver={e => e.preventDefault()}
                   onDrop={onDropMap}
              >
                {!activeFloorId && (
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <Typography color="text.secondary">Crea o seleziona un piano per iniziare a mappare.</Typography>
                  </Box>
                )}

                {/* Rooms Render */}
                {activeRooms.map(room => (
                  <Rnd
                    key={room.id}
                    size={{ width: room.width * PIXELS_PER_METER, height: room.height * PIXELS_PER_METER }}
                    position={{ x: room.x * PIXELS_PER_METER, y: room.y * PIXELS_PER_METER }}
                    onDragStop={(e, d) => updateRoom(room.id, { x: d.x / PIXELS_PER_METER, y: d.y / PIXELS_PER_METER })}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      updateRoom(room.id, {
                        width: parseInt(ref.style.width, 10) / PIXELS_PER_METER,
                        height: parseInt(ref.style.height, 10) / PIXELS_PER_METER,
                        x: position.x / PIXELS_PER_METER,
                        y: position.y / PIXELS_PER_METER
                      });
                    }}
                    bounds="parent"
                    onClick={() => setSelectedElement({type: 'room', id: room.id})}
                    style={{
                      border: selectedElement?.id === room.id ? '2px solid #fff' : '2px solid #03A9F4',
                      backgroundColor: 'rgba(3, 169, 244, 0.05)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer'
                    }}
                  >
                    <Typography variant="body2" color="primary">{room.name}</Typography>
                  </Rnd>
                ))}

                {/* Doors / Windows Render */}
                {activeDoors.map(door => (
                  <Rnd
                    key={door.id}
                    size={{ width: door.width * PIXELS_PER_METER, height: 10 }}
                    position={{ x: door.x * PIXELS_PER_METER, y: door.y * PIXELS_PER_METER }}
                    onDragStop={(e, d) => updateDoor(door.id, { x: d.x / PIXELS_PER_METER, y: d.y / PIXELS_PER_METER })}
                    onResizeStop={(e, dir, ref, delta, pos) => {
                      updateDoor(door.id, { width: parseInt(ref.style.width, 10) / PIXELS_PER_METER, x: pos.x / PIXELS_PER_METER, y: pos.y / PIXELS_PER_METER });
                    }}
                    bounds="parent"
                    enableResizing={{left: true, right: true, top: false, bottom: false, topRight: false, bottomRight: false, bottomLeft: false, topLeft: false}}
                    onClick={() => setSelectedElement({type: 'door', id: door.id})}
                    style={{
                      border: selectedElement?.id === door.id ? '2px solid #ffeb3b' : '1px solid #aaa',
                      backgroundColor: door.type === 'door' ? '#8d6e63' : '#81d4fa',
                      cursor: 'pointer', zIndex: 10
                    }}
                  />
                ))}

                {/* Sensors Render */}
                {mapSensors.map(s => {
                  const liveData = sensors[s.sensor_id];
                  const isPresent = liveData?.presence;
                  return (
                    <Rnd
                      key={s.sensor_id}
                      size={{ width: 24, height: 24 }}
                      position={{ x: (s.x * PIXELS_PER_METER) - 12, y: (s.y * PIXELS_PER_METER) - 12 }}
                      onDragStop={(e, d) => updateSensorConfig(s.sensor_id, { x: (d.x + 12) / PIXELS_PER_METER, y: (d.y + 12) / PIXELS_PER_METER })}
                      enableResizing={false}
                      bounds="parent"
                      onClick={() => setSelectedElement({type: 'sensor', id: s.sensor_id})}
                      style={{
                        backgroundColor: isPresent ? '#f44336' : '#4caf50',
                        borderRadius: '50%',
                        border: selectedElement?.id === s.sensor_id ? '3px solid #fff' : '2px solid #222',
                        boxShadow: `0 0 15px ${isPresent ? '#f44336' : '#4caf50'}`,
                        cursor: 'pointer', zIndex: 20
                      }}
                    >
                      {renderCone(s)}
                    </Rnd>
                  );
                })}

              </Box>

              {/* RIGHT SIDEBAR */}
              <Box sx={{ width: 300, bgcolor: '#1a1a1a', borderLeft: '1px solid #333', p: 2, overflowY: 'auto' }}>
                <Typography variant="overline" color="text.secondary">PROPRIETÀ</Typography>
                <Divider sx={{ mb: 2 }} />
                {renderSidebar()}
              </Box>

            </Box>
          )}

          {/* TAB 1: SETTINGS */}
          {currentTab === 1 && (
            <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
              <Box sx={{ maxWidth: 800, mx: 'auto' }}>
                <Card elevation={3} sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h5" gutterBottom>Sincronizzazione Home Assistant</Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Importa automaticamente la struttura della tua casa (Piani e Stanze) dal registro di Home Assistant. Le coordinate e dimensioni già configurate verranno mantenute.
                    </Typography>
                    <Button variant="contained" color="secondary" onClick={handleSyncHA} sx={{ mt: 1 }}>
                      Sincronizza Ora
                    </Button>
                  </CardContent>
                </Card>

                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="h5" gutterBottom>Sensori Z2M Scoperti</Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                      Abilita i sensori Zigbee2MQTT su cui vuoi applicare il filtro AI o posizionarli in mappa.
                    </Typography>
                    <List>
                      {dbSensors.map((sensor) => (
                        <ListItem key={sensor.sensor_id} divider sx={{ flexDirection: 'column', alignItems: 'stretch' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <ListItemText primary={sensor.friendly_name || sensor.sensor_id} secondary={`ID: ${sensor.sensor_id}`} />
                            <Switch edge="end" onChange={(e) => updateSensorConfig(sensor.sensor_id, {is_enabled: e.target.checked})} checked={sensor.is_enabled === 1 || sensor.is_enabled === true} />
                          </Box>
                          {(sensor.is_enabled === 1 || sensor.is_enabled === true) && (
                            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
                              <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel>Lega a Stanza</InputLabel>
                                <Select value={sensor.room_id || ''} label="Lega a Stanza" onChange={e => updateSensorConfig(sensor.sensor_id, {room_id: e.target.value})}>
                                  <MenuItem value="">Nessuna (Slegato)</MenuItem>
                                  {rooms.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                                </Select>
                              </FormControl>
                            </Box>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Box>
            </Box>
          )}

        </Box>
        
        {/* DIALOGS */}
        <Dialog open={floorDialogOpen} onClose={() => setFloorDialogOpen(false)}>
          <DialogTitle>Aggiungi Nuovo Piano</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Nome del Piano (es. Piano Terra)" fullWidth variant="standard" value={floorName} onChange={e => setFloorName(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFloorDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleAddFloorSubmit} variant="contained">Aggiungi</Button>
          </DialogActions>
        </Dialog>

        <Dialog open={roomDialogOpen} onClose={() => setRoomDialogOpen(false)}>
          <DialogTitle>Aggiungi Nuova Stanza</DialogTitle>
          <DialogContent>
            <TextField autoFocus margin="dense" label="Nome della Stanza (es. Salotto)" fullWidth variant="standard" value={roomName} onChange={e => setRoomName(e.target.value)} />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRoomDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleAddRoomSubmit} variant="contained">Aggiungi</Button>
          </DialogActions>
        </Dialog>

      </Box>
    </ThemeProvider>
  );
}

export default App;
