import { useState, useEffect } from 'react';
import { 
  ThemeProvider, createTheme, CssBaseline, 
  AppBar, Toolbar, Typography, Box, Tabs, Tab,
  Card, CardContent, Button, Grid, 
  List, ListItem, ListItemText, ListItemSecondaryAction,
  Chip, Select, MenuItem, FormControl, InputLabel, TextField, Switch, IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RadarIcon from '@mui/icons-material/Radar';
import SettingsIcon from '@mui/icons-material/Settings';
import MapIcon from '@mui/icons-material/Map';
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

function App() {
  const [currentTab, setCurrentTab] = useState(0); // 0: Blueprint, 1: Settings
  const [connected, setConnected] = useState(false);
  
  // Data states
  const [sensors, setSensors] = useState({}); // Live MQTT Data
  const [dbSensors, setDbSensors] = useState([]); // Configured sensors
  const [floors, setFloors] = useState([]);
  const [rooms, setRooms] = useState([]);
  
  // Selection states
  const [activeFloorId, setActiveFloorId] = useState('');
  
  // Fetch routines
  const fetchData = async () => {
    try {
      const [fRes, rRes, sRes] = await Promise.all([
        fetch('/api/floors'), fetch('/api/rooms'), fetch('/api/sensors')
      ]);
      const fData = await fRes.json();
      const rData = await rRes.json();
      const sData = await sRes.json();
      setFloors(fData);
      setRooms(rData);
      setDbSensors(sData);
      if (fData.length > 0 && !activeFloorId) setActiveFloorId(fData[0].id);
    } catch (e) {
      console.error("Failed to fetch data", e);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // WebSocket
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = window.location.port; 
    const basePath = window.location.pathname.replace(/\/$/, "");
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
  const handleAddFloor = async () => {
    const name = prompt("Nome del piano (es. Piano Terra):");
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await fetch('/api/floors', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, level: floors.length })
    });
    fetchData();
  };

  const handleDeleteFloor = async (id) => {
    await fetch(`/api/floors/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const handleAddRoom = async () => {
    if (!activeFloorId) return alert("Seleziona un piano prima!");
    const name = prompt("Nome della stanza (es. Salotto):");
    if (!name) return;
    const id = name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    await fetch('/api/rooms', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, name, floor_id: activeFloorId, ha_area_id: '', width: 4.0, height: 4.0, x: 0.0, y: 0.0 })
    });
    fetchData();
  };

  const toggleSensor = async (sensor_id, is_enabled) => {
    await fetch(`/api/sensors/${sensor_id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_enabled: !is_enabled })
    });
    fetchData();
  };

  const updateSensorConfig = async (sensor_id, field, value) => {
    await fetch(`/api/sensors/${sensor_id}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value })
    });
    fetchData();
  };

  // Blueprint Rendering
  const activeRooms = rooms.filter(r => r.floor_id === activeFloorId);
  
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
            <Tab icon={<MapIcon />} label="Blueprint" />
            <Tab icon={<SettingsIcon />} label="Settings & Sensors" />
          </Tabs>
        </Box>

        <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          
          {/* TAB 0: BLUEPRINT */}
          {currentTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card elevation={3} sx={{ height: '100%', minHeight: 500, p: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Tabs value={activeFloorId} onChange={(e, v) => setActiveFloorId(v)}>
                      {floors.map(f => <Tab key={f.id} value={f.id} label={f.name} />)}
                    </Tabs>
                    <Button variant="outlined" onClick={handleAddFloor}>+ Piano</Button>
                  </Box>
                  
                  {/* The actual Blueprint Area */}
                  <Box sx={{ 
                    position: 'relative', width: '100%', height: 'calc(100% - 60px)', 
                    bgcolor: '#222', border: '1px solid #333', borderRadius: 2, overflow: 'hidden'
                  }}>
                    {activeFloorId ? activeRooms.map(room => (
                      <Box key={room.id} sx={{
                        position: 'absolute',
                        left: `${room.x * 50}px`, top: `${room.y * 50}px`,
                        width: `${room.width * 50}px`, height: `${room.height * 50}px`,
                        border: '2px solid #03A9F4', bgcolor: 'rgba(3, 169, 244, 0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <Typography variant="caption" color="primary">{room.name}</Typography>
                      </Box>
                    )) : (
                      <Typography align="center" sx={{ mt: 10 }}>Aggiungi un piano per iniziare</Typography>
                    )}

                    {/* Render Sensors inside their rooms */}
                    {dbSensors.filter(s => s.is_enabled && activeRooms.some(r => r.id === s.room_id)).map(s => {
                      const room = activeRooms.find(r => r.id === s.room_id);
                      const liveData = sensors[s.sensor_id];
                      const isPresent = liveData?.presence;
                      
                      return (
                        <Box key={s.sensor_id} sx={{
                          position: 'absolute',
                          left: `${(room.x + s.x) * 50}px`, top: `${(room.y + s.y) * 50}px`,
                          width: 12, height: 12, borderRadius: '50%',
                          bgcolor: isPresent ? '#f44336' : '#4caf50',
                          transform: 'translate(-50%, -50%)',
                          boxShadow: `0 0 10px ${isPresent ? '#f44336' : '#4caf50'}`
                        }} />
                      );
                    })}
                  </Box>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card elevation={3} sx={{ mb: 3 }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                      <Typography variant="h6">Stanze</Typography>
                      <Button size="small" onClick={handleAddRoom}>+ Stanza</Button>
                    </Box>
                    <List dense>
                      {activeRooms.map(r => (
                        <ListItem key={r.id}>
                          <ListItemText primary={r.name} secondary={`${r.width}m x ${r.height}m`} />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>

                <Card elevation={3}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Sensori nel Piano</Typography>
                    {dbSensors.filter(s => s.is_enabled).map(s => {
                      const liveData = sensors[s.sensor_id];
                      return (
                        <Box key={s.sensor_id} sx={{ mb: 3, p: 2, bgcolor: '#2a2a2a', borderRadius: 2 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Typography variant="subtitle2">{s.friendly_name || s.sensor_id}</Typography>
                            <Chip size="small" label={liveData?.presence ? 'PRESENZA' : 'CLEAR'} color={liveData?.presence ? 'error' : 'success'} />
                          </Box>
                          <FormControl fullWidth size="small" sx={{ mt: 2 }}>
                            <InputLabel>Assegna a Stanza</InputLabel>
                            <Select 
                              value={s.room_id || ''} 
                              label="Assegna a Stanza"
                              onChange={(e) => updateSensorConfig(s.sensor_id, 'room_id', e.target.value)}
                            >
                              <MenuItem value="">Nessuna</MenuItem>
                              {rooms.map(r => <MenuItem key={r.id} value={r.id}>{r.name}</MenuItem>)}
                            </Select>
                          </FormControl>
                          <Grid container spacing={1} sx={{ mt: 1 }}>
                            <Grid item xs={6}>
                              <TextField size="small" label="Pos X (metri)" type="number" value={s.x || 0} onChange={(e) => updateSensorConfig(s.sensor_id, 'x', parseFloat(e.target.value))} />
                            </Grid>
                            <Grid item xs={6}>
                              <TextField size="small" label="Pos Y (metri)" type="number" value={s.y || 0} onChange={(e) => updateSensorConfig(s.sensor_id, 'y', parseFloat(e.target.value))} />
                            </Grid>
                          </Grid>
                        </Box>
                      );
                    })}
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* TAB 1: SETTINGS */}
          {currentTab === 1 && (
            <Card elevation={3} sx={{ maxWidth: 800, mx: 'auto' }}>
              <CardContent>
                <Typography variant="h5" gutterBottom>Gestione Sensori Scoperti</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Abilita i sensori Zigbee2MQTT su cui vuoi applicare il filtro AI e piazzare nella Blueprint.
                </Typography>
                <List>
                  {dbSensors.map((sensor) => (
                    <ListItem key={sensor.sensor_id} divider>
                      <ListItemText primary={sensor.friendly_name || sensor.sensor_id} />
                      <ListItemSecondaryAction>
                        <Switch edge="end" onChange={() => toggleSensor(sensor.sensor_id, sensor.is_enabled)} checked={sensor.is_enabled === 1 || sensor.is_enabled === true} />
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
