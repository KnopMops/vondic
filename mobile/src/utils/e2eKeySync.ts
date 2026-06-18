/**
 * E2E Key Synchronization — client-side encrypted backups (React Native).
 *
 * v3: master = SHA256(userId + serverSalt + localDeviceSecret)
 * - serverSalt: random per user, only via authenticated API
 * - localDeviceSecret: random per app install, synced wrapped with session key
 *
 * Legacy v1/v2 backups are still decrypted when possible (token-only / userId-only).
 * Matches the web client in frontend/src/lib/e2eKeySync.ts.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {crypto, subtle, base64FromBytes, bytesFromBase64, type CryptoKey} from './crypto';
import {apiClient} from '@/api/client';

const E2E_MASTER_KEY_STORAGE_KEY = 'e2e_master_key';
const E2E_DEVICE_ID_KEY = 'e2e_device_id';
const E2E_LOCAL_SECRET_KEY = 'e2e_device_secret_v1';
const E2E_SALT_CACHE_KEY = 'e2e_backup_salt_cache';

const serverKeysCache = new Map<string, Uint8Array>();
const serverKeysKnownMissing = new Set<string>();
let serverKeysCachePrimed = false;
let restoreAllInFlight: Promise<Map<string, Uint8Array>> | null = null;

type BackupMaterial = {
  salt: string;
  localSecretB64: string;
};

async function sha256Raw(input: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const hash = await subtle.digest('SHA-256', encoder.encode(input));
  return subtle.importKey(
    'raw',
    hash,
    {name: 'AES-GCM', length: 256},
    true,
    ['encrypt', 'decrypt'],
  );
}

async function deriveLegacyTokenKey(accessToken: string): Promise<CryptoKey> {
  return sha256Raw(`vondic-e2e-backup:${accessToken}`);
}

async function deriveLegacyUserIdKey(userId: string): Promise<CryptoKey> {
  return sha256Raw(`vondic-e2e-backup-user:${userId}`);
}

async function deriveV3MasterKey(
  userId: string,
  saltB64: string,
  localSecretB64: string,
): Promise<CryptoKey> {
  return sha256Raw(`vondic-e2e-v3|${userId}|${saltB64}|${localSecretB64}`);
}

/** Stable wrap key (survives access_token rotation). */
async function deriveWrapKeyV2(userId: string, saltB64: string): Promise<CryptoKey> {
  return sha256Raw(`vondic-e2e-wrap-v2|${userId}|${saltB64}`);
}

/** @deprecated Legacy — tied to access_token; kept for unwrap only. */
async function deriveWrapKeyLegacy(
  accessToken: string,
  userId: string,
  saltB64: string,
): Promise<CryptoKey> {
  return sha256Raw(`vondic-e2e-wrap|${userId}|${saltB64}|${accessToken}`);
}

async function getLegacyLocalMasterKey(): Promise<CryptoKey | null> {
  const stored = await AsyncStorage.getItem(E2E_MASTER_KEY_STORAGE_KEY);
  if (!stored) return null;
  try {
    const keyData = bytesFromBase64(stored);
    return subtle.importKey(
      'raw',
      keyData,
      {name: 'AES-GCM', length: 256},
      true,
      ['encrypt', 'decrypt'],
    );
  } catch {
    return null;
  }
}

async function generateMasterKey(): Promise<CryptoKey> {
  const keyMaterial = new Uint8Array(32);
  crypto.getRandomValues(keyMaterial);
  const key = await subtle.importKey(
    'raw',
    keyMaterial,
    {name: 'AES-GCM', length: 256},
    true,
    ['encrypt', 'decrypt'],
  );
  const rawKey = await subtle.exportKey('raw', key);
  await AsyncStorage.setItem(E2E_MASTER_KEY_STORAGE_KEY, base64FromBytes(new Uint8Array(rawKey)));
  return key;
}

