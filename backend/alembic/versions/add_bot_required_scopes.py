"""add required_scopes to bots

Revision ID: a1b2c3d4e5f6
Revises: 9fc5d0152a67
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = 'a1b2c3d4e5f6'
down_revision = '9fc5d0152a67'
branch_labels = None
depends_on = None

def upgrade():
    op.add_column('bots', sa.Column('required_scopes', sa.TEXT(), nullable=True, server_default='username,send_messages'))

def downgrade():
    op.drop_column('bots', 'required_scopes')
