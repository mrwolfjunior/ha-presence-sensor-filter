# TS0601 Advanced Presence Filter per Home Assistant

Questa integrazione custom per Home Assistant (installabile tramite HACS) trasforma i tuoi sensori di presenza radar mmWave Tuya TS0601 (collegati tramite Zigbee2MQTT) in un **Motore di Consapevolezza Spaziale Multi-Sensore**, rendendoli estremamente immuni ai falsi positivi e perfetti per l'uso all'interno di un sistema di allarme (come Alarmo).

## Funzionalità Principali

*   **Finestra di Analisi a 30s**: Il sensore non scatta al primo movimento rilevato. Memorizza un buffer della distanza target nel tempo e valida la traiettoria del movimento. Movimenti casuali, glitch o oggetti statici (come ventilatori) vengono ignorati.
*   **Wasp-in-a-Box (Modalità Perimetrale)**: Nelle stanze perimetrali (salotti, camere), un ladro non può materializzarsi al centro della stanza. Il rilevamento è valido solo se inizia da specifiche "Entry Zones" configurabili (es. vicino alla porta a 1 metro, o alla finestra a 4 metri) per poi spostarsi.
*   **Direzionalità**: Sfruttando la derivata nel tempo della distanza, l'integrazione espone negli attributi se la persona è in **Avvicinamento**, **Allontanamento**, o **Stazionaria**.
*   **Topologia e Handover tra Sensori**: Se colleghi due sensori tra loro, il sistema saprà che una persona che scompare dal bordo del Sensore A è autorizzata a comparire improvvisamente al bordo del Sensore B, bypassando i controlli base per garantire massima fluidità e zero falsi allarmi tra le stanze.
*   **Auto-Training con Alarmo**: Se l'allarme scatta erroneamente, puoi inviare un feedback (tramite i servizi di HA) indicando che era un falso positivo. L'integrazione estrarrà la distanza a cui è avvenuto il falso allarme e creerà permanentemente una "Zona d'ombra" (Blind Zone) per ignorare futuri movimenti a quella esatta distanza.

## Installazione

### Tramite HACS (Consigliato)
1. Apri HACS nel tuo pannello di Home Assistant.
2. Vai su **Integrazioni**.
3. Clicca sui 3 puntini in alto a destra e seleziona **Custom repositories**.
4. Aggiungi l'URL di questo repository e seleziona la categoria `Integration`.
5. Clicca su **Scarica** (Download).
6. Riavvia Home Assistant.

### Manuale
1. Scarica la cartella `custom_components/ts0601_advanced_filter` da questo repository.
2. Copiala all'interno della cartella `custom_components` della tua installazione di Home Assistant (di solito `/config/custom_components/`).
3. Riavvia Home Assistant.

## Configurazione

L'integrazione è configurabile completamente tramite l'Interfaccia Utente (UI) di Home Assistant. Non è necessario modificare il `configuration.yaml`.

1. Vai su **Impostazioni** -> **Dispositivi e servizi**.
2. Clicca su **+ Aggiungi Integrazione** in basso a destra.
3. Cerca **TS0601 Advanced Presence Filter**.

### Parametri di Configurazione

Durante il setup di un sensore, ti verranno richiesti i seguenti dati:
*   **Source Presence**: L'entità binaria originale esposta da Zigbee2MQTT (es. `binary_sensor.presenza_salotto_occupancy`).
*   **Source Distance**: L'entità sensore che riporta la distanza del target esposta da Zigbee2MQTT (es. `sensor.presenza_salotto_target_distance`).
*   **Room Mode**:
    *   *Perimeter (Perimetrale)*: Usa la logica Wasp-in-a-Box. Le presenze devono iniziare nelle Entry Zones per essere valide.
    *   *Passage (Passaggio)*: Disabilita il Wasp-in-a-Box. Utile per corridoi.
*   **Entry Zones**: Range di distanze (in metri) considerati validi come punti d'ingresso per la modalità Perimetrale. Es: `0.0-1.5, 4.0-5.0`.
*   **Buffer Time**: Il tempo (in secondi) di mantenimento in memoria del buffer di distanza per l'analisi (default 30s).

## Automazioni Consigliate

### Auto-Training con Actionable Notifications e Alarmo

Puoi creare un'automazione che ti invia una notifica sul telefono quando Alarmo scatta a causa di un sensore presenza, permettendoti di segnarlo come Falso Positivo con un pulsante, che richiamerà il servizio `ts0601_advanced_filter.mark_false_positive` passando in pasto il sensore colpevole.

*Dettagli sul setup delle Actionable Notifications sono disponibili nella documentazione ufficiale di Home Assistant.*
