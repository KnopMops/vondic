/**
 * EncProxy Client — connects to the EncProxy relay server.
 *
 * The client handles:
 * 1. WebSocket connection to the relay server
 * 2. Authentication with access token
 * 3. Sending/receiving encrypted messages (opaque blobs)
 * 4. E2E key exchange through the proxy
 * 5. Automatic reconnection
 *
 * The server NEVER sees plaintext — all encryption is client-side.
 */

import { io, Socket } from 'socket.io-client'
import type {
	EncProxyConfig,
	EncProxyEvents,
	EncProxyMessage,
	EncProxyKeyExchangeData,
	EncProxyStatus,
} from './types'
import {
	encProxyRequestKeyExchange,
	encProxyApplyKeyExchange,
} from './keyManager'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000]
const PING_INTERVAL = 25000

export class EncProxyClient {
	private socket: Socket | null = null
	private config: EncProxyConfig | null = null
	private status: EncProxyStatus = 'disconnected'
	private listeners: Partial<EncProxyEvents> = {}
	private reconnectAttempt = 0
	private reconnectTimer: ReturnType<typeof setTimeout> | null = null
	private pingTimer: ReturnType<typeof setInterval> | null = null
	private _userId: string = ''

	get userId(): string {
		return this._userId
	}

	get isConnected(): boolean {
		return this.status === 'connected'
	}

	get currentStatus(): EncProxyStatus {
		return this.status
	}

	on<K extends keyof EncProxyEvents>(event: K, handler: EncProxyEvents[K]): () => void {
		const prev = this.listeners[event]
		this.listeners[event] = handler as any
		return () => {
			if (this.listeners[event] === handler) {
				this.listeners[event] = prev as any
			}
		}
	}

	private setStatus(s: EncProxyStatus) {
		if (this.status === s) return
		this.status = s
		this.listeners.statusChange?.(s)
	}

	emit(event: string, data: unknown) {
		this.socket?.emit(event, data)
	}

	async connect(config: EncProxyConfig) {
		if (this.socket?.connected && this.config?.serverUrl === config.serverUrl) {
			return
		}
		this.disconnect()
		this.config = config
		this._userId = config.userId
		this.setStatus('connecting')

		const socket = io(config.serverUrl, {
			transports: ['websocket', 'polling'],
			auth: { access_token: config.accessToken },
			reconnection: false,
			timeout: 10000,
		})

		this.socket = socket

		socket.on('connect', () => {
			this.reconnectAttempt = 0
			this.setStatus('authenticating')
			socket.emit('encproxy_auth', { access_token: config.accessToken })
		})

		socket.on('encproxy_auth_ok', (data: { user_id: string; socket_id: string }) => {
			this._userId = data.user_id || config.userId
			this.setStatus('connected')
			this.startPing()
			this.listeners.connected?.()
		})

		socket.on('encproxy_auth_error', (data: { error: string }) => {
			console.error('[EncProxy] Auth error:', data.error)
			this.setStatus('error')
			this.listeners.error?.(data.error)
		})

		socket.on('encproxy_receive', (msg: EncProxyMessage) => {
			this.listeners.message?.(msg)
		})

		socket.on('encproxy_key_exchange', (data: EncProxyKeyExchangeData) => {
			this.handleKeyExchange(data)
		})

		socket.on('encproxy_group_key_exchange', (data: any) => {
			this.listeners.groupKeyExchange?.(data)
		})

		socket.on('encproxy_error', (data: { error: string }) => {
			this.listeners.error?.(data.error)
		})

		socket.on('encproxy_pong', () => {
			// keepalive acknowledged
		})

		socket.on('disconnect', (reason: string) => {
			this.stopPing()
			this.setStatus('disconnected')
			this.listeners.disconnected?.(reason)
			this.scheduleReconnect()
		})

		socket.on('connect_error', (err: Error) => {
			console.error('[EncProxy] Connection error:', err.message)
			this.setStatus('error')
			this.listeners.error?.(err.message)
		})

		socket.connect()
	}

	disconnect() {
		this.stopPing()
		if (this.reconnectTimer) {
			clearTimeout(this.reconnectTimer)
			this.reconnectTimer = null
		}
		this.reconnectAttempt = 0
		if (this.socket) {
			this.socket.removeAllListeners()
			this.socket.disconnect()
			this.socket = null
		}
		this.setStatus('disconnected')
	}

	sendEncrypted(
		targetUserId: string,
		encryptedContent: string,
		encryptedAttachments?: string,
		messageType?: string,
		extra?: unknown,
	) {
		if (!this.socket?.connected) return false
		this.emit('encproxy_send', {
			target_user_id: targetUserId,
			encrypted_content: encryptedContent,
			encrypted_attachments: encryptedAttachments || '',
			message_type: messageType || 'text',
			timestamp: Date.now(),
			...extra,
		})
		return true
	}

	sendBroadcast(
		targetUserIds: string[],
		encryptedContent: string,
		encryptedAttachments?: string,
		messageType?: string,
	) {
		if (!this.socket?.connected) return false
		this.emit('encproxy_broadcast', {
			target_user_ids: targetUserIds,
			encrypted_content: encryptedContent,
			encrypted_attachments: encryptedAttachments || '',
			message_type: messageType || 'text',
			timestamp: Date.now(),
		})
		return true
	}

	requestKeyExchange(peerId: string) {
		if (!this.socket?.connected || !this._userId) return
		encProxyRequestKeyExchange(
			this.emit.bind(this),
			this._userId,
			peerId,
		)
	}

	private async handleKeyExchange(data: EncProxyKeyExchangeData) {
		if (!this.config?.accessToken) return
		const applied = await encProxyApplyKeyExchange(
			data,
			this._userId,
			this.config.accessToken,
			this.emit.bind(this),
		)
		if (applied) {
			this.listeners.keyExchange?.(data)
		}
	}

	private startPing() {
		this.stopPing()
		this.pingTimer = setInterval(() => {
			if (this.socket?.connected) {
				this.emit('encproxy_ping', { ts: Date.now() })
			}
		}, PING_INTERVAL)
	}

	private stopPing() {
		if (this.pingTimer) {
			clearInterval(this.pingTimer)
			this.pingTimer = null
		}
	}

	private scheduleReconnect() {
		if (!this.config) return
		const delay = RECONNECT_DELAYS[
			Math.min(this.reconnectAttempt, RECONNECT_DELAYS.length - 1)
		]
		this.reconnectAttempt++
		this.reconnectTimer = setTimeout(() => {
			if (this.config) {
				this.connect(this.config)
			}
		}, delay)
	}
}

let _instance: EncProxyClient | null = null

export function getEncProxyClient(): EncProxyClient {
	if (!_instance) {
		_instance = new EncProxyClient()
	}
	return _instance
}
