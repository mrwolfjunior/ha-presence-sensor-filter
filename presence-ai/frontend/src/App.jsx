import { useState, useEffect } from 'react';
import { 
  ThemeProvider, createTheme, CssBaseline, 
  AppBar, Toolbar, Typography, Box, Tabs, Tab,
  Card, CardContent, CardActions, Button, Grid, 
  Switch, List, ListItem, ListItemText, ListItemSecondaryAction,
  Chip, CircularProgress, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import RadarIcon from '@mui/icons-material/Radar';
import SettingsIcon from '@mui/icons-material/Settings';
import './index.css';

// Home Assistant inspired theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#03A9F4', // HA Blue
    },
    background: {
      default: '#111111',
      paper: '#1c1c1c',
    },
    success: {
      main: '#4caf50',
    },
    error: {
      main: '#f44336',
    }
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#03A9F4',
          color: '#ffffff'
        }
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        }
      }
    }
  }
});

function App() {
  const [currentTab, setCurrentTab] = useState(0);
  const [sensors, setSensors] = useState({});
  const [connected, setConnected] = useState(false);
  const [selectedSensor, setSelectedSensor] = useState('');
  const [dbSensors, setDbSensors] = useState([]);

  // Fetch sensors config
  const fetchSensors = async () => {
    try {
      const res = await fetch('/api/sensors');
      const data = await res.json();
      setDbSensors(data);
    } catch (e) {
      console.error("Failed to fetch sensors", e);
    }
  };

  useEffect(() => {
    fetchSensors();
  }, []);

  // WebSocket connection
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = host === 'localhost' ? '8000' : window.location.port;
    const basePath = window.location.pathname.replace(/\/$/, "");
    
    // In Home Assistant ingress, the pathname might be /api/hassio_ingress/xxx
    const wsUrl = `${protocol}//${host}:${port}${basePath}/ws`;
    
    let ws = new WebSocket(wsUrl);
    
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'radar_update') {
        setSensors(prev => ({
          ...prev,
          [data.sensor_id]: data
        }));
        // Auto-select first active sensor if none selected
        if (!selectedSensor) {
            setSelectedSensor(data.sensor_id);
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedSensor]);

  const toggleSensor = async (sensor_id, current_state) => {
    try {
      await fetch(`/api/sensors/${sensor_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_enabled: !current_state })
      });
      fetchSensors(); // refresh
    } catch (e) {
      console.error(e);
    }
  };

  const handleCalibrate = () => {
    if (!selectedSensor) return;
    alert(`Iniziata modalità Walk-to-Calibrate per ${selectedSensor}! Cammina lungo i bordi della stanza...`);
    fetch(`/api/calibrate/${selectedSensor}`, { method: 'POST' });
  };

  const activeData = selectedSensor ? sensors[selectedSensor] : null;

  // Radar View
  const renderRadar = () => {
    const MAX_RANGE = 8.0; 
    
    if (!activeData || !activeData.presence) {
        return <div className="radar-sweep" style={{ animationDuration: '6s', opacity: 0.3 }} />;
    }

    const distance = activeData.distance;
    const radiusPercent = (distance / MAX_RANGE) * 50;
    const angle = 45; // Fixed angle for visualization
    
    const targetStyle = {
      top: `calc(50% - ${radiusPercent * Math.cos(angle * Math.PI / 180)}%)`,
      left: `calc(50% + ${radiusPercent * Math.sin(angle * Math.PI / 180)}%)`,
    };

    return (
      <>
        <div className="radar-sweep" />
        <div className={`target-dot ${activeData.ai_filtered_presence ? 'alert' : 'safe'}`} style={targetStyle} />
      </>
    );
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flexGrow: 1, height: '100vh', display: 'flex', flexDirection: 'column' }}>
        
        <AppBar position="static" elevation={0}>
          <Toolbar>
            <RadarIcon sx={{ mr: 2 }} />
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Presence Sensor Filter AI
            </Typography>
            <Chip 
              label={connected ? "Connected" : "Offline"} 
              color={connected ? "success" : "error"} 
              size="small" 
              variant="filled"
            />
          </Toolbar>
        </AppBar>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Tabs value={currentTab} onChange={(e, v) => setCurrentTab(v)} centered>
            <Tab icon={<RadarIcon />} label="Dashboard" />
            <Tab icon={<SettingsIcon />} label="Settings" />
          </Tabs>
        </Box>

        <Box sx={{ flexGrow: 1, p: 3, overflow: 'auto' }}>
          {/* DASHBOARD TAB */}
          {currentTab === 0 && (
            <Grid container spacing={3}>
              <Grid item xs={12} md={8}>
                <Card elevation={3}>
                  <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                    <Typography variant="h5" gutterBottom>Radar View</Typography>
                    <Box sx={{ width: '100%', mt: 2 }}>
                      <div className="radar-container">
                        {[25, 50, 75, 100].map(size => (
                          <div key={size} className="radar-ring" style={{ width: `${size}%`, height: `${size}%` }} />
                        ))}
                        {renderRadar()}
                      </div>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>

              <Grid item xs={12} md={4}>
                <Card elevation={3} sx={{ mb: 3 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>Control Panel</Typography>
                    
                    <FormControl fullWidth sx={{ mt: 2, mb: 3 }}>
                      <InputLabel>Select Sensor</InputLabel>
                      <Select
                        value={selectedSensor}
                        label="Select Sensor"
                        onChange={(e) => setSelectedSensor(e.target.value)}
                      >
                        {dbSensors.filter(s => s.is_enabled).length > 0 ? (
                          dbSensors.filter(s => s.is_enabled).map(s => (
                            <MenuItem key={s.sensor_id} value={s.sensor_id}>{s.friendly_name || s.sensor_id}</MenuItem>
                          ))
                        ) : (
                          <MenuItem value="" disabled>No enabled sensors</MenuItem>
                        )}
                        {/* Fallback to show any sensor sending data if not in DB yet */}
                        {Object.keys(sensors).map(id => {
                          if (!dbSensors.find(s => s.sensor_id === id && s.is_enabled)) {
                            return <MenuItem key={id} value={id}>{id} (Live)</MenuItem>
                          }
                          return null;
                        })}
                      </Select>
                    </FormControl>

                    {activeData ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                          <Typography variant="body2" color="text.secondary">Raw Distance</Typography>
                          <Typography variant="h6">{activeData.distance.toFixed(2)}m</Typography>
                        </Box>
                        
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, bgcolor: 'background.default', borderRadius: 2 }}>
                          <Typography variant="body2" color="text.secondary">AI Pipeline Status</Typography>
                          <Chip 
                            label={activeData.ai_filtered_presence ? 'PRESENCE' : 'CLEAR'} 
                            color={activeData.ai_filtered_presence ? 'error' : 'success'} 
                            variant="filled" 
                          />
                        </Box>
                      </Box>
                    ) : (
                      <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 4 }}>
                        Waiting for sensor data...
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button 
                      fullWidth 
                      variant="contained" 
                      onClick={handleCalibrate}
                      disabled={!selectedSensor}
                    >
                      Walk-to-Calibrate
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            </Grid>
          )}

          {/* SETTINGS TAB */}
          {currentTab === 1 && (
            <Card elevation={3} sx={{ maxWidth: 800, mx: 'auto' }}>
              <CardContent>
                <Typography variant="h5" gutterBottom>Discovered Sensors</Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  Below are all the sensors detected on the MQTT topic. Enable the ones you want the AI to filter.
                </Typography>

                <List>
                  {dbSensors.length === 0 && (
                    <Typography variant="body2" sx={{ p: 2, textAlign: 'center' }}>No sensors discovered yet. Make sure Zigbee2MQTT is publishing data.</Typography>
                  )}
                  {dbSensors.map((sensor) => (
                    <ListItem key={sensor.sensor_id} divider>
                      <ListItemText 
                        primary={sensor.friendly_name || sensor.sensor_id} 
                        secondary={`ID: ${sensor.sensor_id} | Calib Offset: ${sensor.calibration_offset}`} 
                      />
                      <ListItemSecondaryAction>
                        <Switch 
                          edge="end" 
                          onChange={() => toggleSensor(sensor.sensor_id, sensor.is_enabled)}
                          checked={sensor.is_enabled === 1 || sensor.is_enabled === true} 
                        />
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))}
                </List>
                
                <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
                  <Button variant="outlined" onClick={fetchSensors}>Refresh List</Button>
                </Box>
              </CardContent>
            </Card>
          )}

        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
