/**
 * E2E Key Synchronization — client-side encrypted backups.
 *
 * v3: master = SHA256(userId + serverSalt + localDeviceSecret)
 * - serverSalt: random per user, only via authenticated API (not guessable from userId alone)
 * - localDeviceSecret: random per browser profile, synced wrapped with session key
 *
 * Legacy v1/v2 backups are still decrypted when possible (token-only / userId-only).
 */

const E2E_MASTER_KEY_STORAGE_KEY = 'e2e_master_key'
const E2E_LOCAL_SECRET_KEY = 'e2e_device_secret_v1'
const E2E_SALT_CACHE_KEY = 'e2e_backup_salt_cache'

type BackupMaterial = {
	salt: string
	localSecretB64: string
}

const bytesToB64 = (bytes: Uint8Array) => {
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

const b64ToBytes = (b64: string) =>
	Uint8Array.from(atob(b64), c => c.charCodeAt(0))

async function sha256Raw(input: string): Promise<CryptoKey> {
	const encoder = new TextEncoder()
	const hash = await crypto.subtle.digest('SHA-256', encoder.encode(input))
	return crypto.subtle.importKey(
		'raw',
		hash,
		{ name: 'AES-GCM', length: 256 },
		false,
		['encrypt', 'decrypt'],
	)
}

async function deriveLegacyTokenKey(accessToken: string): Promise<CryptoKey> {
	return sha256Raw(`vondic-e2e-backup:${accessToken}`)
}

async function deriveLegacyUserIdKey(userId: string): Promise<CryptoKey> {
	return sha256Raw(`vondic-e2e-backup-user:${userId}`)
}

async function deriveV3MasterKey(
	userId: string,
	saltB64: string,
	localSecretB64: string,
): Promise<CryptoKey> {
	return sha256Raw(
		`vondic-e2e-v3|${userId}|${saltB64}|${localSecretB64}`,
	)
}

/** Stable wrap key (survives access_token rotation after server restart). */
async function deriveWrapKeyV2(
	userId: string,
	saltB64: string,
): Promise<CryptoKey> {
	return sha256Raw(`vondic-e2e-wrap-v2|${userId}|${saltB64}`)
}

/** @deprecated Legacy — tied to access_token; kept for unwrap only. */
async function deriveWrapKeyLegacy(
	accessToken: string,
	userId: string,
	saltB64: string,
): Promise<CryptoKey> {
	return sha256Raw(`vondic-e2e-wrap|${userId}|${saltB64}|${accessToken}`)
}

async function getLegacyLocalMasterKey(): Promise<CryptoKey | null> {
	const stored = localStorage.getItem(E2E_MASTER_KEY_STORAGE_KEY)
	if (!stored) return null
	try {
		const keyData = b64ToBytes(stored)
		return crypto.subtle.importKey(
			'raw',
			keyData,
			{ name: 'AES-GCM', length: 256 },
			false,
			['encrypt', 'decrypt'],
		)
	} catch {
		return null
	}
}

function createLocalDeviceSecret(): string {
	const bytes = new Uint8Array(32)
	crypto.getRandomValues(bytes)
	const local = bytesToB64(bytes)
	localStorage.setItem(E2E_LOCAL_SECRET_KEY, local)
	return local
}

function getStoredLocalDeviceSecret(): string | null {
	return localStorage.getItem(E2E_LOCAL_SECRET_KEY)
}

function getAccessTokenCandidates(currentToken?: string): string[] {
	const tokens: string[] = []
	const add = (value: string | null | undefined) => {
		const trimmed = value?.trim()
		if (trimmed && !tokens.includes(trimmed)) tokens.push(trimmed)
	}
	add(currentToken)
	if (typeof window !== 'undefined') {
		add(localStorage.getItem('access_token'))
		add(sessionStorage.getItem('access_token'))
	}
	return tokens
}

async function aesGcmEncrypt(
	key: CryptoKey,
	plaintext: Uint8Array,
): Promise<string> {
	const iv = new Uint8Array(12)
	crypto.getRandomValues(iv)
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		key,
		plaintext,
	)
	const out = new Uint8Array(iv.length + encrypted.byteLength)
	out.set(iv, 0)
	out.set(new Uint8Array(encrypted), iv.length)
	return bytesToB64(out)
}

