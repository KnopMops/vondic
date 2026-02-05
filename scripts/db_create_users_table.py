import logging
import sqlite3

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("db_init")

DB_PATH = "database.db"


def create_or_migrate_users_table():
    """Создает таблицу users или обновляет её структуру"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    # 1. Создание таблицы, если её нет (со всеми полями)
    create_table_query = """
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
        is_blocked INTEGER DEFAULT 0,
        is_blocked_at TIMESTAMP DEFAULT NULL,
        role TEXT DEFAULT 'User' CHECK(role IN ('User', 'Admin')),
        status TEXT DEFAULT 'offline',
        is_messaging INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """
    cursor.execute(create_table_query)

    # 2. Миграция: проверка и добавление недостающих колонок
    cursor.execute("PRAGMA table_info(users)")
    existing_columns = [info[1] for info in cursor.fetchall()]

    # Список колонок для проверки/добавления: (имя, определение)
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

    # 3. Создание индексов
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
