FROM node:18

# Install IPFS
RUN wget https://dist.ipfs.tech/kubo/v0.22.0/kubo_v0.22.0_linux-amd64.tar.gz && \
    tar -xvzf kubo_v0.22.0_linux-amd64.tar.gz && \
    cd kubo && \
    bash install.sh && \
    ipfs init && \
    rm -rf ../kubo_v0.22.0_linux-amd64.tar.gz

# Install supervisor to manage multiple processes
RUN apt-get update && apt-get install -y supervisor

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Setup supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Expose ports
EXPOSE 3000 8545 5001 8080

# Start supervisor as the main process
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]