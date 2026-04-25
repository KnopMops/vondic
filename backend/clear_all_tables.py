import os
import sys
from urllib.parse import quote_plus

import psycopg2
from psycopg2 import sql


def build_dsn() -> str:
    host = os.getenv("POSTGRES_HOST", "localhost")
    port = os.getenv("POSTGRES_PORT", "5432")
    dbname = os.getenv("POSTGRES_DB", "postgres")
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "")
    sslmode = os.getenv("POSTGRES_SSLMODE", "disable")

    if password:
        return (
            f"postgresql://{quote_plus(user)}:{quote_plus(password)}@"
            f"{host}:{port}/{dbname}?sslmode={sslmode}"
        )
    return f"postgresql://{
        quote_plus(user)}@{host}:{port}/{dbname}?sslmode={sslmode}"


def main() -> int:
    dsn = build_dsn()

    with psycopg2.connect(dsn) as conn:
        conn.autocommit = False
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT tablename
                FROM pg_tables
                WHERE schemaname = 'public'
                ORDER BY tablename
                """
            )
            tables = [row[0] for row in cur.fetchall()]

            if not tables:
                print("No tables found in schema public.")
                conn.commit()
                return 0

            identifiers = [
                sql.Identifier("public", table_name) for table_name in tables
            ]
            truncate_query = sql.SQL(
                "TRUNCATE TABLE {} RESTART IDENTITY CASCADE"
            ).format(sql.SQL(", ").join(identifiers))
            cur.execute(truncate_query)
            conn.commit()

    print(f"Cleared {len(tables)} tables in schema public.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"Failed to clear tables: {exc}", file=sys.stderr)
        raise SystemExit(1)