async function aesGcmDecrypt(
	key: CryptoKey,
	payloadB64: string,
): Promise<Uint8Array | null> {
	try {
		const data = b64ToBytes(payloadB64)
		if (data.length < 13) return null
		const iv = data.slice(0, 12)
		const ciphertext = data.slice(12)
		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			key,
			ciphertext,
		)
		return new Uint8Array(decrypted)
	} catch {
		return null
	}
}

async function wrapDeviceSecret(
	localSecretB64: string,
	_accessToken: string,
	userId: string,
	saltB64: string,
): Promise<string> {
	const wrapKey = await deriveWrapKeyV2(userId, saltB64)
	const plain = new TextEncoder().encode(localSecretB64)
	return aesGcmEncrypt(wrapKey, plain)
}

async function unwrapDeviceSecret(
	wrappedB64: string,
	accessToken: string,
	userId: string,
	saltB64: string,
): Promise<{ secret: string; usedLegacyWrap: boolean } | null> {
	const v2Key = await deriveWrapKeyV2(userId, saltB64)
	const v2Bytes = await aesGcmDecrypt(v2Key, wrappedB64)
	if (v2Bytes) {
		return { secret: new TextDecoder().decode(v2Bytes), usedLegacyWrap: false }
	}

	for (const token of getAccessTokenCandidates(accessToken)) {
		const legacyKey = await deriveWrapKeyLegacy(token, userId, saltB64)
		const legacyBytes = await aesGcmDecrypt(legacyKey, wrappedB64)
		if (legacyBytes) {
			return { secret: new TextDecoder().decode(legacyBytes), usedLegacyWrap: true }
		}
	}

	// Very old profiles without per-user salt in wrap key
	const userOnlyKey = await sha256Raw(`vondic-e2e-wrap-user|${userId}`)
	const userOnlyBytes = await aesGcmDecrypt(userOnlyKey, wrappedB64)
	if (userOnlyBytes) {
		return { secret: new TextDecoder().decode(userOnlyBytes), usedLegacyWrap: true }
	}

	return null
}

let backupMaterialPromise: Promise<BackupMaterial | null> | null = null
let cachedBackupMaterial: BackupMaterial | null = null
let cachedBackupMaterialUserId: string | null = null

/**
 * Re-encrypt all locally stored E2E keys with the current v3 master key and push
 * them to the server. Used when the device secret is lost/rotated so other
 * devices can still restore the keys.
 */
async function rebackupLocalE2eKeys(
	accessToken: string,
	userId: string,
): Promise<void> {
	if (typeof window === 'undefined' || !localStorage) return

	const keys = new Map<string, Uint8Array>()
	for (let i = 0; i < localStorage.length; i++) {
		const storageKey = localStorage.key(i)
		if (!storageKey || !storageKey.startsWith('e2e_key_')) continue
		const keyId = storageKey.slice('e2e_key_'.length)
		try {
			const b64 = localStorage.getItem(storageKey)
			if (!b64) continue
			keys.set(keyId, b64ToBytes(b64))
		} catch {
			// ignore corrupt entries
		}
	}
	if (keys.size === 0) return

	const { deviceId, deviceName } = getDeviceInfo()
	for (const [keyId, keyData] of keys.entries()) {
		try {
			await backupKeyToServer(
				accessToken,
				keyId,
				keyData,
				deviceId,
				deviceName,
				userId,
				{ allowOverwrite: true },
			)
		} catch {
			// ignore individual backup failures
		}
	}
}

/**
 * Ensures v3 backup material: server salt + local device secret (synced when possible).
 */
