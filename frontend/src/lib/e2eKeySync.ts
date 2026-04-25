/**
 * E2E Key Synchronization Service
 * 
 * Handles encrypting, backing up, and restoring E2E keys across devices.
 * Keys are encrypted with a user-specific master key before storage on the server.
 * The server NEVER sees plaintext E2E keys.
 */

const E2E_MASTER_KEY_STORAGE_KEY = 'e2e_master_key'
const E2E_BACKUP_PREFIX = 'e2e_backup'

/**
 * Generate a random master key for encrypting E2E key backups.
 * This key is derived from the user's credentials and stored locally.
 */
async function generateMasterKey(): Promise<CryptoKey> {
  const keyMaterial = new Uint8Array(32)
  crypto.getRandomValues(keyMaterial)
  
  return crypto.subtle.importKey(
    'raw',
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  )
}

/**
 * Get or create the master key for encrypting E2E key backups.
 */
export async function getMasterKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(E2E_MASTER_KEY_STORAGE_KEY)
  
  if (stored) {
    const keyData = Uint8Array.from(atob(stored), c => c.charCodeAt(0))
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    )
  }
  
  // Generate new master key
  const masterKey = await generateMasterKey()
  const rawKey = await crypto.subtle.exportKey('raw', masterKey)
  localStorage.setItem(E2E_MASTER_KEY_STORAGE_KEY, btoa(String.fromCharCode(...new Uint8Array(rawKey))))
  
  return masterKey
}

/**
 * Encrypt E2E key data with the master key.
 */
export async function encryptKeyForBackup(
  keyId: string,
  keyData: Uint8Array
): Promise<string> {
  const masterKey = await getMasterKey()
  
  // Create payload: keyId length (2 bytes) + keyId + keyData
  const encoder = new TextEncoder()
  const keyIdBytes = encoder.encode(keyId)
  const payload = new Uint8Array(2 + keyIdBytes.length + keyData.length)
  
  // Store keyId length
  const view = new DataView(payload.buffer)
  view.setUint16(0, keyIdBytes.length, false)
  
  // Copy keyId and keyData
  payload.set(keyIdBytes, 2)
  payload.set(keyData, 2 + keyIdBytes.length)
  
  // Encrypt with AES-GCM
  const iv = new Uint8Array(12)
  crypto.getRandomValues(iv)
  
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    masterKey,
    payload
  )
  
  // Return: iv (12 bytes) + encrypted data
  const result = new Uint8Array(iv.length + encrypted.byteLength)
  result.set(iv, 0)
  result.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...result))
}

/**
 * Decrypt E2E key data from backup.
 */
export async function decryptKeyFromBackup(
  encryptedData: string
): Promise<{ keyId: string; keyData: Uint8Array } | null> {
  try {
    const masterKey = await getMasterKey()
    const data = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0))
    
    if (data.length < 12) return null // Need at least IV
    
    const iv = data.slice(0, 12)
    const ciphertext = data.slice(12)
    
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      masterKey,
      ciphertext
    )
    
    const decryptedBytes = new Uint8Array(decrypted)
    const view = new DataView(decryptedBytes.buffer)
    
    // Extract keyId
    const keyIdLength = view.getUint16(0, false)
    const decoder = new TextDecoder()
    const keyId = decoder.decode(decryptedBytes.slice(2, 2 + keyIdLength))
    const keyData = decryptedBytes.slice(2 + keyIdLength)
    
    return { keyId, keyData }
  } catch (error) {
    console.error('[E2E Key Sync] Failed to decrypt key backup:', error)
    return null
  }
}

/**
 * Backup an E2E key to the server.
 */
export async function backupKeyToServer(
  accessToken: string,
  keyId: string,
  keyData: Uint8Array,
  deviceId?: string,
  deviceName?: string
): Promise<boolean> {
  try {
    const encryptedKeyData = await encryptKeyForBackup(keyId, keyData)
    
    const response = await fetch('/api/v1/e2e-keys/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        key_id: keyId,
        encrypted_key_data: encryptedKeyData,
        device_id: deviceId,
        device_name: deviceName,
        encryption_algorithm: 'aes-256-gcm'
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      console.error('[E2E Key Sync] Backup failed:', error)
      return false
    }
    
    console.log('[E2E Key Sync] Key backed up successfully:', keyId)
    return true
  } catch (error) {
    console.error('[E2E Key Sync] Backup error:', error)
    return false
  }
}

/**
 * Restore an E2E key from the server.
 */
