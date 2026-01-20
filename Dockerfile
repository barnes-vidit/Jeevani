# Use Python as base to ensure all compilation tools for AI libs are present
FROM python:3.11-slim

# Install system dependencies + Node.js
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Install Python Dependencies
COPY ai-service/requirements.txt ./ai-service/requirements.txt
RUN pip install --no-cache-dir -r ai-service/requirements.txt

# 2. Install Node Dependencies
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --production
WORKDIR /app

# 3. Copy Source Code
COPY ai-service ./ai-service
COPY server ./server
COPY start_services.sh .

# 4. Final Permissions & Env
RUN chmod +x start_services.sh

ENV PORT=5000
ENV AI_SERVICE_URL=http://localhost:8001

EXPOSE 5000

CMD ["./start_services.sh"]
