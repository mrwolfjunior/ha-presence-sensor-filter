import React, { useState } from 'react';
import { 
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Typography, 
  Stepper, Step, StepLabel, Box, CircularProgress 
} from '@mui/material';

const basePath = window.location.pathname.replace(/\/$/, "");

const steps = [
  'Reset Sensore',
  'Rumore di Fondo',
  'Camminata Lenta (Bordi)',
  'Test Statico (Centro)',
  'Elaborazione Dati'
];

export default function CalibrationWizard({ open, onClose, room, sensor, onCalibrationComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  
  if (!room || !sensor) return null;

  const handleNext = async () => {
    setIsProcessing(true);
    try {
      let stepAction = '';
      if (activeStep === 0) stepAction = 'reset';
      else if (activeStep === 1) stepAction = 'empty_room';
      else if (activeStep === 2) stepAction = 'perimeter';
      else if (activeStep === 3) stepAction = 'static';
      else if (activeStep === 4) stepAction = 'process';

      const res = await fetch(`${basePath}/api/calibrate/wizard`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step: stepAction,
          sensor_id: sensor.sensor_id,
          room_id: room.id
        })
      });
      
      const data = await res.json();
      
      if (activeStep === 4 && data.status === 'success') {
        alert(`Calibrazione completata! Nuovi parametri: Max Distance ${data.new_max_distance}m, Sensitivity ${data.new_sensitivity}%`);
        if (onCalibrationComplete) {
          onCalibrationComplete(sensor.sensor_id, data.new_max_distance, data.new_sensitivity);
        }
        handleClose();
        return;
      }

      setActiveStep((prev) => prev + 1);
    } catch (error) {
      alert("Errore durante la calibrazione: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    setActiveStep(0);
    onClose();
  };

  const getStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" color="warning.main" gutterBottom>
              Attenzione!
            </Typography>
            <Typography>
              Il sensore <strong>{sensor.name || sensor.sensor_id}</strong> verrà ripristinato alla massima sensibilità e massima distanza per raccogliere dati grezzi. 
              L'intelligenza artificiale li analizzerà nei prossimi step.
            </Typography>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Mappatura Rumore di Fondo
            </Typography>
            <Typography>
              Esci dalla stanza ({room.name}) e non muoverti vicino alla porta per almeno 15 secondi. Clicca su "Avvia Registrazione" per iniziare.
            </Typography>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Mappatura Confini
            </Typography>
            <Typography>
              Entra nella stanza e cammina <strong>molto lentamente</strong> rasente i muri per completare tutto il perimetro. Questo permetterà all'algoritmo di ignorare i movimenti che avvengono al di là di questa zona (es. nella stanza adiacente). Clicca su "Avvia Registrazione" e comincia a camminare.
            </Typography>
          </Box>
        );
      case 3:
        return (
          <Box sx={{ mt: 2 }}>
            <Typography variant="h6" gutterBottom>
              Test Statico e Micro-movimenti
            </Typography>
            <Typography>
              Siediti nella tua postazione tipica (divano, sedia da tavolo) o stai fermo in piedi per 30 secondi. Questo calibra la sensibilità per ignorare il rumore mappato allo Step 1, ma mantenere la rilevazione del tuo respiro.
            </Typography>
          </Box>
        );
      case 4:
        return (
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="h6" gutterBottom>
              Elaborazione Dati ML in corso...
            </Typography>
            <Typography sx={{ mb: 2 }}>
              L'IA sta tagliando le distanze fuori dal perimetro ed equilibrando le energie rilevate.
            </Typography>
            <CircularProgress />
          </Box>
        );
      default:
        return 'Sconosciuto';
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
      <DialogTitle>Calibrazione AI: {room.name}</DialogTitle>
      <DialogContent>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mt: 2, mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
        {getStepContent(activeStep)}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={isProcessing}>Annulla</Button>
        <Button onClick={handleNext} variant="contained" color="primary" disabled={isProcessing}>
          {isProcessing ? 'Attendere...' : activeStep === 0 ? 'Conferma e Inizia' : activeStep === steps.length - 1 ? 'Elabora' : 'Avvia Registrazione'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