export async function ensureBackupMaterial(
	accessToken: string,
	userId: string,
): Promise<BackupMaterial | null> {
	if (!accessToken || !userId) return null

	if (
		cachedBackupMaterial &&
		cachedBackupMaterialUserId === userId
	) {
		return cachedBackupMaterial
	}

	if (backupMaterialPromise) return backupMaterialPromise

	backupMaterialPromise = (async () => {
		try {
			const res = await fetch('/api/v1/e2e-keys/backup-material', {
				headers: { Authorization: `Bearer ${accessToken}` },
				credentials: 'include',
			})
			if (!res.ok) return null

			const data = await res.json()
			if (!data?.success || !data.salt) return null

			const salt = String(data.salt)
			localStorage.setItem(E2E_SALT_CACHE_KEY, salt)

			let localSecret = getStoredLocalDeviceSecret()
			let shouldPublishWrapped = false
			let rotatedDeviceSecret = false

			if (data.wrapped_device_secret) {
				const remote = await unwrapDeviceSecret(
					data.wrapped_device_secret,
					accessToken,
					userId,
					salt,
				)
				if (remote) {
					localSecret = remote.secret
					localStorage.setItem(E2E_LOCAL_SECRET_KEY, localSecret)
					if (remote.usedLegacyWrap) {
						shouldPublishWrapped = true
					}
				} else if (!localSecret) {
					// The server copy is wrapped with a legacy key we don't have, and
					// this browser has no cached device secret. Create a fresh device
					// secret, publish it with the stable v2 wrap key, and re-backup all
					// locally known E2E keys so other devices can restore them.
					console.warn(
						'[E2E] Server wrapped secret unreadable and no local secret; rotating device secret',
					)
					localSecret = createLocalDeviceSecret()
					shouldPublishWrapped = true
					rotatedDeviceSecret = true
				} else {
					// Local secret is available but the server copy is wrapped with a
					// legacy key we no longer have (e.g. another device/session).
					// Re-publish it with the stable v2 wrap key so other devices can
					// restore backups.
					console.warn(
						'[E2E] Server wrapped secret uses legacy wrap; re-publishing with v2',
					)
					shouldPublishWrapped = true
				}
			} else {
				if (!localSecret) {
					localSecret = createLocalDeviceSecret()
				}
				shouldPublishWrapped = true
			}

			if (shouldPublishWrapped && localSecret) {
				const wrapped = await wrapDeviceSecret(
					localSecret,
					accessToken,
					userId,
					salt,
				)
				await fetch('/api/v1/e2e-keys/backup-material', {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${accessToken}`,
					},
					credentials: 'include',
					body: JSON.stringify({ wrapped_device_secret: wrapped }),
				})
			}

			if (rotatedDeviceSecret && localSecret) {
				console.log('[E2E] Re-backing up local keys with new device secret')
				await rebackupLocalE2eKeys(accessToken, userId)
			}

			if (!localSecret) return null

			const material = { salt, localSecretB64: localSecret }
			cachedBackupMaterial = material
			cachedBackupMaterialUserId = userId
			return material
		} catch {
			return null
		} finally {
			backupMaterialPromise = null
		}
	})()

	return backupMaterialPromise
}

export function normalizeE2eKeyId(keyId: string): string {
	if (!keyId || !keyId.includes(':')) return keyId
	const parts = keyId.split(':')
	if (parts.length !== 2) return keyId
	return parts.sort().join(':')
}

/** Sorted + legacy unsorted key ids for one DM pair. */
export function getE2eKeyIdVariants(
	userA: string,
	userB: string,
): string[] {
	const a = String(userA).trim()
	const b = String(userB).trim()
	if (!a || !b) return []
	return [...new Set([normalizeE2eKeyId(`${a}:${b}`), `${a}:${b}`, `${b}:${a}`])]
}

export function expandKeyIdVariants(keyId: string): string[] {
	if (!keyId.includes(':')) return [normalizeE2eKeyId(keyId)]
	const parts = keyId.split(':')
	if (parts.length !== 2) return [keyId]
	const [a, b] = parts
	return [...new Set([keyId, normalizeE2eKeyId(keyId), `${a}:${b}`, `${b}:${a}`])]
}

const serverKeysCache = new Map<string, Uint8Array>()
const serverKeysKnownMissing = new Set<string>()
let serverKeysCachePrimed = false
let restoreAllInFlight: Promise<Map<string, Uint8Array>> | null = null

export function isServerKeysCachePrimed(): boolean {
	return serverKeysCachePrimed
}

/** Deduped batch restore — await before per-chat restore to avoid races. */
export function beginServerKeysRestore(
	accessToken: string,
	userId?: string,
): Promise<Map<string, Uint8Array>> {
	if (restoreAllInFlight) return restoreAllInFlight
	restoreAllInFlight = restoreAllKeysFromServer(accessToken, userId).finally(
		() => {
			restoreAllInFlight = null
		},
	)
	return restoreAllInFlight
}

/** Drop cached restore results so decrypt can be retried (keeps backup material). */
export function resetServerKeyRestoreResults() {
	serverKeysCache.clear()
	serverKeysKnownMissing.clear()
	serverKeysCachePrimed = false
	restoreAllInFlight = null
}

/** Call after login / access_token change so keys are fetched again. */
export function resetE2eRestoreCache() {
	resetServerKeyRestoreResults()
	cachedBackupMaterial = null
	cachedBackupMaterialUserId = null
	backupMaterialPromise = null
}

export async function serverHasKeyBackup(
	accessToken: string,
	keyId: string,
): Promise<boolean> {
	const wanted = new Set(
		expandKeyIdVariants(keyId).map(id => normalizeE2eKeyId(id)),
	)
	try {
		const response = await fetch('/api/v1/e2e-keys/list', {
			headers: { Authorization: `Bearer ${accessToken}` },
			credentials: 'include',
		})
		if (!response.ok) return false
		const data = await response.json()
		if (!data.success) return false
		for (const row of data.keys || []) {
			if (wanted.has(normalizeE2eKeyId(String(row.key_id)))) {
				return true
			}
		}
	} catch {
		// ignore
	}
	return false
}

function markServerKeyMissing(keyId: string) {
	for (const variant of expandKeyIdVariants(keyId)) {
		serverKeysKnownMissing.add(variant)
	}
}

function isServerKeyKnownMissing(keyId: string): boolean {
	const variants = expandKeyIdVariants(keyId)
	return (
		variants.length > 0 &&
		variants.every(variant => serverKeysKnownMissing.has(variant))
	)
}

/** Register keys from batch restore (all id variants alias to same bytes). */
export function primeServerKeysCache(
	keys: Map<string, Uint8Array>,
	replace = true,
) {
	if (replace) {
		serverKeysCache.clear()
	}
	for (const [keyId, keyBytes] of keys.entries()) {
		for (const variant of expandKeyIdVariants(keyId)) {
			serverKeysCache.set(variant, keyBytes)
		}
	}
	serverKeysCachePrimed = true
}

export function mergeServerKeysCache(keyId: string, keyBytes: Uint8Array) {
	for (const variant of expandKeyIdVariants(keyId)) {
		serverKeysCache.set(variant, keyBytes)
	}
	serverKeysCachePrimed = true
}

export function lookupCachedServerKey(keyId: string): Uint8Array | null {
	for (const variant of expandKeyIdVariants(keyId)) {
		const hit = serverKeysCache.get(variant)
		if (hit?.length) return hit
	}
	return null
}

export function persistKeyLocally(keyId: string, keyBytes: Uint8Array) {
	const b64 = bytesToB64(keyBytes)
	for (const variant of expandKeyIdVariants(keyId)) {
		try {
			localStorage.setItem(`e2e_key_${variant}`, b64)
		} catch {
			// ignore quota
		}
	}
	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('e2e-keys-updated'))
	}
}

function parseKeyPayload(decryptedBytes: Uint8Array): {
	keyId: string
	keyData: Uint8Array
} | null {
	if (decryptedBytes.length < 4) return null
	const view = new DataView(
		decryptedBytes.buffer,
		decryptedBytes.byteOffset,
		decryptedBytes.byteLength,
	)
	const keyIdLength = view.getUint16(0, false)
	if (keyIdLength <= 0 || 2 + keyIdLength > decryptedBytes.length) return null
	const decoder = new TextDecoder()
	const keyId = decoder.decode(
		decryptedBytes.slice(2, 2 + keyIdLength),
	)
	const keyData = decryptedBytes.slice(2 + keyIdLength)
	if (keyData.length === 0) return null
	return { keyId, keyData }
}

async function tryDecryptPayload(
	encryptedData: string,
	masterKey: CryptoKey,
): Promise<{ keyId: string; keyData: Uint8Array } | null> {
	try {
		const data = b64ToBytes(encryptedData)
		if (data.length < 13) return null
		const iv = data.slice(0, 12)
		const ciphertext = data.slice(12)
		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			masterKey,
			ciphertext,
		)
		return parseKeyPayload(new Uint8Array(decrypted))
	} catch {
		return null
	}
}

async function collectMasterKeyCandidates(
	accessToken?: string,
	userId?: string,
	encryptionAlgorithm?: string,
): Promise<CryptoKey[]> {
	const v3Keys: CryptoKey[] = []
	const legacyKeys: CryptoKey[] = []
	const seen = new Set<ArrayBuffer>()
	const uid = userId ? String(userId) : undefined

	const add = async (bucket: CryptoKey[], key: CryptoKey | null) => {
		if (!key) return
		const raw = await crypto.subtle.exportKey('raw', key)
		if (seen.has(raw)) return
		seen.add(raw)
		bucket.push(key)
	}

	if (accessToken && uid) {
		const material = await ensureBackupMaterial(accessToken, uid)
		if (material) {
			await add(
				v3Keys,
				deriveV3MasterKey(uid, material.salt, material.localSecretB64),
			)
		}
		const cachedSalt = localStorage.getItem(E2E_SALT_CACHE_KEY)
		const localSecret = localStorage.getItem(E2E_LOCAL_SECRET_KEY)
		if (cachedSalt && localSecret) {
			await add(v3Keys, deriveV3MasterKey(uid, cachedSalt, localSecret))
		}
	}

	for (const token of getAccessTokenCandidates(accessToken)) {
		await add(legacyKeys, deriveLegacyTokenKey(token))
	}
	if (uid) await add(legacyKeys, deriveLegacyUserIdKey(uid))
	await add(legacyKeys, getLegacyLocalMasterKey())

	const preferV3 =
		encryptionAlgorithm === 'aes-256-gcm-v3' ||
		encryptionAlgorithm?.includes('v3')
	const preferLegacy =
		!encryptionAlgorithm ||
		encryptionAlgorithm === 'aes-256-gcm' ||
		encryptionAlgorithm === 'aes-256-gcm-v1'

	if (preferV3 && !preferLegacy) return [...v3Keys, ...legacyKeys]
	if (preferLegacy && !preferV3) return [...legacyKeys, ...v3Keys]
	return [...v3Keys, ...legacyKeys]
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
): Promise<{ keyId: string; keyData: Uint8Array } | null> {
	const candidates = await collectMasterKeyCandidates(
		accessToken,
		userId,
		encryptionAlgorithm,
	)

	for (const masterKey of candidates) {
		const parsed = await tryDecryptPayload(encryptedData, masterKey)
		if (!parsed?.keyData?.length) continue

		const resolvedId = expectedKeyId
			? normalizeE2eKeyId(expectedKeyId)
			: normalizeE2eKeyId(parsed.keyId)

		if (
			expectedKeyId &&
			normalizeE2eKeyId(parsed.keyId) !== resolvedId
		) {
			// Payload may use legacy unsorted id; trust server key_id when decrypt ok.
			return { keyId: resolvedId, keyData: parsed.keyData }
		}

		return { keyId: resolvedId, keyData: parsed.keyData }
	}

	return null
}

/**
 * Encrypt E2E key for server backup (prefers secure v3).
 */
export async function encryptKeyForBackup(
	keyId: string,
	keyData: Uint8Array,
	accessToken?: string,
	userId?: string,
): Promise<string> {
	const normalizedId = normalizeE2eKeyId(keyId)
	const encoder = new TextEncoder()
	const keyIdBytes = encoder.encode(normalizedId)
	const payload = new Uint8Array(2 + keyIdBytes.length + keyData.length)
	const view = new DataView(payload.buffer)
	view.setUint16(0, keyIdBytes.length, false)
	payload.set(keyIdBytes, 2)
	payload.set(keyData, 2 + keyIdBytes.length)

	let masterKey: CryptoKey | null = null
	if (accessToken && userId) {
		const material = await ensureBackupMaterial(accessToken, userId)
		if (material) {
			masterKey = await deriveV3MasterKey(
				userId,
				material.salt,
				material.localSecretB64,
			)
		}
	}
	if (!masterKey && accessToken) {
		masterKey = await deriveLegacyTokenKey(accessToken)
	}
	if (!masterKey && userId) {
		masterKey = await deriveLegacyUserIdKey(userId)
	}
	if (!masterKey) {
		const legacy = await getLegacyLocalMasterKey()
		if (!legacy) {
			const random = new Uint8Array(32)
			crypto.getRandomValues(random)
			localStorage.setItem(
				E2E_MASTER_KEY_STORAGE_KEY,
				bytesToB64(random),
			)
			masterKey = await getLegacyLocalMasterKey()
		} else {
			masterKey = legacy
		}
	}

	const iv = new Uint8Array(12)
	crypto.getRandomValues(iv)
	const encrypted = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		masterKey!,
		payload,
	)
	const result = new Uint8Array(iv.length + encrypted.byteLength)
	result.set(iv, 0)
	result.set(new Uint8Array(encrypted), iv.length)
	return bytesToB64(result)
}

export async function backupKeyToServer(
	accessToken: string,
	keyId: string,
	keyData: Uint8Array,
	deviceId?: string,
	deviceName?: string,
	userId?: string,
	options?: { allowOverwrite?: boolean },
): Promise<boolean> {
	try {
		if (!options?.allowOverwrite) {
			const exists = await serverHasKeyBackup(accessToken, keyId)
			if (exists) return true
		}
		if (userId) {
			await ensureBackupMaterial(accessToken, userId)
		}
		const encryptedKeyData = await encryptKeyForBackup(
			keyId,
			keyData,
			accessToken,
			userId,
		)

		const response = await fetch('/api/v1/e2e-keys/backup', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			credentials: 'include',
			body: JSON.stringify({
				key_id: normalizeE2eKeyId(keyId),
				encrypted_key_data: encryptedKeyData,
				device_id: deviceId,
				device_name: deviceName,
				encryption_algorithm: 'aes-256-gcm-v3',
			}),
		})

		return response.ok
	} catch {
		return false
	}
}

export async function restoreKeyFromServer(
	accessToken: string,
	keyId: string,
	userId?: string,
): Promise<Uint8Array | null> {
	const cached = lookupCachedServerKey(keyId)
	if (cached?.length) {
		return cached
	}

	if (isServerKeyKnownMissing(keyId)) {
		return null
	}

	if (!serverKeysCachePrimed) {
		await beginServerKeysRestore(accessToken, userId)
		const afterBatch = lookupCachedServerKey(keyId)
		if (afterBatch?.length) return afterBatch
	}

	const variants = expandKeyIdVariants(keyId)
	for (const variant of variants) {
		try {
			const response = await fetch('/api/v1/e2e-keys/restore', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${accessToken}`,
				},
				credentials: 'include',
				body: JSON.stringify({ key_id: variant }),
			})

			if (!response.ok) continue

			const data = await response.json()
			if (!data.success || !data.encrypted_key_data) {
				if (response.ok && data.success === false) {
					markServerKeyMissing(variant)
				}
				continue
			}

			const decrypted = await decryptKeyFromBackup(
				data.encrypted_key_data,
				accessToken,
				userId,
				variant,
				data.encryption_algorithm,
			)

			if (decrypted?.keyData?.length) {
				mergeServerKeysCache(variant, decrypted.keyData)
				persistKeyLocally(variant, decrypted.keyData)
				return decrypted.keyData
			}
		} catch {
			continue
		}
	}

	return null
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
			await ensureBackupMaterial(accessToken, userId)
		}
		const keys = []
		for (const keyId of keyIds) {
			const keyData = keysMap.get(keyId)
			if (!keyData) continue
			const encryptedKeyData = await encryptKeyForBackup(
				keyId,
				keyData,
				accessToken,
				userId,
			)
			keys.push({
				key_id: normalizeE2eKeyId(keyId),
				encrypted_key_data: encryptedKeyData,
			})
		}
		if (keys.length === 0) return 0

		const response = await fetch('/api/v1/e2e-keys/sync', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			credentials: 'include',
			body: JSON.stringify({
				keys,
				device_id: deviceId,
				device_name: deviceName,
			}),
		})

		if (!response.ok) return 0
		const data = await response.json()
		return data.synced_count || 0
	} catch {
		return 0
	}
}

