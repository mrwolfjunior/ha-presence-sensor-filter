import React, { useState, useEffect, useRef } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, 
  Stepper, Step, StepLabel, Box, CircularProgress, TextField, Alert, IconButton
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

const basePath = window.location.pathname.replace(/\/$/, "");

const steps = [
  'Reset Sensore',
  'Rumore di Fondo',
  'Camminata Lenta (Bordi)',
  'Test Statico (Centro)',
  'Elaborazione Dati',
  'Applica Configurazione'
];

export default function CalibrationWizard({ open, onClose, room, sensor, onCalibrationComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [stepFeedback, setStepFeedback] = useState(null); // {status, quality, message}
  const [recommendedConfig, setRecommendedConfig] = useState(null); // {max_distance, sensitivity}
  const timerRef = useRef(null);

  const getStepName = (stepIndex) => {
    switch (stepIndex) {
      case 1: return 'empty_room';
      case 2: return 'perimeter';
      case 3: return 'static';
      default: return '';
    }
  };

  useEffect(() => {
    if (isRecording) {
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 179) {
            handleStopRecording();
            return 180;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  if (!room || !sensor) return null;

  const handleNext = async () => {
    if (activeStep === 0) {
      // Step 0: Reset Sensore
      setIsProcessing(true);
      try {
        const res = await fetch(`${basePath}/api/calibrate/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: 'reset', sensor_id: sensor.sensor_id })
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          const errMsg = errData.error || errData.traceback || (typeof errData.detail === 'object' ? JSON.stringify(errData.detail) : errData.detail) || `HTTP ${res.status}`;
          throw new Error(errMsg);
        }
        setActiveStep(1);
      } catch (e) {
        alert("Errore: " + e.message);
      } finally {
        setIsProcessing(false);
      }
    } else if (activeStep >= 1 && activeStep <= 3) {
      // Clear feedback and go to next step
      setStepFeedback(null);
      setActiveStep(activeStep + 1);
      if (activeStep + 1 === 4) {
        processCalibration();
      }
    } else if (activeStep === 5) {
      handleApplyConfig();
    }
  };

  const handleBack = () => {
    setStepFeedback(null);
    setRecordingTime(0);
    setIsRecording(false);
    setActiveStep((prev) => prev - 1);
  };

  const isNextDisabled = () => {
    if (isProcessing || isRecording) return true;
    if (activeStep >= 1 && activeStep <= 3) {
      return !stepFeedback;
    }
    return false;
  };

  const handleStartRecording = async () => {
    setRecordingTime(0);
    setIsProcessing(true);
    setStepFeedback(null);
    try {
      if (activeStep === 0) {
        // Imposta il sensore su super sensibile per la calibrazione
        await fetch(`${basePath}/api/sensors/${sensor.sensor_id}/set_mqtt`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            "radar_sensitivity": 10,
            "entry_sensitivity": 10,
            "fading_time": 1
          })
        });
      }

      const res = await fetch(`${basePath}/api/calibrate/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: getStepName(activeStep), sensor_id: sensor.sensor_id })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const errMsg = errData.error || errData.traceback || (typeof errData.detail === 'object' ? JSON.stringify(errData.detail) : errData.detail) || `HTTP ${res.status}`;
        throw new Error(errMsg);
      }
      setIsRecording(true);
    } catch (e) {
      alert("Errore di rete: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStopRecording = async () => {
    if (document.activeElement) {
      document.activeElement.blur();
    }
    setIsRecording(false);
    setIsProcessing(true);
    try {
      const res = await fetch(`${basePath}/api/calibrate/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step: getStepName(activeStep), sensor_id: sensor.sensor_id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.traceback || data.detail || `HTTP ${res.status}`);
      }
      if (data.status === 'success') {
        setStepFeedback({ quality: data.quality, message: data.message });
      } else {
        alert("Errore: " + data.message);
      }
    } catch (e) {
      alert("Errore di rete: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const processCalibration = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${basePath}/api/calibrate/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sensor_id: sensor.sensor_id })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.traceback || data.detail || `HTTP ${res.status}`);
      }
      if (data.status === 'success') {
        setRecommendedConfig(data.recommended_config);
        setActiveStep(5);
      } else {
        alert("Errore elaborazione: " + data.message);
      }
    } catch (e) {
      alert("Errore di rete: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyConfig = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${basePath}/api/sensors/${sensor.sensor_id}/apply_config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recommendedConfig)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.traceback || data.detail || `HTTP ${res.status}`);
      }
      if (data.status === 'success') {
        alert("Configurazione applicata con successo al sensore via MQTT!");
        if (onCalibrationComplete) {
          onCalibrationComplete(sensor.sensor_id, recommendedConfig);
        }
        handleClose();
      }
    } catch (e) {
      alert("Errore di rete: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setIsRecording(false);
    setRecordingTime(0);
    setStepFeedback(null);
    setRecommendedConfig(null);
    setActiveStep(0);
    onClose();
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const renderRecordingControls = () => {
    if (stepFeedback) {
      return (
        <Box sx={{ mt: 3, p: 2, border: '1px solid #ccc', borderRadius: 2 }}>
          <Alert severity={stepFeedback.quality === 'good' ? 'success' : 'warning'}>
            Esito Registrazione: {stepFeedback.message}
          </Alert>
          <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
            <Button variant="outlined" onClick={() => { setStepFeedback(null); setRecordingTime(0); }}>
              Ripeti Registrazione
            </Button>
          </Box>
        </Box>
      );
    }

    if (isRecording) {
      return (
        <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <CircularProgress variant="determinate" value={(recordingTime / 180) * 100} size={80} />
          <Typography variant="h4" sx={{ mt: 2 }}>{formatTime(recordingTime)}</Typography>
          <Typography color="error" variant="caption" sx={{ mt: 1 }}>Max 3 minuti</Typography>
          <Button variant="contained" color="secondary" onClick={handleStopRecording} sx={{ mt: 3 }} size="large">
            Termina Registrazione
          </Button>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Button variant="contained" color="primary" onClick={handleStartRecording} disabled={isProcessing} size="large">
          Avvia Registrazione
        </Button>
      </Box>
    );
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" color="warning.main" gutterBottom>Attenzione!</Typography>
            <Typography>
              Il sensore <strong>{sensor.name || sensor.sensor_id}</strong> verrà ripristinato alla massima sensibilità e massima distanza per raccogliere dati grezzi. 
            </Typography>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Mappatura Rumore di Fondo</Typography>
            <Typography>
              Esci dalla stanza ({room.name}) e non muoverti vicino alla porta per almeno 15 secondi. 
            </Typography>
            {renderRecordingControls()}
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Mappatura Confini</Typography>
            <Typography>
              Entra nella stanza e cammina <strong>molto lentamente</strong> rasente i muri. Una volta completato tutto il perimetro, clicca su "Termina Registrazione".
            </Typography>
            {renderRecordingControls()}
          </Box>
        );
      case 3:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>Test Statico</Typography>
            <Typography>
              Siediti o stai fermo in piedi per circa 30-40 secondi.
            </Typography>
            {renderRecordingControls()}
          </Box>
        );
      case 4:
        return (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>Elaborazione Dati ML in corso...</Typography>
            <CircularProgress sx={{ mt: 2 }} />
          </Box>
        );
      case 5:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom color="success.main">
              Calibrazione Completata!
            </Typography>
            <Typography sx={{ mb: 3 }}>
              In base ai dati raccolti, abbiamo elaborato questa configurazione ottimale. Puoi modificarla prima di applicarla al sensore.
            </Typography>
            {recommendedConfig && (
              <Box sx={{ display: 'flex', gap: 3, flexDirection: 'column' }}>
                {Object.entries(recommendedConfig).map(([key, value]) => {
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  const step = key.includes('distance') || key.includes('range') ? 0.1 : 1;
                  return (
                    <TextField 
                      key={key}
                      label={label}
                      type="number"
                      inputProps={{ step }}
                      value={value}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setRecommendedConfig({...recommendedConfig, [key]: isNaN(val) ? 0 : val});
                      }}
                      fullWidth
                    />
                  );
                })}
              </Box>
            )}
          </Box>
        );
      default:
        return 'Sconosciuto';
    }
  };

  return (
    <Dialog open={open} onClose={isRecording || isProcessing ? undefined : handleClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ m: 0, p: 2 }}>
        Calibrazione Avanzata: {room.name}
        <IconButton
          aria-label="close"
          onClick={handleClose}
          sx={{
            position: 'absolute',
            right: 8,
            top: 8,
            color: (theme) => theme.palette.grey[500],
          }}
          disabled={isRecording || isProcessing}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 2, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {getStepContent(activeStep)}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        {activeStep !== 4 && (
          <Button 
            onClick={handleBack} 
            disabled={activeStep === 0 || activeStep === 5 || isRecording || isProcessing}
            sx={{ mr: 'auto' }}
          >
            Indietro
          </Button>
        )}
        {activeStep !== 4 && (
          <Button 
            variant="contained" 
            onClick={handleNext} 
            disabled={isNextDisabled()}
          >
            {activeStep === 5 ? (isProcessing ? 'Salvataggio...' : 'Salva') : 'Avanti'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
