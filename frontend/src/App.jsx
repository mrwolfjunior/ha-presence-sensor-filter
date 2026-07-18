import { useState, useEffect, useRef } from 'react'
import './index.css'

function App() {
  const [sensors, setSensors] = useState({})
  const [connected, setConnected] = useState(false)
  const [selectedSensor, setSelectedSensor] = useState(null)
  
  // WebSocket connection
  useEffect(() => {
    // Determine WS URL based on current host (useful for HA Add-on ingress)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // In development we use 8000, in production it will be routed by Ingress
    const port = host === 'localhost' ? '8000' : window.location.port;
    const wsUrl = `${protocol}//${host}:${port}/ws`;
    
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
        if (!selectedSensor) {
            setSelectedSensor(data.sensor_id);
        }
      }
    };

    return () => {
      ws.close();
    };
  }, [selectedSensor]);

  const activeData = selectedSensor ? sensors[selectedSensor] : null;

  // Render the Radar View
  const renderRadar = () => {
    // Assuming max range is 8 meters
    const MAX_RANGE = 8.0; 
    
    if (!activeData || !activeData.presence) {
        return <div className="radar-sweep" style={{ animationDuration: '6s', opacity: 0.3 }} />;
    }

    const distance = activeData.distance;
    // Map distance to percentage from center (0 to 50%)
    const radiusPercent = (distance / MAX_RANGE) * 50;
    
    // For a single target radar, we just place it randomly on the arc, 
    // or fixed angle since we don't know the angle. Let's fix angle for now.
    const angle = 45; // Fixed angle for TS0601 representation
    
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

  const handleCalibrate = () => {
    if (!selectedSensor) return;
    alert(`Iniziata modalità Walk-to-Calibrate per ${selectedSensor}! Cammina lungo i bordi della stanza...`);
    // Here we would call the REST API to start calibration mode
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>Presence AI</h1>
        <div className="badge">
          <div className={`dot ${connected ? 'connected' : 'disconnected'}`}></div>
          {connected ? 'Live' : 'Offline'}
        </div>
      </header>

      <main className="dashboard">
        <section className="glass-panel">
          <div className="radar-container">
             {/* Draw concentric rings */}
            {[25, 50, 75, 100].map(size => (
              <div key={size} className="radar-ring" style={{ width: `${size}%`, height: `${size}%` }} />
            ))}
            
            {renderRadar()}
          </div>
        </section>

        <section className="info-panel">
          <div className="glass-panel status-card">
            <div className="status-label">Sensore Selezionato</div>
            <div className="status-value" style={{ fontSize: '1.5rem' }}>
                {selectedSensor || "In attesa di dati..."}
            </div>
          </div>

          {activeData && (
            <>
              <div className="glass-panel status-card">
                <div className="status-label">Distanza Attuale</div>
                <div className="status-value">{activeData.distance.toFixed(2)}m</div>
              </div>

              <div className="glass-panel status-card">
                <div className="status-label">Stato AI (Pipeline ML)</div>
                <div className={`status-value ${activeData.ai_filtered_presence ? 'value-alert' : 'value-safe'}`}>
                  {activeData.ai_filtered_presence ? 'PRESENZA' : 'CLEAR'}
                </div>
              </div>

              <button className="btn-primary" onClick={handleCalibrate}>
                 Walk-to-Calibrate
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
