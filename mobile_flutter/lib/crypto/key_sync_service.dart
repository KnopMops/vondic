import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import '../core/network/api_client.dart';
import '../core/utils/storage_service.dart';
import 'crypto_engine.dart';

class KeySyncService {
  final ApiClient _apiClient;
  final StorageService _storageService;
  final Logger _logger = Logger(printer: SimplePrinter(colors: true));

  final Map<String, Uint8List> _serverKeysCache = {};
  final Set<String> _serverKeysKnownMissing = {};
  bool _serverKeysCachePrimed = false;
  Future<Map<String, Uint8List>>? _restoreAllInFlight;

  KeySyncService(this._apiClient, this._storageService);

  String normalizeE2eKeyId(String keyId) {
    final cleaned = keyId.trim();
    if (!cleaned.contains(':')) return cleaned;
    final parts = cleaned.split(':');
    if (parts.length != 2) return cleaned;
    parts.sort();
    return parts.join(':');
  }

  List<String> expandKeyIdVariants(String keyId) {
    final cleaned = keyId.trim();
    if (!cleaned.contains(':')) return [normalizeE2eKeyId(cleaned)];
    final parts = cleaned.split(':');
    if (parts.length != 2) return [cleaned];
    final a = parts[0].trim();
    final b = parts[1].trim();
    return {
      cleaned,
      normalizeE2eKeyId(cleaned),
      '$a:$b',
      '$b:$a',
    }.toList();
  }

  // --- Key Derivations ---

  Uint8List _deriveKeyFromHash(String seed) {
    return CryptoEngine.sha256(utf8.encode(seed));
  }

  Uint8List _deriveLegacyTokenKey(String accessToken) {
    return _deriveKeyFromHash('vondic-e2e-backup:$accessToken');
  }

  Uint8List _deriveLegacyUserIdKey(String userId) {
    return _deriveKeyFromHash('vondic-e2e-backup-user:$userId');
  }

  Uint8List _deriveV3MasterKey(String userId, String saltB64, String localSecretB64) {
    return _deriveKeyFromHash('vondic-e2e-v3|$userId|$saltB64|$localSecretB64');
  }

  Uint8List _deriveWrapKeyV2(String userId, String saltB64) {
    return _deriveKeyFromHash('vondic-e2e-wrap-v2|$userId|$saltB64');
  }

  Uint8List _deriveWrapKeyLegacy(String accessToken, String userId, String saltB64) {
    return _deriveKeyFromHash('vondic-e2e-wrap|$userId|$saltB64|$accessToken');
  }

  // --- Secure AES-GCM helpers matching JS structure ---

  Future<String> _aesGcmEncryptHelper(Uint8List key, Uint8List plaintext) async {
    final iv = CryptoEngine.getRandomBytes(12);
    final encrypted = CryptoEngine.aesGcmEncrypt(plaintext, key, iv);
    final out = Uint8List(iv.length + encrypted.length);
    out.setRange(0, iv.length, iv);
    out.setRange(iv.length, out.length, encrypted);
    return base64.encode(out);
  }

  Future<Uint8List?> _aesGcmDecryptHelper(Uint8List key, String payloadB64) async {
    try {
      final data = base64.decode(payloadB64);
      if (data.length < 13) return null;
      final iv = data.sublist(0, 12);
      final ciphertext = data.sublist(12);
      return CryptoEngine.aesGcmDecrypt(ciphertext, key, iv);
    } catch (_) {
      return null;
    }
  }

  // --- Backup Material Service ---

