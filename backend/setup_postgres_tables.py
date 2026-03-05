#!/usr/bin/env python3
"""
Скрипт для создания всех таблиц в PostgreSQL
Использует данные из .env.backend или автоматически определяет Docker настройки
"""

import os
import sys
import socket
from pathlib import Path

# Добавляем корневую директорию в PYTHONPATH
BASE_DIR = Path(__file__).parent
sys.path.insert(0, str(BASE_DIR))

# Загружаем переменные окружения из .env.backend
env_file = BASE_DIR / ".env.backend"
if env_file.exists():
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                os.environ[key] = value

# Автоопределение Docker PostgreSQL
def auto_detect_docker_postgres():
    """Автоматически определяет настройки Docker PostgreSQL"""
    
    # Если DATABASE_URL указывает на SQLite, заменяем на PostgreSQL
    database_url = os.environ.get('DATABASE_URL', '')
    if database_url.startswith('sqlite'):
        print("🔍 Обнаружена SQLite, переключаюсь на PostgreSQL Docker...")
        
        # Проверяем доступность PostgreSQL в Docker
        postgres_hosts = ['localhost', '127.0.0.1', 'postgres', 'host.docker.internal', '192.168.20.31']
        
        for host in postgres_hosts:
            try:
                # Проверяем соединение
                sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                sock.settimeout(2)
                result = sock.connect_ex((host, 5432))
                sock.close()
                
                if result == 0:
                    print(f"✅ Найден PostgreSQL на {host}:5432")
                    
                    # Обновляем DATABASE_URL
                    new_url = f"postgresql://vondic:vondic123@{host}:5432/vondic"
                    os.environ['DATABASE_URL'] = new_url
                    os.environ['POSTGRES_HOST'] = host
                    os.environ['POSTGRES_PORT'] = '5432'
                    os.environ['POSTGRES_DB'] = 'vondic'
                    os.environ['POSTGRES_USER'] = 'vondic'
                    os.environ['POSTGRES_PASSWORD'] = 'vondic123'
                    
                    print(f"📡 Установлен DATABASE_URL: {new_url}")
                    return True
            except:
                continue
        
        print("❌ PostgreSQL Docker не найден")
        return False
    
    return True

from app import create_app
from app.core.config import Config
from app.core.extensions import db
from sqlalchemy import text

