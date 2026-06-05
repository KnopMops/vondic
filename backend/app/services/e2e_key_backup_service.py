"""
E2E Key Backup Service

Handles encrypted storage and retrieval of E2E keys for multi-device synchronization.
The server NEVER sees plaintext E2E keys - all key data is encrypted client-side.
"""

from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from ..models.e2e_key_backup import E2EKeyBackup
from ..core.extensions import db


class E2EKeyBackupService:
    """Service for managing encrypted E2E key backups."""

    @staticmethod
    def key_id_variants(key_id: str) -> List[str]:
        """All legacy + sorted DM key id forms."""
        if not key_id or ':' not in key_id:
            return [key_id] if key_id else []
        parts = key_id.split(':', 1)
        if len(parts) != 2:
            return [key_id]
        a, b = parts[0].strip(), parts[1].strip()
        if not a or not b:
            return [key_id]
        sorted_id = ':'.join(sorted([a, b]))
        return list(dict.fromkeys([key_id, sorted_id, f'{a}:{b}', f'{b}:{a}']))

    @staticmethod
    def backup_key(
        user_id: str,
        key_id: str,
        encrypted_key_data: str,
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
        encryption_algorithm: str = 'aes-256-gcm',
    ) -> E2EKeyBackup:
        """Store or update an encrypted E2E key backup.

        Args:
            user_id: The user ID
            key_id: The E2E key identifier (e.g., sorted user ID pair)
            encrypted_key_data: Base64-encoded encrypted key data
            device_id: Optional device identifier
            device_name: Optional human-readable device name
            encryption_algorithm: Encryption algorithm used

        Returns:
            The saved E2EKeyBackup instance
        """
        existing = E2EKeyBackup.query.filter_by(
            user_id=user_id, key_id=key_id
        ).first()

        if existing:

            existing.encrypted_key_data = encrypted_key_data
            existing.encryption_algorithm = encryption_algorithm
            existing.updated_at = datetime.now(timezone.utc)
            if device_id:
                existing.device_id = device_id
            if device_name:
                existing.device_name = device_name
            backup = existing
        else:

            backup = E2EKeyBackup(
                user_id=user_id,
                key_id=key_id,
                encrypted_key_data=encrypted_key_data,
                encryption_algorithm=encryption_algorithm,
                device_id=device_id,
                device_name=device_name,
            )
            db.session.add(backup)

        db.session.commit()
        return backup

    @staticmethod
    def get_key(user_id: str, key_id: str) -> Optional[E2EKeyBackup]:
        """Retrieve an encrypted E2E key backup.

        Args:
            user_id: The user ID
            key_id: The E2E key identifier

        Returns:
            E2EKeyBackup instance or None
        """
        for variant in E2EKeyBackupService.key_id_variants(key_id):
            row = E2EKeyBackup.query.filter_by(
                user_id=user_id, key_id=variant
            ).first()
            if row:
                return row
        return None

    @staticmethod
    def get_all_keys(user_id: str) -> List[E2EKeyBackup]:
        """Retrieve all encrypted E2E key backups for a user.

        Args:
            user_id: The user ID

        Returns:
            List of E2EKeyBackup instances
        """
        return E2EKeyBackup.query.filter_by(user_id=user_id).all()

    @staticmethod
    def get_keys_batch(user_id: str, key_ids: List[str]) -> List[E2EKeyBackup]:
        """Retrieve specific encrypted E2E key backups for a user.

        Args:
            user_id: The user ID
            key_ids: List of key IDs to retrieve

        Returns:
            List of E2EKeyBackup instances
        """
        if not key_ids:
            return []
        expanded: List[str] = []
        for kid in key_ids:
            expanded.extend(E2EKeyBackupService.key_id_variants(kid))
        unique_ids = list(dict.fromkeys(expanded))
        return E2EKeyBackup.query.filter(
            E2EKeyBackup.user_id == user_id,
            E2EKeyBackup.key_id.in_(unique_ids)
        ).all()

    @staticmethod
    def delete_key(user_id: str, key_id: str) -> bool:
        """Delete an encrypted E2E key backup.

        Args:
            user_id: The user ID
            key_id: The E2E key identifier

        Returns:
            True if deleted, False if not found
        """
        backup = E2EKeyBackup.query.filter_by(
            user_id=user_id, key_id=key_id
        ).first()

        if not backup:
            return False

        db.session.delete(backup)
        db.session.commit()
        return True

    @staticmethod
    def delete_all_keys(user_id: str) -> int:
        """Delete all encrypted E2E key backups for a user.

        Args:
            user_id: The user ID

        Returns:
            Number of deleted backups
        """
        count = E2EKeyBackup.query.filter_by(user_id=user_id).delete()
        db.session.commit()
        return count

    @staticmethod
    def sync_keys(
        user_id: str,
        keys: List[Dict[str, Any]],
        device_id: Optional[str] = None,
        device_name: Optional[str] = None,
    ) -> List[E2EKeyBackup]:
        """Batch sync multiple E2E key backups.

        Args:
            user_id: The user ID
            keys: List of dicts with keys: key_id, encrypted_key_data
            device_id: Optional device identifier
            device_name: Optional human-readable device name

        Returns:
            List of saved E2EKeyBackup instances
        """
        results = []
        for key_data in keys:
            backup = E2EKeyBackupService.backup_key(
                user_id=user_id,
                key_id=key_data['key_id'],
                encrypted_key_data=key_data['encrypted_key_data'],
                device_id=device_id,
                device_name=device_name,
            )
            results.append(backup)

        return results