async function aesGcmEncrypt(key: CryptoKey, plaintext: Uint8Array): Promise<string> {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await subtle.encrypt({name: 'AES-GCM', iv}, key, plaintext);
  const out = new Uint8Array(iv.length + encrypted.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(encrypted), iv.length);
  return base64FromBytes(out);
}

async function aesGcmDecrypt(key: CryptoKey, payloadB64: string): Promise<Uint8Array | null> {
  try {
    const data = bytesFromBase64(payloadB64);
    if (data.length < 13) return null;
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    const decrypted = await subtle.decrypt({name: 'AES-GCM', iv}, key, ciphertext);
    return new Uint8Array(decrypted);
  } catch {
    return null;
  }
}

function createLocalDeviceSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const secret = base64FromBytes(bytes);
  AsyncStorage.setItem(E2E_LOCAL_SECRET_KEY, secret).catch(() => {});
  return secret;
}

async function getStoredLocalDeviceSecret(): Promise<string | null> {
  return AsyncStorage.getItem(E2E_LOCAL_SECRET_KEY);
}

async function setStoredLocalDeviceSecret(secret: string): Promise<void> {
  await AsyncStorage.setItem(E2E_LOCAL_SECRET_KEY, secret);
}

async function getAccessTokenCandidates(currentToken?: string): Promise<string[]> {
  const tokens: string[] = [];
  const add = (value: string | null | undefined) => {
    const trimmed = value?.trim();
    if (trimmed && !tokens.includes(trimmed)) tokens.push(trimmed);
  };
  add(currentToken);
  try {
    add(await AsyncStorage.getItem('access_token'));
  } catch {
    // ignore
  }
  return tokens;
}

async function wrapDeviceSecret(
  localSecretB64: string,
  _accessToken: string,
  userId: string,
  saltB64: string,
): Promise<string> {
  const wrapKey = await deriveWrapKeyV2(userId, saltB64);
  const plain = new TextEncoder().encode(localSecretB64);
  return aesGcmEncrypt(wrapKey, plain);
}

async function unwrapDeviceSecret(
  wrappedB64: string,
  accessToken: string,
  userId: string,
  saltB64: string,
): Promise<{secret: string; usedLegacyWrap: boolean} | null> {
  const v2Key = await deriveWrapKeyV2(userId, saltB64);
  const v2Bytes = await aesGcmDecrypt(v2Key, wrappedB64);
  if (v2Bytes) {
    return {secret: new TextDecoder().decode(v2Bytes), usedLegacyWrap: false};
  }

  for (const token of await getAccessTokenCandidates(accessToken)) {
    const legacyKey = await deriveWrapKeyLegacy(token, userId, saltB64);
    const legacyBytes = await aesGcmDecrypt(legacyKey, wrappedB64);
    if (legacyBytes) {
      return {secret: new TextDecoder().decode(legacyBytes), usedLegacyWrap: true};
    }
  }

  // Very old profiles without per-user salt in wrap key
  const userOnlyKey = await sha256Raw(`vondic-e2e-wrap-user|${userId}`);
  const userOnlyBytes = await aesGcmDecrypt(userOnlyKey, wrappedB64);
  if (userOnlyBytes) {
    return {secret: new TextDecoder().decode(userOnlyBytes), usedLegacyWrap: true};
  }

  return null;
}

let backupMaterialPromise: Promise<BackupMaterial | null> | null = null;
let cachedBackupMaterial: BackupMaterial | null = null;
let cachedBackupMaterialUserId: string | null = null;

