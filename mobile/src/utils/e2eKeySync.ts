/**
 * E2E Key Synchronization Service
 * Adapted for React Native — replaces localStorage with AsyncStorage.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import {crypto, subtle, base64FromBytes, bytesFromBase64} from './crypto';
import {apiClient} from '@/api/client';

const E2E_MASTER_KEY_STORAGE_KEY = 'e2e_master_key';

async function generateMasterKey(): Promise<CryptoKey> {
  const keyMaterial = new Uint8Array(32);
  crypto.getRandomValues(keyMaterial);
  return subtle.importKey(
    'raw',
    keyMaterial,
    {name: 'AES-GCM', length: 256},
    true,
    ['encrypt', 'decrypt'],
  );
}

async function deriveMasterKeyFromToken(accessToken: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(`vondic-e2e-backup:${accessToken}`);
  const hash = await subtle.digest('SHA-256', bytes);
  return subtle.importKey(
    'raw',
    hash,
    {name: 'AES-GCM', length: 256},
    true,
    ['encrypt', 'decrypt'],
  );
}

async function deriveMasterKeyFromUserId(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(`vondic-e2e-backup-user:${userId}`);
  const hash = await subtle.digest('SHA-256', bytes);
  return subtle.importKey(
    'raw',
    hash,
    {name: 'AES-GCM', length: 256},
    true,
    ['encrypt', 'decrypt'],
  );
}

export async function getMasterKey(accessToken?: string, userId?: string): Promise<CryptoKey> {
  if (userId) {
    return deriveMasterKeyFromUserId(userId);
  }
  if (accessToken) {
    return deriveMasterKeyFromToken(accessToken);
  }

  const stored = await AsyncStorage.getItem(E2E_MASTER_KEY_STORAGE_KEY);
  if (stored) {
    const keyData = bytesFromBase64(stored);
    return subtle.importKey(
      'raw',
      keyData,
      {name: 'AES-GCM', length: 256},
      true,
      ['encrypt', 'decrypt'],
    );
  }

  const masterKey = await generateMasterKey();
  const rawKey = await subtle.exportKey('raw', masterKey);
  await AsyncStorage.setItem(
    E2E_MASTER_KEY_STORAGE_KEY,
    base64FromBytes(new Uint8Array(rawKey)),
  );
  return masterKey;
}

export async function encryptKeyForBackup(
  keyId: string,
  keyData: Uint8Array,
  accessToken?: string,
  userId?: string,
): Promise<string> {
  const masterKey = await getMasterKey(accessToken, userId);
  const encoder = new TextEncoder();
  const keyIdBytes = encoder.encode(keyId);
  const payload = new Uint8Array(2 + keyIdBytes.length + keyData.length);
  const view = new DataView(payload.buffer);
  view.setUint16(0, keyIdBytes.length, false);
  payload.set(keyIdBytes, 2);
  payload.set(keyData, 2 + keyIdBytes.length);

  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const encrypted = await subtle.encrypt({name: 'AES-GCM', iv}, masterKey, payload);

  const result = new Uint8Array(iv.length + encrypted.byteLength);
  result.set(iv, 0);
  result.set(new Uint8Array(encrypted), iv.length);
  return base64FromBytes(result);
}

export async function decryptKeyFromBackup(
  encryptedData: string,
  accessToken?: string,
  userId?: string,
): Promise<{keyId: string; keyData: Uint8Array} | null> {
  try {
    const data = bytesFromBase64(encryptedData);
    if (data.length < 12) return null;
    const iv = data.slice(0, 12);
    const ciphertext = data.slice(12);

    let decrypted: ArrayBuffer | null = null;
    if (userId) {
      try {
        const masterKey = await getMasterKey(undefined, userId);
        decrypted = await subtle.decrypt({name: 'AES-GCM', iv}, masterKey, ciphertext);
      } catch {}
    }
    if (!decrypted && accessToken) {
      try {
        const masterKey = await getMasterKey(accessToken);
        decrypted = await subtle.decrypt({name: 'AES-GCM', iv}, masterKey, ciphertext);
      } catch {}
    }
    if (!decrypted) {
      const legacyKey = await getMasterKey();
      decrypted = await subtle.decrypt({name: 'AES-GCM', iv}, legacyKey, ciphertext);
    }

    const decryptedBytes = new Uint8Array(decrypted!);
    const view = new DataView(decryptedBytes.buffer);
    const keyIdLength = view.getUint16(0, false);
    const decoder = new TextDecoder();
    const keyId = decoder.decode(decryptedBytes.slice(2, 2 + keyIdLength));
    const keyData = decryptedBytes.slice(2 + keyIdLength);
    return {keyId, keyData};
  } catch (error) {
    console.error('[E2E Key Sync] Failed to decrypt key backup:', error);
    return null;
  }
}

export async function backupKeyToServer(
  accessToken: string,
  keyId: string,
  keyData: Uint8Array,
  deviceId?: string,
  deviceName?: string,
  userId?: string,
): Promise<boolean> {
  try {
    const encryptedKeyData = await encryptKeyForBackup(keyId, keyData, accessToken, userId);
    await apiClient.post('/e2e-keys/backup', {
      key_id: keyId,
      encrypted_key_data: encryptedKeyData,
      device_id: deviceId,
      device_name: deviceName,
      encryption_algorithm: 'aes-256-gcm',
    });
    console.log('[E2E Key Sync] Key backed up successfully:', keyId);
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
  try {
    const data = await apiClient.post<{success: boolean; encrypted_key_data?: string}>(
      '/e2e-keys/restore',
      {key_id: keyId},
    );
    if (!data.success || !data.encrypted_key_data) return null;
    const decrypted = await decryptKeyFromBackup(data.encrypted_key_data, accessToken, userId);
    if (!decrypted || decrypted.keyId !== keyId) {
      console.error('[E2E Key Sync] Decrypted key ID mismatch');
      return null;
    }
    console.log('[E2E Key Sync] Key restored successfully:', keyId);
    return decrypted.keyData;
  } catch (error) {
    console.error('[E2E Key Sync] Restore error:', error);
    return null;
  }
}

export async function syncKeysToServer(
  accessToken: string,
  keyIds: string[],
  keysMap: Map<string, Uint8Array>,
  deviceId?: string,
  deviceName?: string,
): Promise<number> {
  try {
    const keys = [];
    for (const keyId of keyIds) {
      const keyData = keysMap.get(keyId);
      if (keyData) {
        const encryptedKeyData = await encryptKeyForBackup(keyId, keyData, accessToken);
        keys.push({key_id: keyId, encrypted_key_data: encryptedKeyData});
      }
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
    const listData = await apiClient.get<{success?: boolean; keys?: {key_id: string}[]}>('/e2e-keys/list');
    if (!listData.success || !listData.keys || listData.keys.length === 0) {
      console.log('[E2E Key Sync] No keys available on server');
      return restoredKeys;
    }
    const keyIds = listData.keys.map((k: any) => k.key_id);
    const restoreData = await apiClient.post<{success?: boolean; keys?: {key_id: string; encrypted_key_data: string}[]}>(
      '/e2e-keys/restore-batch',
      {key_ids: keyIds},
    );
    if (!restoreData.success || !restoreData.keys) return restoredKeys;

    for (const keyItem of restoreData.keys) {
      const decrypted = await decryptKeyFromBackup(keyItem.encrypted_key_data, accessToken, userId);
      if (decrypted && decrypted.keyId === keyItem.key_id) {
        restoredKeys.set(decrypted.keyId, decrypted.keyData);
        console.log('[E2E Key Sync] Key decrypted:', decrypted.keyId);
      }
    }
    console.log('[E2E Key Sync] Restored', restoredKeys.size, 'keys');
  } catch (error) {
    console.error('[E2E Key Sync] Restore all keys error:', error);
  }
  return restoredKeys;
}

export function getDeviceInfo(): {deviceId: string; deviceName: string} {
  // RN: generate a stable device id using AsyncStorage if needed
  // For simplicity, return a random id here; caller should cache it
  const deviceId = 'mobile_' + Math.random().toString(36).slice(2);
  const deviceName = 'Vondic Mobile';
  return {deviceId, deviceName};
}
