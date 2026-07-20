import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';

export default function AlarmReviewPanel({ basePath }) {
  const [events, setEvents] = useState([]);

  const fetchEvents = async () => {
    try {
      const res = await fetch(`${basePath}/api/alarmo/events`);
      const data = await res.json();
      if (Array.isArray(data)) {
        setEvents(data);
      } else {
        console.error("API returned non-array:", data);
        setEvents([]);
      }
    } catch (e) {
      console.error("Failed to fetch alarmo events", e);
      setEvents([]);
    }
  };

  useEffect(() => {
    fetchEvents();
    // Poll every 5s for new alarms
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, [basePath]);

  const resolveEvent = async (eventId, status) => {
    try {
      await fetch(`${basePath}/api/alarmo/events/${eventId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchEvents();
    } catch (e) {
      alert("Failed to resolve event: " + e.message);
    }
  };

  return (
    <Card elevation={0} sx={{ border: '1px solid #eee' }}>
      <CardContent>
        {events.length === 0 ? (
          <Typography variant="body1" color="text.secondary" align="center" sx={{ py: 4 }}>
            Nessun evento di allarme registrato.
          </Typography>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell><b>Data/Ora</b></TableCell>
                  <TableCell><b>Sensore Trigger</b></TableCell>
                  <TableCell><b>Stato</b></TableCell>
                  <TableCell align="right"><b>Classificazione (ML)</b></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {events.map(ev => {
                  let statusChip = <Chip label="In Attesa" color="warning" size="small" />;
                  if (ev.status === 'false_positive') statusChip = <Chip label="Falso Positivo" color="error" size="small" />;
                  if (ev.status === 'true_positive') statusChip = <Chip label="Allarme Reale" color="success" size="small" />;

                  return (
                    <TableRow key={ev.id}>
                      <TableCell>{new Date(ev.timestamp.replace(' ', 'T')).toLocaleString()}</TableCell>
                      <TableCell>{ev.sensor_id}</TableCell>
                      <TableCell>{statusChip}</TableCell>
                      <TableCell align="right">
                        {ev.status === 'unresolved' ? (
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                            <Button 
                              size="small" 
                              color="error" 
                              variant="outlined" 
                              startIcon={<CancelIcon />}
                              onClick={() => resolveEvent(ev.id, 'false_positive')}
                            >
                              Falso Positivo
                            </Button>
                            <Button 
                              size="small" 
                              color="success" 
                              variant="contained"
                              startIcon={<CheckCircleIcon />}
                              onClick={() => resolveEvent(ev.id, 'true_positive')}
                            >
                              Vero Allarme
                            </Button>
                          </Box>
                        ) : (
                          <Typography variant="caption" color="text.secondary">
                            Classificato e salvato nel dataset.
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