export async function ensureBackupMaterial(
  accessToken: string,
  userId: string,
): Promise<BackupMaterial | null> {
  if (!accessToken || !userId) return null;
  if (cachedBackupMaterial && cachedBackupMaterialUserId === userId) {
    return cachedBackupMaterial;
  }
  if (backupMaterialPromise) return backupMaterialPromise;

  backupMaterialPromise = (async () => {
    try {
      const data = await apiClient.get<{
        success?: boolean;
        salt?: string;
        wrapped_device_secret?: string | null;
      }>('/e2e-keys/backup-material');
      if (!data.success || !data.salt) return null;

      const salt = String(data.salt);
      await AsyncStorage.setItem(E2E_SALT_CACHE_KEY, salt);

      let localSecret: string | null = await getStoredLocalDeviceSecret();
      let shouldPublish = false;

      if (data.wrapped_device_secret) {
        const remote = await unwrapDeviceSecret(
          data.wrapped_device_secret,
          accessToken,
          userId,
          salt,
        );
        if (remote) {
          localSecret = remote.secret;
          await setStoredLocalDeviceSecret(localSecret);
          console.log(
            '[E2E] Unwrapped device secret; usedLegacyWrap=',
            remote.usedLegacyWrap,
          );
          if (remote.usedLegacyWrap) {
            shouldPublish = true;
          }
        } else if (!localSecret) {
          console.warn(
            '[E2E] Server has wrapped device secret but it could not be unwrapped',
          );
          return null;
        } else {
          console.warn(
            '[E2E] Server wrapped secret not unwrap-able, using local secret',
          );
        }
      } else {
        if (!localSecret) {
          localSecret = createLocalDeviceSecret();
        }
        shouldPublish = true;
      }

      if (shouldPublish && localSecret) {
        try {
          const wrapped = await wrapDeviceSecret(localSecret, accessToken, userId, salt);
          await apiClient.put('/e2e-keys/backup-material', {
            wrapped_device_secret: wrapped,
          });
          await setStoredLocalDeviceSecret(localSecret);
        } catch (err) {
          console.warn('[E2E] Failed to publish wrapped device secret:', err);
        }
      }

      if (!localSecret) return null;

      const material = {salt, localSecretB64: localSecret};
      cachedBackupMaterial = material;
      cachedBackupMaterialUserId = userId;
      return material;
    } catch (err) {
      console.error('[E2E] ensureBackupMaterial error:', err);
      return null;
    } finally {
      backupMaterialPromise = null;
    }
  })();

  return backupMaterialPromise;
}

export function normalizeE2eKeyId(keyId: string): string {
  if (!keyId || !keyId.includes(':')) return keyId;
  const parts = keyId.split(':');
  if (parts.length !== 2) return keyId;
  return parts.sort().join(':');
}

export function getE2eKeyIdVariants(userA: string, userB: string): string[] {
  const a = String(userA || '').trim();
  const b = String(userB || '').trim();
  if (!a || !b) return [];
  return [...new Set([normalizeE2eKeyId(`${a}:${b}`), `${a}:${b}`, `${b}:${a}`])];
}

export function expandKeyIdVariants(keyId: string): string[] {
  if (!keyId || !keyId.includes(':')) return [normalizeE2eKeyId(keyId)];
  const parts = keyId.split(':');
  if (parts.length !== 2) return [keyId];
  const [a, b] = parts;
  return [...new Set([keyId, normalizeE2eKeyId(keyId), `${a}:${b}`, `${b}:${a}`])];
}

function parseKeyPayload(decryptedBytes: Uint8Array): {keyId: string; keyData: Uint8Array} | null {
  if (decryptedBytes.length < 4) return null;
  const view = new DataView(decryptedBytes.buffer, decryptedBytes.byteOffset, decryptedBytes.byteLength);
  const keyIdLength = view.getUint16(0, false);
  if (keyIdLength <= 0 || 2 + keyIdLength > decryptedBytes.length) return null;
  const decoder = new TextDecoder();
  const keyId = decoder.decode(decryptedBytes.slice(2, 2 + keyIdLength));
  const keyData = decryptedBytes.slice(2 + keyIdLength);
  if (keyData.length === 0) return null;
  return {keyId, keyData};
}

