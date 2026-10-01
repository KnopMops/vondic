'use client'

/**
 * Zero-Knowledge Cloud Encryption Service for Vondic
 * 
 * Messages are encrypted client-side using AES-GCM-256 before being sent to the server.
 * The server only ever sees the ciphertext ('zk:v1:...').
 * 
 * Unlike pure E2EE (which loses history on new devices), Cloud ZK stores
 * chat keys wrapped with the user's Master Key on the server.
 * When the user logs in on a new device, entering their master passphrase
 * unwraps their chat keys and decrypts full cloud history!
 */

const ZK_PREFIX = 'zk:v1:'
const PBKDF2_ITERATIONS = 100000

// In-memory Master Key cache for the current session
let activeMasterKey: CryptoKey | null = null
const chatKeyCache = new Map<string, CryptoKey>()

function bufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)
	let binary = ''
	for (let i = 0; i < bytes.byteLength; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

function base64ToBuffer(base64: string): Uint8Array {
	const binary = atob(base64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

/**
 * Derive Master Encryption Key from a user passphrase and salt using PBKDF2
 */
export async function deriveMasterKey(passphrase: string, saltBytes: Uint8Array): Promise<CryptoKey> {
	const encoder = new TextEncoder()
	const keyMaterial = await crypto.subtle.importKey(
		'raw',
		encoder.encode(passphrase),
		{ name: 'PBKDF2' },
		false,
		['deriveKey'],
	)

	return await crypto.subtle.deriveKey(
		{
			name: 'PBKDF2',
			salt: saltBytes,
			iterations: PBKDF2_ITERATIONS,
			hash: 'SHA-256',
		},
		keyMaterial,
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt', 'wrapKey', 'unwrapKey'],
	)
}

/**
 * Generate a new random symmetric Chat Key
 */
export async function generateChatKey(): Promise<CryptoKey> {
	return await crypto.subtle.generateKey(
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt'],
	)
}

/**
 * Wrap (encrypt) a Chat Key using the user's Master Key
 */
export async function wrapChatKey(chatKey: CryptoKey, masterKey: CryptoKey): Promise<string> {
	const iv = crypto.getRandomValues(new Uint8Array(12))
	const wrapped = await crypto.subtle.wrapKey('raw', chatKey, masterKey, {
		name: 'AES-GCM',
		iv,
	})

	const combined = new Uint8Array(iv.length + wrapped.byteLength)
	combined.set(iv, 0)
	combined.set(new Uint8Array(wrapped), iv.length)

	return bufferToBase64(combined)
}

/**
 * Unwrap (decrypt) a Chat Key using the user's Master Key
 */
export async function unwrapChatKey(wrappedBase64: string, masterKey: CryptoKey): Promise<CryptoKey> {
	const combined = base64ToBuffer(wrappedBase64)
	const iv = combined.slice(0, 12)
	const wrapped = combined.slice(12)

	return await crypto.subtle.unwrapKey(
		'raw',
		wrapped,
		masterKey,
		{ name: 'AES-GCM', iv },
		{ name: 'AES-GCM', length: 256 },
		true,
		['encrypt', 'decrypt'],
	)
}

/**
 * Encrypt a text message for Cloud Zero-Knowledge storage
 */
export async function encryptCloudMessage(plaintext: string, chatKey: CryptoKey): Promise<string> {
	const encoder = new TextEncoder()
	const data = encoder.encode(plaintext)
	const iv = crypto.getRandomValues(new Uint8Array(12))

	const ciphertext = await crypto.subtle.encrypt(
		{ name: 'AES-GCM', iv },
		chatKey,
		data,
	)

	const combined = new Uint8Array(iv.length + ciphertext.byteLength)
	combined.set(iv, 0)
	combined.set(new Uint8Array(ciphertext), iv.length)

	return ZK_PREFIX + bufferToBase64(combined)
}

/**
 * Decrypt a Zero-Knowledge Cloud message
 */
export async function decryptCloudMessage(ciphertextWithPrefix: string, chatKey: CryptoKey): Promise<string> {
	if (!ciphertextWithPrefix.startsWith(ZK_PREFIX)) {
		return ciphertextWithPrefix
	}

	try {
		const rawBase64 = ciphertextWithPrefix.slice(ZK_PREFIX.length)
		const combined = base64ToBuffer(rawBase64)
		const iv = combined.slice(0, 12)
		const ciphertext = combined.slice(12)

		const decrypted = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv },
			chatKey,
			ciphertext,
		)

		const decoder = new TextDecoder()
		return decoder.decode(decrypted)
	} catch (e) {
		console.error('[ZK-Cloud] Failed to decrypt message:', e)
		return '[Зашифрованное сообщение: ключ недоступен]'
	}
}

/**
 * Check if a message was encrypted with Zero-Knowledge Cloud encryption
 */
export function isZkCloudMessage(text?: string | null): boolean {
	return typeof text === 'string' && text.startsWith(ZK_PREFIX)
}

/**
 * Unlock Cloud Vault with user passphrase
 */
export async function unlockCloudVault(passphrase: string, storedSaltBase64?: string | null): Promise<boolean> {
	try {
		let salt: Uint8Array
		if (storedSaltBase64) {
			salt = base64ToBuffer(storedSaltBase64)
		} else {
			salt = crypto.getRandomValues(new Uint8Array(16))
		}

		activeMasterKey = await deriveMasterKey(passphrase, salt)
		return true
	} catch (e) {
		console.error('[ZK-Cloud] Failed to unlock vault:', e)
		return false
	}
}

export function isCloudVaultUnlocked(): boolean {
	return activeMasterKey !== null
}

export function lockCloudVault(): void {
	activeMasterKey = null
	chatKeyCache.clear()
}
