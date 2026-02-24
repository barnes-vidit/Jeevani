#!/bin/bash

# 1. Start AI Service (Python) in Background, capture logs
echo "🚀 Starting AI Service (Python) on port 8001..."
cd /app/ai-service
uvicorn main:app --host 0.0.0.0 --port 8001 > /tmp/ai_service.log 2>&1 &

# Store PID of background process
AI_PID=$!

# Wait and verify AI service started
echo "⏳ Waiting for AI Service to start (PID: $AI_PID)..."
for i in $(seq 1 30); do
    # Check if process is still alive
    if ! kill -0 $AI_PID 2>/dev/null; then
        echo "❌ AI Service crashed! Logs:"
        cat /tmp/ai_service.log
        echo "⚠️  Starting Node server anyway (AI features will be unavailable)..."
        break
    fi
    
    # Check if it's responding
    if curl -s http://localhost:8001/ > /dev/null 2>&1; then
        echo "✅ AI Service is ready!"
        break
    fi
    
    echo "  Attempt $i/30..."
    sleep 2
done

# Show AI service logs for debugging
echo "--- AI Service startup logs ---"
cat /tmp/ai_service.log
echo "--- End AI Service logs ---"

# 2. Start Backend (Node.js) in Foreground
echo "🚀 Starting Backend Server (Node.js) on port $PORT..."
cd /app/server
export AI_SERVICE_URL="http://localhost:8001"
node index.js
