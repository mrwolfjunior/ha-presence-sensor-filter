# Changelog

## 1.1.0
- Map Revamp: Stanze ridimensionabili e trascinabili in modo interattivo con React-Rnd.
- Toolboxes per trascinare e posizionare sensori, porte e finestre sulla mappa con Drag & Drop.
- Supporto visuale per l'angolo (FOV), orientamento e raggio d'azione del radar di presenza (cono visuale animato).
- Gestione integrata e collegamento automatico dei sensori magnetici per finestre/porte scoperti via Z2M.
- Sidebar contestuale interattiva per visualizzare e modificare al volo le proprietà di un elemento.

## 1.0.10
- Fix `fetch` absolute path error causing 404 on Home Assistant Ingress for Sync HA endpoints.

## 1.0.9
- Add `homeassistant_api: true` permission to fix Home Assistant Core API proxy authorization.
- Added graceful error handling to the UI for 500 status codes.

## 1.0.8
- Moved "Sync HA" button to the Settings Tab.
- Integrated WebSocket fetch from Home Assistant Supervisor to auto-import Floors and Rooms.
- Migrated manual Blueprint UI prompts to Material UI Dialogs.
