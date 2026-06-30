/**
 * EncProxy Client Types
 */

export interface EncProxyConfig {
	serverUrl: string
	accessToken: string
	userId: string
}

export interface EncProxyMessage {
	from_user_id: string
	encrypted_content: string
	encrypted_attachments?: string
	message_type?: string
	timestamp?: number
	nonce?: string
	reply_to?: string | null
	extra?: unknown
}

export interface EncProxySentResponse {
	status: 'delivered' | 'queued'
	target_user_id?: string
	delivered_count?: number
}

export interface EncProxyKeyExchangeData {
	from_user_id: string
	public_key: string
	key_id: string
	type: 'offer' | 'answer'
}

export type EncProxyStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error'

export interface EncProxyEvents {
	connected: () => void
	disconnected: (reason?: string) => void
	statusChange: (status: EncProxyStatus) => void
	message: (msg: EncProxyMessage) => void
	keyExchange: (data: EncProxyKeyExchangeData) => void
	groupKeyExchange: (data: {
		from_user_id: string
		encrypted_group_key: string
		key_id: string
		group_id: string
	}) => void
	error: (err: string) => void
}
