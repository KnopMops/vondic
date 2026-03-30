FROM python:3.13-slim

WORKDIR /app

# Copy requirements and install (without botiksdk)
COPY bot/requirements_a.txt .
RUN pip install --no-cache-dir -r requirements_a.txt && \
    pip uninstall -y botiksdk 2>/dev/null || true

# Copy botiksdk first (local package)
COPY botiksdk/ /app/botiksdk/

# Copy bot code
COPY bot/ /app/bot/

WORKDIR /app/bot

# Use local botiksdk - PYTHONPATH should point to parent directory
ENV PYTHONPATH=/app:$PYTHONPATH

# Install curl for healthcheck
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*

# Copy wait script
COPY bot/wait-for-backend.sh /wait-for-backend.sh
RUN chmod +x /wait-for-backend.sh

CMD ["/wait-for-backend.sh"]