def setup_postgres_tables():
    """Создает все таблицы в PostgreSQL"""
    
    print("🚀 Начинаю создание таблиц в PostgreSQL...")
    
    # Автоопределение Docker PostgreSQL
    if not auto_detect_docker_postgres():
        print("❌ Не удалось определить настройки PostgreSQL")
        return False
    
    # Удаляем флаг пропуска инициализации БД
    os.environ.pop("SKIP_DB_BOOTSTRAP", None)
    
    # Создаем приложение
    app = create_app()
    
    with app.app_context():
        try:
            # Проверяем соединение с БД
            print("📡 Проверяю соединение с PostgreSQL...")
            db.engine.execute(text("SELECT 1"))
            print("✅ Соединение с PostgreSQL установлено")
            
            # Создаем все таблицы
            print("📋 Создаю таблицы...")
            db.create_all()
            print("✅ Основные таблицы созданы")
            
            # Проверяем, что это PostgreSQL
            if db.engine.dialect.name == "postgresql":
                print("🔧 Обнаружена PostgreSQL, выполняю дополнительные миграции...")
                
                # Проверяем существующие колонки в таблице users
                result = db.session.execute(text("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_name = 'users'
                """))
                existing_columns = {row[0] for row in result.fetchall()}
                
                # Список колонок для добавления
                columns_to_add = [
                    ("gifts", "TEXT"),
                    ("storis", "TEXT"), 
                    ("profile_bg_image", "TEXT"),
                    ("blocked_by_admin", "TEXT"),
                    ("is_developer", "INTEGER DEFAULT 0"),
                    ("api_key_hash", "TEXT"),
                    ("api_key", "TEXT"),
                    ("cloud_password_hash", "TEXT"),
                    ("cloud_password_reset_month", "INTEGER DEFAULT NULL"),
                    ("cloud_password_reset_count", "INTEGER DEFAULT 0"),
                    ("storage_bonus", "INTEGER DEFAULT 0"),
                    ("video_channel_id", "TEXT"),
                    ("video_subscribers", "INTEGER DEFAULT 0"),
                ]
                
                # Добавляем недостающие колонки
                for column_name, column_def in columns_to_add:
                    if column_name not in existing_columns:
                        try:
                            print(f"➕ Добавляю колонку {column_name}...")
                            db.session.execute(text(f"ALTER TABLE users ADD COLUMN {column_name} {column_def}"))
                            db.session.commit()
                            print(f"✅ Колонка {column_name} добавлена")
                        except Exception as e:
                            print(f"⚠️  Ошибка при добавлении колонки {column_name}: {e}")
                            db.session.rollback()
                    else:
                        print(f"ℹ️  Колонка {column_name} уже существует")
                
                # Проверяем и создаем индексы
                indexes_to_create = [
                    ("idx_users_email", "users", "email"),
                    ("idx_users_username", "users", "username"),
                    ("idx_users_api_key", "users", "api_key"),
                ]
                
                for index_name, table_name, column_name in indexes_to_create:
                    try:
                        # Проверяем существование индекса
                        result = db.session.execute(text("""
                            SELECT indexname 
                            FROM pg_indexes 
                            WHERE indexname = :index_name
                        """), {"index_name": index_name})
                        
                        if not result.fetchone():
                            print(f"🔍 Создаю индекс {index_name}...")
                            db.session.execute(text(f"CREATE INDEX {index_name} ON {table_name}({column_name})"))
                            db.session.commit()
                            print(f"✅ Индекс {index_name} создан")
                        else:
                            print(f"ℹ️  Индекс {index_name} уже существует")
                    except Exception as e:
                        print(f"⚠️  Ошибка при создании индекса {index_name}: {e}")
                        db.session.rollback()
                
                # Выводим статистику
                print("\n📊 Статистика созданных таблиц:")
                result = db.session.execute(text("""
                    SELECT table_name 
                    FROM information_schema.tables 
                    WHERE table_schema = 'public'
                    ORDER BY table_name
                """))
                tables = [row[0] for row in result.fetchall()]
                
                for table in tables:
                    result = db.session.execute(text(f"""
                        SELECT COUNT(*) 
                        FROM information_schema.columns 
                        WHERE table_name = '{table}'
                    """))
                    column_count = result.fetchone()[0]
                    print(f"  📋 {table}: {column_count} колонок")
                
                print(f"\n🎉 Всего создано таблиц: {len(tables)}")
                
            else:
                print("⚠️  Предупреждение: это не PostgreSQL база данных")
            
            print("\n✅ Все операции завершены успешно!")
            return True
            
        except Exception as e:
            print(f"❌ Ошибка при настройке таблиц: {e}")
            return False

if __name__ == "__main__":
    print("=" * 60)
    print("🗄️  Скрипт настройки таблиц PostgreSQL для Vondic")
    print("=" * 60)
    
    # Проверяем наличие .env.backend
    env_file = BASE_DIR / ".env.backend"
    if not env_file.exists():
        print(f"❌ Файл {env_file} не найден!")
        print("Пожалуйста, создайте .env.backend файл с настройками PostgreSQL")
        sys.exit(1)
    
    print(f"📁 Использую конфигурацию из: {env_file}")
    
    # Показываем параметры подключения (без пароля)
    try:
        with open(env_file, 'r') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, value = line.split('=', 1)
                    if 'PASSWORD' not in key and 'SECRET' not in key and 'KEY' not in key:
                        print(f"  🔑 {key}: {value}")
    except Exception as e:
        print(f"⚠️  Не удалось прочитать .env.backend: {e}")
    
    print("\n" + "=" * 60)
    
    # Запускаем настройку
    success = setup_postgres_tables()
    
    print("=" * 60)
    if success:
        print("🎉 Настройка PostgreSQL завершена успешно!")
        sys.exit(0)
    else:
        print("❌ Произошла ошибка при настройке PostgreSQL!")
        sys.exit(1)