async function tryDecryptPayload(
  encryptedData: string,
  masterKey: CryptoKey,
): Promise<{keyId: string; keyData: Uint8Array} | null> {
  try {
    const data = bytesFromBase64(encryptedData);
    if (data.length < 13) return null;
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);
    const decrypted = await subtle.decrypt({name: 'AES-GCM', iv}, masterKey, ciphertext);
    return parseKeyPayload(new Uint8Array(decrypted));
  } catch {
    return null;
  }
}

function arrayBufferEqual(a: ArrayBuffer, b: ArrayBuffer): boolean {
  if (a.byteLength !== b.byteLength) return false;
  const ua = new Uint8Array(a);
  const ub = new Uint8Array(b);
  for (let i = 0; i < ua.length; i++) {
    if (ua[i] !== ub[i]) return false;
  }
  return true;
}

async function collectMasterKeyCandidates(
  accessToken?: string,
  userId?: string,
  encryptionAlgorithm?: string,
): Promise<CryptoKey[]> {
  const v3Keys: CryptoKey[] = [];
  const legacyKeys: CryptoKey[] = [];
  const seen = new Set<ArrayBuffer>();
  const uid = userId ? String(userId) : undefined;

  const add = async (bucket: CryptoKey[], key: CryptoKey | null) => {
    if (!key) return;
    const raw = await subtle.exportKey('raw', key);
    if (seen.has(raw)) return;
    seen.add(raw);
    bucket.push(key);
  };

  if (accessToken && uid) {
    const material = await ensureBackupMaterial(accessToken, uid);
    if (material) {
      await add(v3Keys, await deriveV3MasterKey(uid, material.salt, material.localSecretB64));
    }
    try {
      const cachedSalt = await AsyncStorage.getItem(E2E_SALT_CACHE_KEY);
      const localSecret = await AsyncStorage.getItem(E2E_LOCAL_SECRET_KEY);
      if (cachedSalt && localSecret) {
        await add(v3Keys, await deriveV3MasterKey(uid, cachedSalt, localSecret));
      }
    } catch {
      // ignore
    }
  }

  for (const token of await getAccessTokenCandidates(accessToken)) {
    await add(legacyKeys, await deriveLegacyTokenKey(token));
  }
  if (uid) await add(legacyKeys, await deriveLegacyUserIdKey(uid));
  await add(legacyKeys, await getLegacyLocalMasterKey());

  const preferV3 =
    encryptionAlgorithm === 'aes-256-gcm-v3' || encryptionAlgorithm?.includes('v3');
  const preferLegacy =
    !encryptionAlgorithm ||
    encryptionAlgorithm === 'aes-256-gcm' ||
    encryptionAlgorithm === 'aes-256-gcm-v1';

  if (preferV3 && !preferLegacy) return [...v3Keys, ...legacyKeys];
  if (preferLegacy && !preferV3) return [...legacyKeys, ...v3Keys];
  return [...v3Keys, ...legacyKeys];
}

/**
 * Decrypt E2E key backup (tries v3 + legacy derivations silently).
 */
export async function decryptKeyFromBackup(
  encryptedData: string,
  accessToken?: string,
  userId?: string,
  expectedKeyId?: string,
  encryptionAlgorithm?: string,
): Promise<{keyId: string; keyData: Uint8Array} | null> {
  const candidates = await collectMasterKeyCandidates(
    accessToken,
    userId,
    encryptionAlgorithm,
  );

  for (const masterKey of candidates) {
    const parsed = await tryDecryptPayload(encryptedData, masterKey);
    if (!parsed?.keyData?.length) continue;

    const resolvedId = expectedKeyId ? normalizeE2eKeyId(expectedKeyId) : normalizeE2eKeyId(parsed.keyId);

    if (expectedKeyId && normalizeE2eKeyId(parsed.keyId) !== resolvedId) {
      // Payload may use legacy unsorted id; trust server key_id when decrypt ok.
      console.log('[E2E Key Sync] Decrypted backup with mismatched key_id, trusting expected');
      return {keyId: resolvedId, keyData: parsed.keyData};
    }

    console.log('[E2E Key Sync] Decrypted backup for', resolvedId, 'algo hint=', encryptionAlgorithm);
    return {keyId: resolvedId, keyData: parsed.keyData};
  }

  console.log('[E2E Key Sync] Failed to decrypt backup; candidates=', candidates.length, 'algo=', encryptionAlgorithm);
  return null;
}

