#!/bin/sh
echo "Waiting for backend to be ready..."
max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    # Check if backend responds (any response, not necessarily 200)
    if curl -s --connect-timeout 2 http://backend:5050/api/v1/auth/me > /dev/null 2>&1; then
        echo "Backend is ready!"
        exec python main.py
    fi
    echo "Backend not ready yet, waiting... (attempt $attempt/$max_attempts)"
    attempt=$((attempt + 1))
    sleep 2
done
echo "Backend failed to start, exiting..."
exit 1
