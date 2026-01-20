#!/bin/bash

# 1. Start AI Service (Python) in Background
echo "🚀 Starting AI Service (Python) on port 8001..."
cd /app/ai-service
# Use nohup or just & to run in background
uvicorn main:app --host 0.0.0.0 --port 8001 &

# Store PID of background process
AI_PID=$!

# Wait for AI service to initialize
echo "⏳ Waiting for AI Service to warm up..."
sleep 5

# 2. Start Backend (Node.js) in Foreground
echo "🚀 Starting Backend Server (Node.js) on port $PORT..."
cd /app/server
# Ensure backend knows to look for AI locally
export AI_SERVICE_URL="http://localhost:8001"
node index.js