async function encryptKeyForBackupInternal(
  keyId: string,
  keyData: Uint8Array,
  accessToken?: string,
  userId?: string,
): Promise<{encryptedKeyData: string; algorithm: string}> {
  const normalizedId = normalizeE2eKeyId(keyId);
  const encoder = new TextEncoder();
  const keyIdBytes = encoder.encode(normalizedId);
  const payload = new Uint8Array(2 + keyIdBytes.length + keyData.length);
  const view = new DataView(payload.buffer);
  view.setUint16(0, keyIdBytes.length, false);
  payload.set(keyIdBytes, 2);
  payload.set(keyData, 2 + keyIdBytes.length);

  let masterKey: CryptoKey | null = null;
  let algorithm = 'aes-256-gcm';

  if (accessToken && userId) {
    const material = await ensureBackupMaterial(accessToken, userId);
    if (material) {
      masterKey = await deriveV3MasterKey(userId, material.salt, material.localSecretB64);
      algorithm = 'aes-256-gcm-v3';
    }
  }

  if (!masterKey && accessToken) {
    masterKey = await deriveLegacyTokenKey(accessToken);
    algorithm = 'aes-256-gcm';
  }

  if (!masterKey && userId) {
    masterKey = await deriveLegacyUserIdKey(userId);
    algorithm = 'aes-256-gcm';
  }

  if (!masterKey) {
    const legacy = await getLegacyLocalMasterKey();
    if (!legacy) {
      const random = new Uint8Array(32);
      crypto.getRandomValues(random);
      await AsyncStorage.setItem(E2E_MASTER_KEY_STORAGE_KEY, base64FromBytes(random));
      masterKey = await getLegacyLocalMasterKey();
    } else {
      masterKey = legacy;
    }
    algorithm = 'aes-256-gcm';
  }

  const encrypted = await aesGcmEncrypt(masterKey!, payload);
  return {encryptedKeyData: encrypted, algorithm};
}

export async function encryptKeyForBackup(
  keyId: string,
  keyData: Uint8Array,
  accessToken?: string,
  userId?: string,
): Promise<string> {
  const result = await encryptKeyForBackupInternal(keyId, keyData, accessToken, userId);
  return result.encryptedKeyData;
}