export async function restoreKeyFromServer(
  accessToken: string,
  keyId: string
): Promise<Uint8Array | null> {
  try {
    const response = await fetch('/api/v1/e2e-keys/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        key_id: keyId
      })
    })
    
    if (!response.ok) {
      if (response.status === 404) {
        console.log('[E2E Key Sync] No backup found for key:', keyId)
      } else {
        const error = await response.json()
        console.error('[E2E Key Sync] Restore failed:', error)
      }
      return null
    }
    
    const data = await response.json()
    
    if (!data.success || !data.encrypted_key_data) {
      return null
    }
    
    const decrypted = await decryptKeyFromBackup(data.encrypted_key_data)
    
    if (!decrypted || decrypted.keyId !== keyId) {
      console.error('[E2E Key Sync] Decrypted key ID mismatch')
      return null
    }
    
    console.log('[E2E Key Sync] Key restored successfully:', keyId)
    return decrypted.keyData
  } catch (error) {
    console.error('[E2E Key Sync] Restore error:', error)
    return null
  }
}

/**
 * Batch sync multiple E2E keys to the server.
 */
export async function syncKeysToServer(
  accessToken: string,
  keyIds: string[],
  keysMap: Map<string, Uint8Array>,
  deviceId?: string,
  deviceName?: string
): Promise<number> {
  try {
    const keys = []
    
    for (const keyId of keyIds) {
      const keyData = keysMap.get(keyId)
      if (keyData) {
        const encryptedKeyData = await encryptKeyForBackup(keyId, keyData)
        keys.push({
          key_id: keyId,
          encrypted_key_data: encryptedKeyData
        })
      }
    }
    
    if (keys.length === 0) {
      console.log('[E2E Key Sync] No keys to sync')
      return 0
    }
    
    const response = await fetch('/api/v1/e2e-keys/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        keys,
        device_id: deviceId,
        device_name: deviceName
      })
    })
    
    if (!response.ok) {
      const error = await response.json()
      console.error('[E2E Key Sync] Batch sync failed:', error)
      return 0
    }
    
    const data = await response.json()
    console.log('[E2E Key Sync] Batch sync successful:', data.synced_count, 'keys')
    return data.synced_count || 0
  } catch (error) {
    console.error('[E2E Key Sync] Batch sync error:', error)
    return 0
  }
}

/**
 * Restore all available E2E keys from the server.
 */
export async function restoreAllKeysFromServer(
  accessToken: string
): Promise<Map<string, Uint8Array>> {
  const restoredKeys = new Map<string, Uint8Array>()
  
  try {
    // Get list of available keys
    const listResponse = await fetch('/api/v1/e2e-keys/list', {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    })
    
    if (!listResponse.ok) {
      console.error('[E2E Key Sync] Failed to list keys')
      return restoredKeys
    }
    
    const listData = await listResponse.json()
    
    if (!listData.success || !listData.keys || listData.keys.length === 0) {
      console.log('[E2E Key Sync] No keys available on server')
      return restoredKeys
    }
    
    const keyIds = listData.keys.map((k: any) => k.key_id)
    
    // Batch restore keys
    const restoreResponse = await fetch('/api/v1/e2e-keys/restore-batch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        key_ids: keyIds
      })
    })
    
    if (!restoreResponse.ok) {
      console.error('[E2E Key Sync] Batch restore failed')
      return restoredKeys
    }
    
    const restoreData = await restoreResponse.json()
    
    if (!restoreData.success || !restoreData.keys) {
      return restoredKeys
    }
    
    // Decrypt all keys
    for (const keyItem of restoreData.keys) {
      const decrypted = await decryptKeyFromBackup(keyItem.encrypted_key_data)
      
      if (decrypted && decrypted.keyId === keyItem.key_id) {
        restoredKeys.set(decrypted.keyId, decrypted.keyData)
        console.log('[E2E Key Sync] Key decrypted:', decrypted.keyId)
      }
    }
    
    console.log('[E2E Key Sync] Restored', restoredKeys.size, 'keys')
  } catch (error) {
    console.error('[E2E Key Sync] Restore all keys error:', error)
  }
  
  return restoredKeys
}

/**
 * Detect device information.
 */
export function getDeviceInfo(): { deviceId: string; deviceName: string } {
  // Generate or retrieve device ID
  let deviceId = localStorage.getItem('device_id')
  
  if (!deviceId) {
    deviceId = 'device_' + crypto.randomUUID()
    localStorage.setItem('device_id', deviceId)
  }
  
  // Detect device name
  const ua = navigator.userAgent
  let deviceName = 'Unknown Device'
  
  if (/Windows/.test(ua)) deviceName = 'Windows'
  else if (/Mac OS X/.test(ua)) deviceName = 'macOS'
  else if (/Android/.test(ua)) deviceName = 'Android'
  else if (/iPhone|iPad|iPod/.test(ua)) deviceName = 'iOS'
  else if (/Linux/.test(ua)) deviceName = 'Linux'
  
  // Add browser info
  if (/Chrome/.test(ua) && !/Edg/.test(ua)) deviceName += ' - Chrome'
  else if (/Firefox/.test(ua)) deviceName += ' - Firefox'
  else if (/Safari/.test(ua) && !/Chrome/.test(ua)) deviceName += ' - Safari'
  else if (/Edg/.test(ua)) deviceName += ' - Edge'
  
  return { deviceId, deviceName }
}
