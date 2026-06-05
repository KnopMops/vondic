FROM python:3.13-slim

WORKDIR /app

# Копируем общий файл зависимостей и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код бэкенда в подпапку /app/backend
COPY backend/ /app/backend/

# Docker CLI + gosu (entrypoint подстраивает GID под docker.sock)
USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends docker-cli gosu \
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
CMD ["python", "-m", "gunicorn", "-w", "4", "-b", "0.0.0.0:5050", "run:app"]