export async function restoreAllKeysFromServer(
	accessToken: string,
	userId?: string,
): Promise<Map<string, Uint8Array>> {
	const restoredKeys = new Map<string, Uint8Array>()

	try {
		if (userId) {
			await ensureBackupMaterial(accessToken, userId)
		}

		const listResponse = await fetch('/api/v1/e2e-keys/list', {
			headers: { Authorization: `Bearer ${accessToken}` },
			credentials: 'include',
		})
		if (!listResponse.ok) return restoredKeys

		const listData = await listResponse.json()
		if (!listData.success) return restoredKeys

		const keyIds = (listData.keys || []).map((k: { key_id: string }) =>
			normalizeE2eKeyId(k.key_id),
		)
		if (!keyIds.length) {
			primeServerKeysCache(restoredKeys)
			return restoredKeys
		}

		const restoreResponse = await fetch('/api/v1/e2e-keys/restore-batch', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			credentials: 'include',
			body: JSON.stringify({ key_ids: keyIds }),
		})

		if (!restoreResponse.ok) return restoredKeys

		const restoreData = await restoreResponse.json()
		if (!restoreData.success || !restoreData.keys) return restoredKeys

		for (const keyItem of restoreData.keys) {
			const serverKeyId = normalizeE2eKeyId(keyItem.key_id)
			const decrypted = await decryptKeyFromBackup(
				keyItem.encrypted_key_data,
				accessToken,
				userId,
				serverKeyId,
				keyItem.encryption_algorithm,
			)
			if (decrypted?.keyData?.length) {
				restoredKeys.set(serverKeyId, decrypted.keyData)
				persistKeyLocally(serverKeyId, decrypted.keyData)
			}
		}

		primeServerKeysCache(restoredKeys)
	} catch {
		// silent — legacy keys may be missing
	}

	return restoredKeys
}

