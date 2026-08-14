FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy requirements and install via uv (without botiksdk)
COPY requirements.txt .
RUN uv pip install --system --no-cache -r requirements.txt && \
    uv pip uninstall --system botiksdk 2>/dev/null || true

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
