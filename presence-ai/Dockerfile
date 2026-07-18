ARG BUILD_FROM=ghcr.io/hassio-addons/base:14.3.1
FROM $BUILD_FROM

# Install prerequisites
RUN \
  apk add --no-cache \
    python3 \
    py3-pip \
    py3-scikit-learn \
    py3-pandas \
    py3-numpy \
    nodejs \
    npm

# Copy root filesystem
COPY run.sh /
COPY backend /backend
COPY frontend /frontend

# Setup backend
WORKDIR /backend
RUN pip3 install --no-cache-dir -r requirements.txt --break-system-packages

# Setup frontend
WORKDIR /frontend
RUN npm install
RUN npm run build

# Make the run script executable
WORKDIR /
RUN chmod a+x /run.sh

CMD [ "/run.sh" ]
