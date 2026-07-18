#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Presence Sensor Filter AI..."

# Start the Python backend (which now also serves the frontend via StaticFiles)
bashio::log.info "Starting Python Backend and UI server..."
cd /backend
exec python3 main.py
