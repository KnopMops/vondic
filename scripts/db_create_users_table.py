import sqlite3
import uuid
from datetime import datetime

def create_users_table():
    """Создает таблицу users в базе данных SQLite"""
    
    # Подключаемся к базе данных (или создаем новую)
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # SQL-запрос для создания таблицы users
    create_table_query = '''
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        password_hash TEXT NOT NULL,
        avatar_url TEXT DEFAULT NULL,
        is_verified INTEGER DEFAULT 0,
        socket_id TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    '''
    
    # Создаем таблицу
    cursor.execute(create_table_query)
    
    # Создаем индексы для оптимизации запросов
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_username ON users(username)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_email ON users(email)')
    cursor.execute('CREATE INDEX IF NOT EXISTS idx_access_token ON users(access_token)')
    
    # Фиксируем изменения и закрываем соединение
    conn.commit()
    print("Таблица 'users' успешно создана или уже существует")
    
    conn.close()
    print("Соединение с базой данных закрыто")

def view_users(cursor):
    """Просмотр содержимого таблицы users"""
    cursor.execute('SELECT * FROM users')
    rows = cursor.fetchall()
    
    print("\nСодержимое таблицы users:")
    for row in rows:
        print(row)

if __name__ == "__main__":
    # Создаем таблицу
    create_users_table()
    
    # Дополнительно: просмотр данных
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    view_users(cursor)
    conn.close()