FROM python:3.13-slim

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

WORKDIR /app

# Copy unified requirements and install via uv
COPY requirements.txt ./requirements.txt
RUN uv pip install --system --no-cache -r requirements.txt


# Копируем код бэкенда в подпапку /app/backend
COPY backend/ /app/backend/

# Docker CLI + gosu + ffmpeg for media conversions
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends docker-cli gosu ffmpeg \
    && rm -rf /var/lib/apt/lists/* \
    && test -x /usr/bin/docker

# Создаём непривилегированного пользователя
RUN useradd --create-home appuser

# Создаём директорию для загрузок и даём права пользователю
RUN mkdir -p /app/uploads && \
    chown -R appuser:appuser /app/uploads

COPY backend/docker-entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh

WORKDIR /app/backend

EXPOSE 5050

ENTRYPOINT ["/entrypoint.sh"]
CMD ["gunicorn", "-w", "8", "-k", "uvicorn.workers.UvicornWorker", "-b", "0.0.0.0:5050", "--max-requests", "1000", "--max-requests-jitter", "50", "--timeout", "120", "run:app"]

