#!/bin/sh
set -e

# Доступ к /var/run/docker.sock для создания почтовых ящиков
if [ -S /var/run/docker.sock ]; then
  SOCK_GID="$(stat -c '%g' /var/run/docker.sock)"
  if [ -n "$SOCK_GID" ] && [ "$SOCK_GID" != "0" ]; then
    EXISTING_GROUP="$(getent group "$SOCK_GID" 2>/dev/null | cut -d: -f1 || true)"
    if [ -n "$EXISTING_GROUP" ]; then
      usermod -aG "$EXISTING_GROUP" appuser 2>/dev/null || true
    else
      groupadd -g "$SOCK_GID" dockersock 2>/dev/null || groupadd dockersock 2>/dev/null || true
      if getent group dockersock >/dev/null 2>&1; then
        usermod -aG dockersock appuser 2>/dev/null || true
      fi
    fi
  fi
fi

# Run DB bootstrap via direct postgres (pgbouncer transaction mode blocks DDL)
if [ -z "$SKIP_DB_BOOTSTRAP" ]; then
  echo "[entrypoint] Running DB bootstrap..."
  cd /app/backend
  python -c "
import os, psycopg2
# Connect directly to postgres, bypassing pgbouncer
dsn = 'postgresql://postgres:4566212@192.168.140.11:5432/vondic'
try:
    conn = psycopg2.connect(dsn)
    conn.autocommit = True
    cur = conn.cursor()

    migrations = [
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS access_token_lookup TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS refresh_token_lookup TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS moderation_warnings JSONB DEFAULT \'[]\'::jsonb',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_token TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_password_expires TIMESTAMP',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS e2e_backup_salt TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS e2e_wrapped_device_secret TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_ip TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked_system INTEGER DEFAULT 0',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS yandex_id TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS yandex_token TEXT',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_rules JSONB',
        'ALTER TABLE users ADD COLUMN IF NOT EXISTS bonus_balance FLOAT NOT NULL DEFAULT 0.0',
        'ALTER TABLE channels ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE',
        'ALTER TABLE communities ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE',
        'ALTER TABLE groups ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE',
        'CREATE TABLE IF NOT EXISTS join_requests (id TEXT PRIMARY KEY, target_type TEXT NOT NULL, target_id TEXT NOT NULL, user_id TEXT NOT NULL, status TEXT DEFAULT \'pending\', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)',
        'CREATE TABLE IF NOT EXISTS passkeys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, credential_id TEXT NOT NULL UNIQUE, public_key TEXT NOT NULL, sign_count INTEGER NOT NULL DEFAULT 0, device_name TEXT, transports TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, last_used_at TIMESTAMP)',
    ]
    for sql in migrations:
        try:
            cur.execute(sql)
        except Exception:
            pass

    try:
        cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_users_access_token_lookup ON users (access_token_lookup) WHERE access_token_lookup IS NOT NULL')
    except Exception:
        pass
    try:
        cur.execute('CREATE UNIQUE INDEX IF NOT EXISTS uq_users_refresh_token_lookup ON users (refresh_token_lookup) WHERE refresh_token_lookup IS NOT NULL')
    except Exception:
        pass
    try:
        cur.execute('CREATE INDEX IF NOT EXISTS ix_passkeys_user_id ON passkeys (user_id)')
    except Exception:
        pass
    try:
        cur.execute('CREATE INDEX IF NOT EXISTS ix_passkeys_credential_id ON passkeys (credential_id)')
    except Exception:
        pass

    conn.close()
    print('[entrypoint] DB bootstrap done')
except Exception as e:
    print(f'[entrypoint] DB bootstrap failed: {e}')
" 2>&1

  echo "[entrypoint] Running Alembic migrations..."
  alembic upgrade head 2>&1 || true
fi

exec gosu appuser "$@"
