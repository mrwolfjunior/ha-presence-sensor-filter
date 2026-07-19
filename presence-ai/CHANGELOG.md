# Changelog

## 1.0.10
- Fix `fetch` absolute path error causing 404 on Home Assistant Ingress for Sync HA endpoints.

## 1.0.9
- Add `homeassistant_api: true` permission to fix Home Assistant Core API proxy authorization.
- Added graceful error handling to the UI for 500 status codes.

## 1.0.8
- Moved "Sync HA" button to the Settings Tab.
- Integrated WebSocket fetch from Home Assistant Supervisor to auto-import Floors and Rooms.
- Migrated manual Blueprint UI prompts to Material UI Dialogs.
