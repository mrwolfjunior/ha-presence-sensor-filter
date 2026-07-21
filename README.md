# TS0601 Presence Sensor Filter AI (v2.1)

Questo Add-on per Home Assistant trasforma i tuoi sensori di presenza radar mmWave Tuya TS0601 (collegati tramite Zigbee2MQTT) in un **Motore di Consapevolezza Spaziale Multi-Sensore con AI**, rendendoli estremamente immuni ai falsi positivi (es. tende, ventilatori, o "ghosting" dietro i muri) e perfetti per l'uso all'interno di un sistema di allarme (come Alarmo).

L'add-on espone un'interfaccia utente web (Ingress) in 3D costruita in React/Three.js per mappare visivamente le tue stanze, e un potente backend Python (FastAPI + Scikit-Learn) che intercetta i messaggi MQTT grezzi.

## Funzionalità Principali

*   **Machine Learning (Auto-Addestrante)**: Classificazione basata su Random Forest per identificare e sopprimere i falsi positivi. I modelli si auto-addestrano individualmente per ogni sensore di notte usando un DB locale (SQLite).
*   **Multi-Target & Trajectory Tracking**: Invece di limitarsi a sapere se c'è "qualcuno", il motore isola tracciati di distanze contemporanee (algoritmo Nearest Neighbor) calcolandone in real-time la *velocità* (avvicinamento, allontanamento o stazionamento). 
*   **Topologia 1D Anti-Ghosting**: L'UI ti permette di disegnare la planimetria 3D delle tue stanze. Il backend calcola matematicamente le dimensioni della stanza per invalidare a priori qualsiasi target le cui onde radar siano uscite al di fuori del muro perimetrale.
*   **Wasp-in-a-Box e Handover Avanzato**: Gestione per stanze adiacenti, porte e porte finestre con logica *Virtual Entry Zones*. Il sistema supporta l'assegnamento multiplo di sensori magnetici per gestire ingressi multipli.
*   **Stanze Aperte (Ringhiere/Balconi)**: È ora possibile mappare muri "assenti" (visualizzati con tratteggio nel render 3D) che mantengono l'isolamento degli ambienti permettendo un corretto tracking su logge, ballatoi e balconi.
*   **Gating Training AI**: I modelli Random Forest avviano il training di falsi positivi solo quando l'algoritmo rileva che la stanza è stata completamente calibrata (mappatura del cono d'ombra radar).
*   **Integrazione Alarmo Nativia**: Nel pannello "Sicurezza e Eventi", l'Add-on legge direttamente gli scatti anomali di Alarmo permettendoti di segnarli visivamente come "Falsi Positivi". Questa azione nutrirà l'AI per impedire che l'evento si ripeta alla stessa distanza/velocità.
*   **MQTT Discovery**: I sensori filtrati vengono esposti automaticamente su Home Assistant come sensori puliti, pronti all'uso nelle automazioni, senza nessun YAML necessario.

## Installazione (Add-on Home Assistant)

Questa non è più una Custom Integration (`custom_components`), ma un vero e proprio **Add-on** che gira nel suo container Docker isolato.

1. Vai su **Impostazioni** -> **Componenti aggiuntivi** -> **Raccolta componenti aggiuntivi**.
2. Clicca sui 3 puntini in alto a destra e seleziona **Repository**.
3. Aggiungi l'URL di questo repository su GitHub.
4. Trova **Presence Sensor Filter AI** e clicca su Install.
5. Avvia l'Add-on e clicca su **Apri l'interfaccia utente WEB**.

La UI si presenterà con una mappa 3D in cui potrai importare i sensori direttamente da Zigbee2MQTT tramite il tasto "Sincronizza HA". 
Potrai trascinare i muri, definire il FOV (angolo di campo visivo) del radar e abilitare il filtraggio AI. Il resto è gestito magicamente sotto il cofano dal motore Python.

### Addestramento dei Modelli (ML)

L'Add-on raccoglie la telemetria (le distanze e le velocità) all'interno del proprio DB SQLite isolato. I dati non saturano la memoria in quanto c'è un task giornaliero che auto-elimina (TTL) i vecchi record in base allo slider definito nei Settings.

Quando un falso positivo fa scattare erroneamente Alarmo:
1. Apri la UI dell'Add-on.
2. Vai nel Tab "Sicurezza".
3. Clicca la x rossa sul falso evento rilevato.
4. Alle ore 00:00 (o manualmente) il motore prenderà tutti i falsi positivi, confronterà la telemetria e addestrerà il Random Forest isolando le specifiche feature di quell'evento (es. tende mosse dal vento a 1.2m di distanza con velocità oscillante di 0.3m/s). Da lì in poi non verrà più rilevato come persona.
