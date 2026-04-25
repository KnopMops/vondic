from ..core.extensions import db
from datetime import datetime, timezone


class E2EKeyBackup(db.Model):
    """Encrypted E2E key backup for multi-device synchronization.

    Keys are encrypted client-side before storage. The server never sees
    plaintext E2E keys. Each user can have multiple backups for different
    chat pairs (identified by key_id).
    """
    __tablename__ = 'e2e_key_backups'

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    user_id = db.Column(db.Text, nullable=False, index=True)
    key_id = db.Column(db.Text, nullable=False, index=True)

    encrypted_key_data = db.Column(db.Text, nullable=False)

    encryption_algorithm = db.Column(
        db.String(20),
        nullable=False,
        default='aes-256-gcm')

    device_id = db.Column(db.String(100), nullable=True)
    device_name = db.Column(db.String(200), nullable=True)

    created_at = db.Column(
        db.DateTime,
        nullable=False,
        default=lambda: datetime.now(
            timezone.utc))
    updated_at = db.Column(
        db.DateTime, nullable=False, default=lambda: datetime.now(
            timezone.utc), onupdate=lambda: datetime.now(
            timezone.utc))

    __table_args__ = (
        db.UniqueConstraint('user_id', 'key_id', name='uq_user_key_backup'),
    )

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'key_id': self.key_id,
            'encrypted_key_data': self.encrypted_key_data,
            'encryption_algorithm': self.encryption_algorithm,
            'device_id': self.device_id,
            'device_name': self.device_name,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
        }
