"""
E2E Key Synchronization API

Endpoints for backing up and restoring E2E encryption keys across devices.
All key data is encrypted client-side - the server only stores encrypted blobs.
"""

from flask import Blueprint, request, jsonify
from typing import List, Dict, Any

from ...services.e2e_key_backup_service import E2EKeyBackupService
from ...utils.decorators import token_required

e2e_keys_bp = Blueprint('e2e_keys', __name__, url_prefix='/api/v1/e2e-keys')


@e2e_keys_bp.route('/backup', methods=['POST'])
@token_required
def backup_key(current_user):
    """Backup an encrypted E2E key to the server.

    Request body:
    {
        "key_id": "user1:user2",
        "encrypted_key_data": "base64-encoded encrypted key",
        "device_id": "optional-device-id",
        "device_name": "optional-device-name",
        "encryption_algorithm": "aes-256-gcm"
    }

    Returns:
    {
        "success": true,
        "key_id": "user1:user2",
        "updated_at": "2024-01-01T00:00:00"
    }
    """
    data = request.get_json()

    if not data or not data.get(
            'key_id') or not data.get('encrypted_key_data'):
        return jsonify({
            'success': False,
            'error': 'Missing required fields: key_id, encrypted_key_data'
        }), 400

    try:
        backup = E2EKeyBackupService.backup_key(
            user_id=str(
                current_user.id),
            key_id=data['key_id'],
            encrypted_key_data=data['encrypted_key_data'],
            device_id=data.get('device_id'),
            device_name=data.get('device_name'),
            encryption_algorithm=data.get(
                'encryption_algorithm',
                'aes-256-gcm'),
        )

        return jsonify({
            'success': True,
            'key_id': backup.key_id,
            'updated_at': backup.updated_at.isoformat() if backup.updated_at else None,
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@e2e_keys_bp.route('/restore', methods=['POST'])
@token_required
def restore_key(current_user):
    """Restore an encrypted E2E key from the server.

    Request body:
    {
        "key_id": "user1:user2"
    }

    Returns:
    {
        "success": true,
        "key_id": "user1:user2",
        "encrypted_key_data": "base64-encoded encrypted key",
        "encryption_algorithm": "aes-256-gcm",
        "device_id": "device-id",
        "updated_at": "2024-01-01T00:00:00"
    }
    """
    data = request.get_json()

    if not data or not data.get('key_id'):
        return jsonify({
            'success': False,
            'error': 'Missing required field: key_id'
        }), 400

    try:
        backup = E2EKeyBackupService.get_key(
            user_id=str(current_user.id),
            key_id=data['key_id']
        )

        if not backup:
            return jsonify({
                'success': False,
                'error': 'Key not found'
            }), 404

        return jsonify({
            'success': True,
            'key_id': backup.key_id,
            'encrypted_key_data': backup.encrypted_key_data,
            'encryption_algorithm': backup.encryption_algorithm,
            'device_id': backup.device_id,
            'device_name': backup.device_name,
            'updated_at': backup.updated_at.isoformat() if backup.updated_at else None,
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@e2e_keys_bp.route('/restore-batch', methods=['POST'])
@token_required
def restore_keys_batch(current_user):
    """Restore multiple encrypted E2E keys from the server.

    Request body:
    {
        "key_ids": ["user1:user2", "user3:user4"]
    }

    Returns:
    {
        "success": true,
        "keys": [
            {
                "key_id": "user1:user2",
                "encrypted_key_data": "...",
                "encryption_algorithm": "aes-256-gcm"
            }
        ]
    }
    """
    data = request.get_json()

    if not data or not data.get('key_ids'):
        return jsonify({
            'success': False,
            'error': 'Missing required field: key_ids'
        }), 400

    try:
        backups = E2EKeyBackupService.get_keys_batch(
            user_id=str(current_user.id),
            key_ids=data['key_ids']
        )

        keys = [{
            'key_id': backup.key_id,
            'encrypted_key_data': backup.encrypted_key_data,
            'encryption_algorithm': backup.encryption_algorithm,
            'device_id': backup.device_id,
            'device_name': backup.device_name,
            'updated_at': backup.updated_at.isoformat() if backup.updated_at else None,
        } for backup in backups]

        return jsonify({
            'success': True,
            'keys': keys,
            'count': len(keys)
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@e2e_keys_bp.route('/sync', methods=['POST'])
@token_required
def sync_keys(current_user):
    """Batch sync multiple E2E keys to the server.

    Request body:
    {
        "keys": [
            {
                "key_id": "user1:user2",
                "encrypted_key_data": "base64-encoded encrypted key"
            }
        ],
        "device_id": "optional-device-id",
        "device_name": "optional-device-name"
    }

    Returns:
    {
        "success": true,
        "synced_count": 2
    }
    """
    data = request.get_json()

    if not data or not data.get('keys') or not isinstance(data['keys'], list):
        return jsonify({
            'success': False,
            'error': 'Missing required field: keys (array)'
        }), 400

    try:
        backups = E2EKeyBackupService.sync_keys(
            user_id=str(current_user.id),
            keys=data['keys'],
            device_id=data.get('device_id'),
            device_name=data.get('device_name'),
        )

        return jsonify({
            'success': True,
            'synced_count': len(backups)
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@e2e_keys_bp.route('/list', methods=['GET'])
@token_required
def list_keys(current_user):
    """List all E2E key IDs available for this user.

    Returns:
    {
        "success": true,
        "keys": [
            {
                "key_id": "user1:user2",
                "device_id": "device-id",
                "device_name": "Chrome on Windows",
                "updated_at": "2024-01-01T00:00:00"
            }
        ]
    }
    """
    try:
        backups = E2EKeyBackupService.get_all_keys(
            user_id=str(current_user.id)
        )

        keys = [{
            'key_id': backup.key_id,
            'device_id': backup.device_id,
            'device_name': backup.device_name,
            'updated_at': backup.updated_at.isoformat() if backup.updated_at else None,
        } for backup in backups]

        return jsonify({
            'success': True,
            'keys': keys,
            'count': len(keys)
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@e2e_keys_bp.route('/delete', methods=['POST'])
@token_required
def delete_key(current_user):
    """Delete an E2E key backup.

    Request body:
    {
        "key_id": "user1:user2"
    }

    Returns:
    {
        "success": true
    }
    """
    data = request.get_json()

    if not data or not data.get('key_id'):
        return jsonify({
            'success': False,
            'error': 'Missing required field: key_id'
        }), 400

    try:
        success = E2EKeyBackupService.delete_key(
            user_id=str(current_user.id),
            key_id=data['key_id']
        )

        if not success:
            return jsonify({
                'success': False,
                'error': 'Key not found'
            }), 404

        return jsonify({
            'success': True
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@e2e_keys_bp.route('/delete-all', methods=['POST'])
@token_required
def delete_all_keys(current_user):
    """Delete all E2E key backups for this user.

    Returns:
    {
        "success": true,
        "deleted_count": 5
    }
    """
    try:
        count = E2EKeyBackupService.delete_all_keys(
            user_id=str(current_user.id)
        )

        return jsonify({
            'success': True,
            'deleted_count': count
        }), 200

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500