/** @deprecated Use ensureBackupMaterial; kept for compatibility. */
export async function getMasterKey(
	accessToken?: string,
	userId?: string,
): Promise<CryptoKey> {
	if (accessToken && userId) {
		const material = await ensureBackupMaterial(accessToken, userId)
		if (material) {
			return deriveV3MasterKey(
				userId,
				material.salt,
				material.localSecretB64,
			)
		}
	}
	if (accessToken) return deriveLegacyTokenKey(accessToken)
	if (userId) return deriveLegacyUserIdKey(userId)
	const legacy = await getLegacyLocalMasterKey()
	if (legacy) return legacy
	const random = new Uint8Array(32)
	crypto.getRandomValues(random)
	localStorage.setItem(E2E_MASTER_KEY_STORAGE_KEY, bytesToB64(random))
	return (await getLegacyLocalMasterKey())!
}

export function getDeviceInfo(): { deviceId: string; deviceName: string } {
	let deviceId = localStorage.getItem('device_id')
	if (!deviceId) {
		deviceId = `device_${crypto.randomUUID()}`
		localStorage.setItem('device_id', deviceId)
	}

	const ua = navigator.userAgent
	let deviceName = 'Unknown Device'
	if (/Windows/.test(ua)) deviceName = 'Windows'
	else if (/Mac OS X/.test(ua)) deviceName = 'macOS'
	else if (/Android/.test(ua)) deviceName = 'Android'
	else if (/iPhone|iPad|iPod/.test(ua)) deviceName = 'iOS'
	else if (/Linux/.test(ua)) deviceName = 'Linux'

	if (/Chrome/.test(ua) && !/Edg/.test(ua)) deviceName += ' - Chrome'
	else if (/Firefox/.test(ua)) deviceName += ' - Firefox'
	else if (/Safari/.test(ua) && !/Chrome/.test(ua)) deviceName += ' - Safari'
	else if (/Edg/.test(ua)) deviceName += ' - Edge'

	return { deviceId, deviceName }
}