export async function serverHasKeyBackup(
  _accessToken: string,
  keyId: string,
): Promise<boolean> {
  const wanted = new Set(expandKeyIdVariants(keyId).map(id => normalizeE2eKeyId(id)));
  try {
    const data = await apiClient.get<{success?: boolean; keys?: {key_id: string}[]}>(
      '/e2e-keys/list',
    );
    if (!data.success) return false;
    for (const row of data.keys || []) {
      if (wanted.has(normalizeE2eKeyId(String(row.key_id)))) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

export async function backupKeyToServer(
  accessToken: string,
  keyId: string,
  keyData: Uint8Array,
  deviceId?: string,
  deviceName?: string,
  userId?: string,
  options?: {allowOverwrite?: boolean},
): Promise<boolean> {
  try {
    if (!options?.allowOverwrite) {
      const exists = await serverHasKeyBackup(accessToken, keyId);
      if (exists) return true;
    }
    if (userId) {
      await ensureBackupMaterial(accessToken, userId);
    }
    const {encryptedKeyData, algorithm} = await encryptKeyForBackupInternal(
      keyId,
      keyData,
      accessToken,
      userId,
    );
    await apiClient.post('/e2e-keys/backup', {
      key_id: normalizeE2eKeyId(keyId),
      encrypted_key_data: encryptedKeyData,
      device_id: deviceId,
      device_name: deviceName,
      encryption_algorithm: algorithm,
    });
    console.log('[E2E Key Sync] Key backed up successfully:', keyId, algorithm);
    return true;
  } catch (error) {
    console.error('[E2E Key Sync] Backup error:', error);
    return false;
  }
}

export async function restoreKeyFromServer(
  accessToken: string,
  keyId: string,
  userId?: string,
): Promise<Uint8Array | null> {
  const cached = lookupCachedServerKey(keyId);
  if (cached?.length) return cached;

  if (isServerKeyKnownMissing(keyId)) return null;

  if (!serverKeysCachePrimed) {
    await beginServerKeysRestore(accessToken, userId);
    const afterBatch = lookupCachedServerKey(keyId);
    if (afterBatch?.length) return afterBatch;
  }

  const variants = expandKeyIdVariants(keyId);
  for (const variant of variants) {
    try {
      const data = await apiClient.post<{
        success: boolean;
        encrypted_key_data?: string;
        key_id?: string;
        encryption_algorithm?: string;
      }>('/e2e-keys/restore', {key_id: variant});
      if (!data.success || !data.encrypted_key_data) {
        if (data.success === false) {
          markServerKeyMissing(variant);
        }
        continue;
      }
      const decrypted = await decryptKeyFromBackup(
        data.encrypted_key_data,
        accessToken,
        userId,
        variant,
        data.encryption_algorithm,
      );
      if (decrypted?.keyData?.length) {
        mergeServerKeysCache(variant, decrypted.keyData);
        await persistKeyLocally(variant, decrypted.keyData);
        return decrypted.keyData;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export async function syncKeysToServer(
  accessToken: string,
  keyIds: string[],
  keysMap: Map<string, Uint8Array>,
  deviceId?: string,
  deviceName?: string,
  userId?: string,
): Promise<number> {
  try {
    if (userId) {
      await ensureBackupMaterial(accessToken, userId);
    }
    const keys = [];
    for (const keyId of keyIds) {
      const keyData = keysMap.get(keyId);
      if (!keyData) continue;
      const {encryptedKeyData} = await encryptKeyForBackupInternal(
        keyId,
        keyData,
        accessToken,
        userId,
      );
      keys.push({
        key_id: normalizeE2eKeyId(keyId),
        encrypted_key_data: encryptedKeyData,
      });
    }
    if (keys.length === 0) {
      console.log('[E2E Key Sync] No keys to sync');
      return 0;
    }
    const data = await apiClient.post<{synced_count?: number}>('/e2e-keys/sync', {
      keys,
      device_id: deviceId,
      device_name: deviceName,
    });
    console.log('[E2E Key Sync] Batch sync successful:', data.synced_count, 'keys');
    return data.synced_count || 0;
  } catch (error) {
    console.error('[E2E Key Sync] Batch sync error:', error);
    return 0;
  }
}

export async function restoreAllKeysFromServer(
  accessToken: string,
  userId?: string,
): Promise<Map<string, Uint8Array>> {
  const restoredKeys = new Map<string, Uint8Array>();
  try {
    if (userId) {
      await ensureBackupMaterial(accessToken, userId);
    }

    const listData = await apiClient.get<{success?: boolean; keys?: {key_id: string}[]}>(
      '/e2e-keys/list',
    );
    if (!listData.success || !listData.keys || listData.keys.length === 0) {
      console.log('[E2E Key Sync] No keys available on server');
      primeServerKeysCache(restoredKeys);
      return restoredKeys;
    }

    const keyIds = listData.keys.map((k: any) => normalizeE2eKeyId(k.key_id));
    const restoreData = await apiClient.post<{
      success?: boolean;
      keys?: {key_id: string; encrypted_key_data: string; encryption_algorithm?: string}[];
    }>('/e2e-keys/restore-batch', {key_ids: keyIds});

    if (!restoreData.success || !restoreData.keys) return restoredKeys;

    for (const keyItem of restoreData.keys) {
      const serverKeyId = normalizeE2eKeyId(keyItem.key_id);
      const decrypted = await decryptKeyFromBackup(
        keyItem.encrypted_key_data,
        accessToken,
        userId,
        serverKeyId,
        keyItem.encryption_algorithm,
      );
      if (decrypted?.keyData?.length) {
        const normalizedId = normalizeE2eKeyId(decrypted.keyId);
        restoredKeys.set(normalizedId, decrypted.keyData);
        await persistKeyLocally(normalizedId, decrypted.keyData);
        console.log('[E2E Key Sync] Key decrypted:', decrypted.keyId);
      }
    }

    primeServerKeysCache(restoredKeys);
    console.log('[E2E Key Sync] Restored', restoredKeys.size, 'keys');
  } catch (error) {
    console.error('[E2E Key Sync] Restore all keys error:', error);
  }
  return restoredKeys;
}

function primeServerKeysCache(keys: Map<string, Uint8Array>, replace = true) {
  if (replace) {
    serverKeysCache.clear();
    serverKeysKnownMissing.clear();
  }
  for (const [keyId, keyBytes] of keys.entries()) {
    for (const variant of expandKeyIdVariants(keyId)) {
      serverKeysCache.set(variant, keyBytes);
    }
  }
  serverKeysCachePrimed = true;
}

function mergeServerKeysCache(keyId: string, keyBytes: Uint8Array) {
  for (const variant of expandKeyIdVariants(keyId)) {
    serverKeysCache.set(variant, keyBytes);
  }
  serverKeysCachePrimed = true;
}

function markServerKeyMissing(keyId: string) {
  for (const variant of expandKeyIdVariants(keyId)) {
    serverKeysKnownMissing.add(variant);
  }
}

function isServerKeyKnownMissing(keyId: string): boolean {
  const variants = expandKeyIdVariants(keyId);
  return variants.length > 0 && variants.every(variant => serverKeysKnownMissing.has(variant));
}

export function isServerKeysCachePrimed(): boolean {
  return serverKeysCachePrimed;
}

export function beginServerKeysRestore(
  accessToken: string,
  userId?: string,
): Promise<Map<string, Uint8Array>> {
  if (restoreAllInFlight) return restoreAllInFlight;
  restoreAllInFlight = restoreAllKeysFromServer(accessToken, userId).finally(() => {
    restoreAllInFlight = null;
  });
  return restoreAllInFlight;
}

export function resetServerKeyRestoreResults() {
  serverKeysCache.clear();
  serverKeysKnownMissing.clear();
  serverKeysCachePrimed = false;
  restoreAllInFlight = null;
}

export function resetE2eRestoreCache() {
  resetServerKeyRestoreResults();
  cachedBackupMaterial = null;
  cachedBackupMaterialUserId = null;
  backupMaterialPromise = null;
}

export function lookupCachedServerKey(keyId: string): Uint8Array | null {
  for (const variant of expandKeyIdVariants(keyId)) {
    const hit = serverKeysCache.get(variant);
    if (hit?.length) return hit;
  }
  return null;
}

export async function persistKeyLocally(keyId: string, keyBytes: Uint8Array) {
  const b64 = base64FromBytes(keyBytes);
  for (const variant of expandKeyIdVariants(keyId)) {
    try {
      await AsyncStorage.setItem(`e2e_key_${variant}`, b64);
    } catch {
      // ignore storage errors
    }
  }
}

export async function getDeviceInfo(): Promise<{deviceId: string; deviceName: string}> {
  let deviceId = await AsyncStorage.getItem(E2E_DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId =
      'mobile_' +
      base64FromBytes(crypto.getRandomValues(new Uint8Array(16)))
        .replace(/[^a-zA-Z0-9]/g, '')
        .slice(0, 16);
    await AsyncStorage.setItem(E2E_DEVICE_ID_KEY, deviceId);
  }
  return {deviceId, deviceName: 'Vondic Mobile'};
}
