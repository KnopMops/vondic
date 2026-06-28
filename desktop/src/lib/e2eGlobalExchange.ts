/**
 * Фоновый обмен E2E-ключами (как в Telegram): без открытия чата.
 */

import {
	backupKeyToServer,
	ensureBackupMaterial,
	getDeviceInfo,
	lookupCachedServerKey,
	normalizeE2eKeyId,
	persistKeyLocally,
	restoreKeyFromServer,
} from '@/lib/e2eKeySync'
import type { Socket } from 'socket.io-client'

const pairs = new Map<string, CryptoKeyPair>()

export const e2ePairs = pairs

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

async function deriveKey(shared: ArrayBuffer, keyId: string) {
	const encoder = new TextEncoder()
	const salt = encoder.encode(normalizeE2eKeyId(keyId))
	const combined = new Uint8Array(shared.byteLength + salt.length)
	combined.set(new Uint8Array(shared), 0)
	combined.set(salt, shared.byteLength)
	const hash = await crypto.subtle.digest('SHA-256', combined)
	return new Uint8Array(hash)
}

function peerInKeyId(keyId: string, peerId: string, selfId: string) {
	const n = normalizeE2eKeyId(keyId)
	const parts = n.split(':')
	return parts.includes(peerId) && parts.includes(selfId)
}

export async function applyE2eKeyExchange(
	socket: Socket | null,
	data: {
		key_id?: string
		public_key?: string
		from_user_id?: string
		type?: string
	},
	currentUserId: string,
	accessToken: string,
	options?: { activeDmPeerId?: string | null },
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

	const activeDm = options?.activeDmPeerId
		? String(options.activeDmPeerId)
		: null
	if (activeDm && activeDm === peerId) return false

	const keyId = normalizeE2eKeyId(data.key_id)
	if (!peerInKeyId(keyId, peerId, selfId)) return false

	const cached = lookupCachedServerKey(keyId)
	if (cached?.length) return false

	const restored = await restoreKeyFromServer(
		accessToken,
		keyId,
		selfId,
	)
	if (restored?.length) {
		persistKeyLocally(keyId, restored)
		return false
	}

	let pair = pairs.get(keyId)
	if (!pair) {
		pair = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			['deriveBits'],
		)
		pairs.set(keyId, pair)
	}

	if (data.type !== 'answer' && socket) {
		const myPublic = await crypto.subtle.exportKey('raw', pair.publicKey)
		socket.emit('e2e_key_exchange', {
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

export async function requestE2eKeyExchange(
	socket: Socket | null,
	currentUserId: string,
	peerId: string,
): Promise<void> {
	if (!socket || !currentUserId || !peerId) return
	if (typeof crypto === 'undefined' || !crypto.subtle) return

	const keyId = normalizeE2eKeyId(
		[currentUserId, peerId].sort().join(':'),
	)
	let pair = pairs.get(keyId)
	if (!pair) {
		pair = await crypto.subtle.generateKey(
			{ name: 'ECDH', namedCurve: 'P-256' },
			true,
			['deriveBits'],
		)
		pairs.set(keyId, pair)
	}
	const publicKeyRaw = await crypto.subtle.exportKey('raw', pair.publicKey)
	socket.emit('e2e_key_exchange', {
		target_user_id: peerId,
		public_key: base64FromBytes(new Uint8Array(publicKeyRaw)),
		key_id: keyId,
		type: 'offer',
	})
}
