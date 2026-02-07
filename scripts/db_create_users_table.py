import logging
import sqlite3

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("db_init")
DB_PATH = "database.db"


def create_or_migrate_users_table():
    """Создает таблицу users или обновляет её структуру"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    create_table_query = "\n    CREATE TABLE IF NOT EXISTS users (\n        id TEXT PRIMARY KEY,\n        username TEXT UNIQUE NOT NULL,\n        email TEXT UNIQUE NOT NULL,\n        access_token TEXT,\n        refresh_token TEXT,\n        password_hash TEXT NOT NULL,\n        avatar_url TEXT DEFAULT NULL,\n        is_verified INTEGER DEFAULT 0,\n        socket_id TEXT,\n        is_blocked INTEGER DEFAULT 0,\n        is_blocked_at TIMESTAMP DEFAULT NULL,\n        role TEXT DEFAULT 'User' CHECK(role IN ('User', 'Admin')),\n        status TEXT DEFAULT 'offline',\n        is_messaging INTEGER DEFAULT 0,\n        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP\n    );\n    "
    cursor.execute(create_table_query)
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = [info[1] for info in cursor.fetchall()]
    columns_to_ensure = [
        ("is_blocked", "INTEGER DEFAULT 0"),
        ("is_blocked_at", "TIMESTAMP DEFAULT NULL"),
        ("role", "TEXT DEFAULT 'User'"),
        ("status", "TEXT DEFAULT 'offline'"),
        ("is_messaging", "INTEGER DEFAULT 0"),
    ]
    for col_name, col_def in columns_to_ensure:
        if col_name not in existing_columns:
            logger.info(f"Миграция: Добавление колонки {col_name}...")
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_def}")
            except sqlite3.OperationalError as e:
                logger.error(f"Ошибка при добавлении колонки {col_name}: {e}")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_username ON users(username)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_email ON users(email)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_access_token ON users(access_token)")
    conn.commit()
    logger.info("Таблица 'users' успешно инициализирована/обновлена.")
    conn.close()


def view_users():
    """Просмотр содержимого таблицы users"""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users")
    rows = cursor.fetchall()
    print(f"\nСодержимое таблицы users ({len(rows)} записей):")
    for row in rows:
        print(dict(row))
    conn.close()


if __name__ == "__main__":
    create_or_migrate_users_table()
