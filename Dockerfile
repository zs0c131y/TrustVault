# Use a smaller, more reliable base image
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files first for better caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Use Railway's dynamic port
ENV PORT=3000
EXPOSE $PORT

# Start the application
CMD ["node", "server.js"]
