/**
 * EncProxy Key Manager — client-side E2E key generation, storage, and exchange.
 *
 * Keys are generated and stored entirely on the client. The EncProxy server
 * only relays opaque encrypted blobs and public keys during key exchange.
 */

import {
	normalizeE2eKeyId,
	persistKeyLocally,
	lookupCachedServerKey,
	backupKeyToServer,
	ensureBackupMaterial,
	getDeviceInfo,
	restoreKeyFromServer,
} from '@/lib/e2eKeySync'

const bytesFromBase64 = (b64: string) => {
	const binary = atob(b64)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i)
	}
	return bytes
}

const base64FromBytes = (bytes: Uint8Array) => {
	let binary = ''
	for (let i = 0; i < bytes.length; i++) {
		binary += String.fromCharCode(bytes[i])
	}
	return btoa(binary)
}

async function deriveKey(shared: ArrayBuffer, keyId: string): Promise<Uint8Array> {
	const encoder = new TextEncoder()
	const salt = encoder.encode(normalizeE2eKeyId(keyId))
	const combined = new Uint8Array(shared.byteLength + salt.length)
	combined.set(new Uint8Array(shared), 0)
	combined.set(salt, shared.byteLength)
	const hash = await crypto.subtle.digest('SHA-256', combined)
	return new Uint8Array(hash)
}

function peerInKeyId(keyId: string, peerId: string, selfId: string): boolean {
	const n = normalizeE2eKeyId(keyId)
	const parts = n.split(':')
	return parts.includes(peerId) && parts.includes(selfId)
}

const pairs = new Map<string, CryptoKeyPair>()

export function getEncProxyPairs() {
	return pairs
}

/**
 * Generate or retrieve an ECDH key pair for a given key_id.
 */
async function getOrCreateKeyPair(keyId: string): Promise<CryptoKeyPair> {
	let pair = pairs.get(keyId)
	if (!pair) {
		pair = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			['deriveBits'],
		)
		pairs.set(keyId, pair)
	}
	return pair
}

/**
 * Initiate E2E key exchange through EncProxy.
 */
export async function encProxyRequestKeyExchange(
	emit: (event: string, data: unknown) => void,
	currentUserId: string,
	peerId: string,
): Promise<void> {
	if (!currentUserId || !peerId) return
	if (typeof crypto === 'undefined' || !crypto.subtle) return

	const keyId = normalizeE2eKeyId(
		[currentUserId, peerId].sort().join(':'),
	)
	const pair = await getOrCreateKeyPair(keyId)
	const publicKeyRaw = await crypto.subtle.exportKey('raw', pair.publicKey)

	emit('encproxy_key_exchange', {
		target_user_id: peerId,
		public_key: base64FromBytes(new Uint8Array(publicKeyRaw)),
		key_id: keyId,
		type: 'offer',
	})
}

/**
 * Handle incoming E2E key exchange through EncProxy.
 * Returns true if a new key was derived and stored.
 */
export async function encProxyApplyKeyExchange(
	data: EncProxyKeyExchangeData,
	currentUserId: string,
	accessToken: string,
	emit: (event: string, data: unknown) => void,
): Promise<boolean> {
	if (
		typeof crypto === 'undefined' ||
		!crypto.subtle ||
		!data?.key_id ||
		!data?.public_key ||
		!data?.from_user_id
	) {
		return false
	}

	const peerId = String(data.from_user_id)
	const selfId = String(currentUserId)
	if (peerId === selfId) return false

	const keyId = normalizeE2eKeyId(data.key_id)
	if (!peerInKeyId(keyId, peerId, selfId)) return false

	const cached = lookupCachedServerKey(keyId)
	if (cached?.length) return false

	const restored = await restoreKeyFromServer(accessToken, keyId, selfId)
	if (restored?.length) {
		persistKeyLocally(keyId, restored)
		return false
	}

	const pair = await getOrCreateKeyPair(keyId)

	if (data.type !== 'answer') {
		const myPublic = await crypto.subtle.exportKey('raw', pair.publicKey)
		emit('encproxy_key_exchange', {
			target_user_id: peerId,
			public_key: base64FromBytes(new Uint8Array(myPublic)),
			key_id: keyId,
			type: 'answer',
		})
	}

	const peerRaw = bytesFromBase64(data.public_key)
	const peerKey = await crypto.subtle.importKey(
		'raw',
		peerRaw,
		{ name: 'ECDH', namedCurve: 'P-256' },
		true,
		[],
	)
	const shared = await crypto.subtle.deriveBits(
		{ name: 'ECDH', public: peerKey },
		pair.privateKey,
		256,
	)
	const derived = await deriveKey(shared, keyId)
	persistKeyLocally(keyId, derived)

	try {
		await ensureBackupMaterial(accessToken, selfId)
		const { deviceId, deviceName } = getDeviceInfo()
		await backupKeyToServer(
			accessToken,
			keyId,
			derived,
			deviceId,
			deviceName,
			selfId,
			{ allowOverwrite: true },
		)
	} catch {
		// ignore backup errors
	}

	if (typeof window !== 'undefined') {
		window.dispatchEvent(new CustomEvent('e2e-keys-updated'))
	}
	return true
}

type EncProxyKeyExchangeData = {
	from_user_id: string
	public_key: string
	key_id: string
	type: 'offer' | 'answer'
}
