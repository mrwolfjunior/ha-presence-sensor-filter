# Changelog

## 2.4.0
- **MQTT Discovery**: Risolto il mapping errato dei sensori di contatto (magnetici), che non vengono più esposti come sensori radar di presenza.
- **MQTT Discovery**: Integrazione dinamica dei sensori clone per la Batteria e la Luminosità direttamente nel Discovery di Home Assistant.
- **Calibrazione Automatica**: Settaggio hardware intelligente del radar al massimo della sensibilità (`radar_sensitivity: 10`, `fading_time: 1`) in fase di calibrazione.
- **UX Calibrazione**: La procedura ora gestisce correttamente lo "Step Stanza Vuota" considerando lo zero assoluto di campionamenti (nessun falso positivo) come esito di successo e ricaricando in automatico lo stato sulla dashboard.
- **Prefisso MQTT Parametrico**: Corretto il bug per cui i Virtual Sensor venivano ignorati da Home Assistant se si configurava un prefix Discovery diverso dallo standard `homeassistant` nell'Add-on.
## 2.3.0
- **UI/UX**: Risolto il bug "Sensore Sconosciuto" nei dettagli della stanza. Ora l'interfaccia utilizza correttamente il `friendly_name` personalizzato o nativo del dispositivo.
- **WebSocket/MQTT Realtime**: Aggiunti i dati relativi a batteria (`battery`) e luminosità (`illuminance`) nel payload WebSocket, così da popolare in tempo reale la dashboard React senza bloccarsi su valori "N/D".

## 2.2.0
- **Bugfix (DB)**: Aggiunte migrazioni automatiche `ALTER TABLE` per aggiornare correttamente le planimetrie preesistenti all'ultima versione.
- **Bugfix (MQTT)**: Risolto un bug critico di scope Python (`UnboundLocalError`) che bloccava il flusso di elaborazione MQTT all'avvio.

## 2.1.0
- **Wasp-in-a-box Algorithm**: Migliorata la logica di tracciamento e attraversamento porte con calcolo "Virtual Entry Zones".
- **Porte Finestre**: Possibilità di contrassegnare le finestre come porte finestre, permettendo all'algoritmo di considerarle come varchi per il wasp-in-a-box.
- **Ringhiere e Stanze Aperte**: Nuova opzione per tipologia di muri "Assente (Ringhiera)" con renderizzazione a tratteggio, utile per balconi, logge e ballatoi.
- **Sensori Multipli**: Supporto per l'assegnazione di molteplici sensori magnetici di contatto alla singola porta/finestra tramite UI dinamica e a scomparsa.
- **Gating Addestramento ML**: Il training del modello di Intelligenza Artificiale locale attende ora che la stanza sia stata preventivamente calibrata dal radar.

## 2.0.0
- **Machine Learning Engine**: Integrato modulo Python backend basato su Scikit-Learn per l'auto-apprendimento e il riconoscimento dei falsi positivi.
- **Multi-Target Tracking**: Aggiunto algoritmo *Nearest Neighbor* per distinguere tracciati multipli contemporanei generati da payload MQTT composti.
- **Traiettoria 1D**: Calcolo matematico in real-time della derivata spazio/tempo per identificare la velocità e differenziare target stazionari, in avvicinamento o in allontanamento.
- **Filtro Topologico 1D**: Il sistema calcola dinamicamente le distanze massime (ghosting) utilizzando le proporzioni della mappa 3D per "tagliare" le onde radio che escono dai muri fisici.
- **Auto-Training**: Modelli Random Forest auto-addestrati ogni notte su base individuale per ogni sensore, in base agli eventi registrati su SQLite e classificati tramite l'interfaccia UI.
- **Integrazione Alarmo**: Nuova Dashboard React per revisionare visivamente gli allarmi Home Assistant e marcare i target specifici come "falsi positivi" per addestrare il modello ML.
- **Gestione Memoria DB**: Introdotto uno slider visivo per la Data Retention (da 1 a 365 giorni), che auto-cancella vecchie telemetrie e ottimizza il database locale tramite VACUUM per i dispositivi embedded.
- **Architettura**: Transizione completa in Add-on multi-container (FastAPI Backend + React Three.js Frontend + SQLite + Mosquitto).
## 1.2.0
- UX: Implementato lo Zoom & Pan per la Blueprint.
- UX: Aggiunta scala di misura (metri) in sovrimpressione.
- UX: Disposizione "Staging" inziale orizzontale delle stanze sincronizzate.
- UX: Ritaglio automatico del cono radar sui bordi della stanza (Wall Clipping).
- UX: Snapping e magnetismo delle porte con calcolo orientamento (rotazione muri).
- UX: Auto-assegnamento automatico stanza quando si trascina il sensore sulla Blueprint.

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
