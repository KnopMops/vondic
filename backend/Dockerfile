FROM python:3.13-slim

WORKDIR /app

# Копируем общий файл зависимостей и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем код бэкенда в подпапку /app/backend
COPY backend/ /app/backend/

# Создаём непривилегированного пользователя
RUN useradd --create-home appuser

# Создаём директорию для загрузок и даём права пользователю
RUN mkdir -p /app/uploads && \
    chown -R appuser:appuser /app/uploads

USER appuser

# Переходим в папку с кодом
WORKDIR /app/backend

EXPOSE 5050

# Запускаем приложение (файл run.py теперь лежит в /app/backend)
CMD ["python", "run.py"]