  Future<Map<String, String>?> ensureBackupMaterial(String accessToken, String userId) async {
    if (accessToken.isEmpty || userId.isEmpty) return null;

    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/e2e-keys/backup-material');
      final data = response.data;
      if (data == null || data['success'] != true || data['salt'] == null) {
        return null;
      }

      final salt = data['salt'].toString();
      await _storageService.writeString('e2e_backup_salt_cache', salt);

      String? localSecret = await _storageService.readSecure('e2e_device_secret_v1');
      bool shouldPublish = false;

      final wrappedDeviceSecret = data['wrapped_device_secret'] as String?;
      if (wrappedDeviceSecret != null && wrappedDeviceSecret.isNotEmpty) {
        final unwrapped = await _unwrapDeviceSecret(wrappedDeviceSecret, accessToken, userId, salt);
        if (unwrapped != null) {
          localSecret = unwrapped['secret'];
          await _storageService.writeSecure('e2e_device_secret_v1', localSecret!);
          _logger.d('[E2E] Unwrapped device secret; usedLegacyWrap=${unwrapped['usedLegacyWrap']}');
          if (unwrapped['usedLegacyWrap'] == true) {
            shouldPublish = true;
          }
        } else if (localSecret == null) {
          _logger.w('[E2E] Server has wrapped device secret but it could not be unwrapped');
          return null;
        } else {
          _logger.w('[E2E] Server wrapped secret not unwrap-able, using local secret');
        }
      } else {
        if (localSecret == null) {
          localSecret = base64.encode(CryptoEngine.getRandomBytes(32));
          await _storageService.writeSecure('e2e_device_secret_v1', localSecret);
        }
        shouldPublish = true;
      }

      if (shouldPublish && localSecret != null) {
        try {
          final wrapped = await _wrapDeviceSecret(localSecret, accessToken, userId, salt);
          await _apiClient.put('/e2e-keys/backup-material', data: {
            'wrapped_device_secret': wrapped,
          });
        } catch (err) {
          _logger.w('[E2E] Failed to publish wrapped device secret: $err');
        }
      }

      if (localSecret == null) return null;
      return {'salt': salt, 'localSecretB64': localSecret};
    } catch (e) {
      _logger.e('[E2E] ensureBackupMaterial error: $e');
      return null;
    }
  }

  Future<String> _wrapDeviceSecret(
    String localSecretB64,
    String accessToken,
    String userId,
    String saltB64,
  ) async {
    final wrapKey = _deriveWrapKeyV2(userId, saltB64);
    final plainBytes = utf8.encode(localSecretB64);
    return _aesGcmEncryptHelper(wrapKey, plainBytes);
  }

  Future<Map<String, dynamic>?> _unwrapDeviceSecret(
    String wrappedB64,
    String accessToken,
    String userId,
    String saltB64,
  ) async {
    // 1. Try v2 wrap key
    final v2Key = _deriveWrapKeyV2(userId, saltB64);
    final v2Bytes = await _aesGcmDecryptHelper(v2Key, wrappedB64);
    if (v2Bytes != null) {
      return {'secret': utf8.decode(v2Bytes), 'usedLegacyWrap': false};
    }

    // 2. Try legacy wrap key with tokens
    final tokens = {
      accessToken,
      await _storageService.readSecure('access_token'),
    }.where((t) => t != null && t.isNotEmpty).toList();

    for (final token in tokens) {
      final legacyKey = _deriveWrapKeyLegacy(token!, userId, saltB64);
      final legacyBytes = await _aesGcmDecryptHelper(legacyKey, wrappedB64);
      if (legacyBytes != null) {
        return {'secret': utf8.decode(legacyBytes), 'usedLegacyWrap': true};
      }
    }

    // 3. Try legacy wrap key user-only
    final userOnlyKey = _deriveKeyFromHash('vondic-e2e-wrap-user|$userId');
    final userOnlyBytes = await _aesGcmDecryptHelper(userOnlyKey, wrappedB64);
    if (userOnlyBytes != null) {
      return {'secret': utf8.decode(userOnlyBytes), 'usedLegacyWrap': true};
    }

    return null;
  }

  // --- Encrypting/Decrypting keys for backup ---

  Uint8List? _parseKeyPayload(Uint8List decryptedBytes) {
    if (decryptedBytes.length < 4) return null;
    final view = ByteData.view(decryptedBytes.buffer, decryptedBytes.offsetInBytes, decryptedBytes.length);
    final keyIdLength = view.getUint16(0, Endian.big);
    if (keyIdLength <= 0 || 2 + keyIdLength > decryptedBytes.length) return null;
    // We only need the keyData bytes
    return decryptedBytes.sublist(2 + keyIdLength);
  }

  Uint8List _buildKeyPayload(String keyId, Uint8List keyData) {
    final normalizedId = normalizeE2eKeyId(keyId);
    final keyIdBytes = utf8.encode(normalizedId);
    final payload = Uint8List(2 + keyIdBytes.length + keyData.length);
    final view = ByteData.view(payload.buffer);
    view.setUint16(0, keyIdBytes.length, Endian.big);
    payload.setRange(2, 2 + keyIdBytes.length, keyIdBytes);
    payload.setRange(2 + keyIdBytes.length, payload.length, keyData);
    return payload;
  }

  Future<List<Uint8List>> _collectMasterKeyCandidates(
    String? accessToken,
    String? userId,
  ) async {
    final List<Uint8List> candidates = [];
    final seen = <String>{};

    void addKey(Uint8List? key) {
      if (key == null) return;
      final keyHex = base64.encode(key);
      if (!seen.contains(keyHex)) {
        seen.add(keyHex);
        candidates.add(key);
      }
    }

    if (accessToken != null && accessToken.isNotEmpty && userId != null && userId.isNotEmpty) {
      final material = await ensureBackupMaterial(accessToken, userId);
      if (material != null) {
        addKey(_deriveV3MasterKey(userId, material['salt']!, material['localSecretB64']!));
      }
      final cachedSalt = _storageService.readString('e2e_backup_salt_cache');
      final localSecret = await _storageService.readSecure('e2e_device_secret_v1');
      if (cachedSalt != null && localSecret != null) {
        addKey(_deriveV3MasterKey(userId, cachedSalt, localSecret));
      }
    }

    // Add legacy derivations
    final tokenCandidates = {
      accessToken,
      await _storageService.readSecure('access_token'),
    }.where((t) => t != null && t.isNotEmpty).toList();

    for (final token in tokenCandidates) {
      addKey(_deriveLegacyTokenKey(token!));
    }
    if (userId != null && userId.isNotEmpty) {
      addKey(_deriveLegacyUserIdKey(userId));
    }

    final localMasterB64 = await _storageService.readSecure('e2e_master_key');
    if (localMasterB64 != null) {
      try {
        addKey(base64.decode(localMasterB64));
      } catch (_) {}
    }

    return candidates;
  }

  Future<Uint8List?> decryptKeyFromBackup(
    String encryptedData,
    String? accessToken,
    String? userId,
  ) async {
    final candidates = await _collectMasterKeyCandidates(accessToken, userId);
    for (final masterKey in candidates) {
      final decryptedBytes = await _aesGcmDecryptHelper(masterKey, encryptedData);
      if (decryptedBytes != null) {
        final parsed = _parseKeyPayload(decryptedBytes);
        if (parsed != null && parsed.isNotEmpty) {
          return parsed;
        }
      }
    }
    return null;
  }

  // Returns {encryptedKeyData: string, algorithm: string}
  Future<Map<String, String>> _encryptKeyForBackupInternal(
    String keyId,
    Uint8List keyData,
    String? accessToken,
    String? userId,
  ) async {
    final payload = _buildKeyPayload(keyId, keyData);
    Uint8List? masterKey;
    String algorithm = 'aes-256-gcm';

    if (accessToken != null && accessToken.isNotEmpty && userId != null && userId.isNotEmpty) {
      final material = await ensureBackupMaterial(accessToken, userId);
      if (material != null) {
        masterKey = _deriveV3MasterKey(userId, material['salt']!, material['localSecretB64']!);
        algorithm = 'aes-256-gcm-v3';
      }
    }

    if (masterKey == null && accessToken != null && accessToken.isNotEmpty) {
      masterKey = _deriveLegacyTokenKey(accessToken);
    }
    if (masterKey == null && userId != null && userId.isNotEmpty) {
      masterKey = _deriveLegacyUserIdKey(userId);
    }
    if (masterKey == null) {
      final localMasterB64 = await _storageService.readSecure('e2e_master_key');
      if (localMasterB64 != null) {
        masterKey = base64.decode(localMasterB64);
      } else {
        masterKey = CryptoEngine.getRandomBytes(32);
        await _storageService.writeSecure('e2e_master_key', base64.encode(masterKey));
      }
    }

    final encrypted = await _aesGcmEncryptHelper(masterKey, payload);
    return {'encryptedKeyData': encrypted, 'algorithm': algorithm};
  }

  // --- Server API Endpoints ---

  Future<bool> serverHasKeyBackup(String keyId) async {
    final wanted = expandKeyIdVariants(keyId).map((id) => normalizeE2eKeyId(id)).toSet();
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('/e2e-keys/list');
      if (response.data?['success'] != true) return false;
      final keysList = response.data?['keys'] as List?;
      if (keysList == null) return false;

      for (final row in keysList) {
        final serverKeyId = normalizeE2eKeyId(row['key_id']?.toString() ?? '');
        if (wanted.contains(serverKeyId)) {
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  Future<bool> backupKeyToServer(
    String accessToken,
    String keyId,
    Uint8List keyData, {
    String? deviceId,
    String? deviceName,
    String? userId,
    bool allowOverwrite = false,
  }) async {
    try {
      final normalized = normalizeE2eKeyId(keyId);
      if (!allowOverwrite) {
        final exists = await serverHasKeyBackup(normalized);
        if (exists) return true;
      }

      if (userId != null && userId.isNotEmpty) {
        await ensureBackupMaterial(accessToken, userId);
      }

      final backupResult = await _encryptKeyForBackupInternal(normalized, keyData, accessToken, userId);
      final response = await _apiClient.post('/e2e-keys/backup', data: {
        'key_id': normalized,
        'encrypted_key_data': backupResult['encryptedKeyData'],
        'device_id': deviceId ?? 'mobile_flutter',
        'device_name': deviceName ?? 'Vondic Flutter',
        'encryption_algorithm': backupResult['algorithm'],
      });

      if (response.statusCode == 200 || response.statusCode == 201) {
        _logger.d('[E2E Key Sync] Key backed up successfully: $normalized');
        return true;
      }
    } catch (e) {
      _logger.e('[E2E Key Sync] Backup error: $e');
    }
    return false;
  }

  Future<Uint8List?> restoreKeyFromServer(
    String accessToken,
    String keyId,
    String? userId,
  ) async {
    final cached = lookupCachedServerKey(keyId);
    if (cached != null) return cached;

    if (_serverKeysKnownMissing.contains(normalizeE2eKeyId(keyId))) return null;

    if (!_serverKeysCachePrimed) {
      await beginServerKeysRestore(accessToken, userId);
      final afterBatch = lookupCachedServerKey(keyId);
      if (afterBatch != null) return afterBatch;
    }

    final variants = expandKeyIdVariants(keyId);
    for (final variant in variants) {
      try {
        final response = await _apiClient.post<Map<String, dynamic>>('/e2e-keys/restore', data: {
          'key_id': variant,
        });
        
        final data = response.data;
        if (data == null || data['success'] != true || data['encrypted_key_data'] == null) {
          _serverKeysKnownMissing.add(normalizeE2eKeyId(variant));
          continue;
        }

        final encrypted = data['encrypted_key_data'] as String;
        final decrypted = await decryptKeyFromBackup(encrypted, accessToken, userId);
        if (decrypted != null && decrypted.isNotEmpty) {
          _mergeServerKeysCache(variant, decrypted);
          await persistKeyLocally(variant, decrypted);
          return decrypted;
        }
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  Future<Map<String, Uint8List>> restoreAllKeysFromServer(
    String accessToken,
    String? userId,
  ) async {
    final restoredKeys = <String, Uint8List>{};
    try {
      if (userId != null && userId.isNotEmpty) {
        await ensureBackupMaterial(accessToken, userId);
      }

      final responseList = await _apiClient.get<Map<String, dynamic>>('/e2e-keys/list');
      final listData = responseList.data;
      if (listData == null || listData['success'] != true || listData['keys'] == null) {
        _primeServerKeysCache(restoredKeys);
        return restoredKeys;
      }

      final keysList = listData['keys'] as List;
      if (keysList.isEmpty) {
        _primeServerKeysCache(restoredKeys);
        return restoredKeys;
      }

      final keyIds = keysList.map((k) => normalizeE2eKeyId(k['key_id']?.toString() ?? '')).toList();
      final responseRestore = await _apiClient.post<Map<String, dynamic>>('/e2e-keys/restore-batch', data: {
        'key_ids': keyIds,
      });

      final restoreData = responseRestore.data;
      if (restoreData == null || restoreData['success'] != true || restoreData['keys'] == null) {
        return restoredKeys;
      }

      final restoredItems = restoreData['keys'] as List;
      for (final item in restoredItems) {
        final serverKeyId = normalizeE2eKeyId(item['key_id']?.toString() ?? '');
        final encrypted = item['encrypted_key_data'] as String;
        final decrypted = await decryptKeyFromBackup(encrypted, accessToken, userId);
        if (decrypted != null) {
          final normalizedId = normalizeE2eKeyId(serverKeyId);
          restoredKeys[normalizedId] = decrypted;
          await persistKeyLocally(normalizedId, decrypted);
        }
      }

      _primeServerKeysCache(restoredKeys);
      _logger.d('[E2E Key Sync] Restored ${restoredKeys.length} keys from server');
    } catch (e) {
      _logger.e('[E2E Key Sync] Restore all keys error: $e');
    }
    return restoredKeys;
  }

  // --- Caching and Local Persistence ---

  void _primeServerKeysCache(Map<String, Uint8List> keys) {
    _serverKeysCache.clear();
    _serverKeysKnownMissing.clear();
    keys.forEach((keyId, keyBytes) {
      for (final variant in expandKeyIdVariants(keyId)) {
        _serverKeysCache[variant] = keyBytes;
      }
    });
    _serverKeysCachePrimed = true;
  }

  void _mergeServerKeysCache(String keyId, Uint8List keyBytes) {
    for (final variant in expandKeyIdVariants(keyId)) {
      _serverKeysCache[variant] = keyBytes;
    }
    _serverKeysCachePrimed = true;
  }

  Uint8List? lookupCachedServerKey(String keyId) {
    for (final variant in expandKeyIdVariants(keyId)) {
      if (_serverKeysCache.containsKey(variant)) {
        return _serverKeysCache[variant];
      }
    }
    return null;
  }

  Future<void> persistKeyLocally(String keyId, Uint8List keyBytes) async {
    final b64 = base64.encode(keyBytes);
    for (final variant in expandKeyIdVariants(keyId)) {
      await _storageService.writeSecure('e2e_key_$variant', b64);
    }
  }

  Future<Uint8List?> getPersistedKeyLocally(String keyId) async {
    final normalized = normalizeE2eKeyId(keyId);
    final b64 = await _storageService.readSecure('e2e_key_$normalized');
    if (b64 != null) {
      try {
        return base64.decode(b64);
      } catch (_) {}
    }
    return null;
  }

  Future<Map<String, Uint8List>> loadAllLocalPersistedKeys() async {
    // In Flutter, since we can't easily iterate all keys in FlutterSecureStorage on some OS without platforms-specific calls,
    // we can retrieve them on demand or sync when needed.
    // If the server list tells us what keys exist, we can load them from local secure storage.
    return {};
  }

  Future<Map<String, Uint8List>> beginServerKeysRestore(String accessToken, String? userId) {
    if (_restoreAllInFlight != null) return _restoreAllInFlight!;
    _restoreAllInFlight = restoreAllKeysFromServer(accessToken, userId).whenComplete(() {
      _restoreAllInFlight = null;
    });
    return _restoreAllInFlight!;
  }

  void resetRestoreCache() {
    _serverKeysCache.clear();
    _serverKeysKnownMissing.clear();
    _serverKeysCachePrimed = false;
    _restoreAllInFlight = null;
  }
}
