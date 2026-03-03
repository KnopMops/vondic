# Используем официальный образ Python (slim-версия для меньшего размера)
FROM python:3.13-slim

# Устанавливаем рабочую директорию внутри контейнера
WORKDIR /app

# Копируем файл с зависимостями и устанавливаем их
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копируем остальные файлы приложения
COPY . .

# (Рекомендуется) Создаём непривилегированного пользователя и переключаемся на него
RUN useradd --create-home appuser
USER appuser

# Указываем порт, который будет слушать контейнер
#EXPOSE 5050

# Запускаем Flask-приложение через Uvicorn с WSGI-интерфейсом
CMD ["python", "main.py"]