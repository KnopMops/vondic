FROM python:3.13-slim

WORKDIR /app

COPY requirements_a.txt .
RUN pip install --no-cache-dir -r requirements_a.txt

# Копируем код бота в подпапку /app/bot
COPY bot/ /app/bot/

RUN useradd --create-home appuser
USER appuser

WORKDIR /app/bot

CMD ["python", "main.py"]
