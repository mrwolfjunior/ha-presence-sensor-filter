#!/usr/bin/with-contenv bashio

bashio::log.info "Starting Presence Sensor Filter AI..."

# Start the Python backend in the background
bashio::log.info "Starting Python Backend..."
cd /backend
python3 main.py &

# Start a simple HTTP server to serve the React frontend on the Ingress port (8099)
bashio::log.info "Serving Frontend UI..."
cd /frontend/dist
python3 -m http.server 8099
