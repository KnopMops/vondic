"""add passkeys table

Revision ID: p1a2s3s4k5e6
Revises: a1b2c3d4e5f6
Create Date: 2026-09-25
"""
from alembic import op
import sqlalchemy as sa

revision = 'p1a2s3s4k5e6'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None

def upgrade():
    op.execute("""
        CREATE TABLE IF NOT EXISTS passkeys (
            id VARCHAR(36) PRIMARY KEY,
            user_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            credential_id VARCHAR(512) NOT NULL UNIQUE,
            public_key TEXT NOT NULL,
            sign_count INTEGER NOT NULL DEFAULT 0,
            device_name VARCHAR(255),
            transports VARCHAR(255),
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
            last_used_at TIMESTAMP WITHOUT TIME ZONE
        );
        CREATE INDEX IF NOT EXISTS ix_passkeys_user_id ON passkeys (user_id);
        CREATE INDEX IF NOT EXISTS ix_passkeys_credential_id ON passkeys (credential_id);
    """)

def downgrade():
    op.execute("""
        DROP TABLE IF EXISTS passkeys CASCADE;
    """)
