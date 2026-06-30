/**
 * EncProxy — client-side encryption relay.
 *
 * Usage:
 *   import { getEncProxyClient, getEncProxyUrl, setEncProxyUrl } from '@/lib/encproxy'
 *
 *   // Configure
 *   setEncProxyUrl('wss://encproxy.example.com')
 *
 *   // Connect
 *   const client = getEncProxyClient()
 *   client.connect({ serverUrl: getEncProxyUrl(), accessToken, userId })
 *
 *   // Send encrypted message
 *   client.sendEncrypted(targetUserId, encryptedContent)
 */

export { EncProxyClient, getEncProxyClient } from './client'
export type {
	EncProxyConfig,
	EncProxyMessage,
	EncProxyKeyExchangeData,
	EncProxyStatus,
	EncProxyEvents,
} from './types'
export {
	encProxyRequestKeyExchange,
	encProxyApplyKeyExchange,
} from './keyManager'

const STORAGE_KEY = 'encproxy_url'

export function getEncProxyUrl(): string | null {
	if (typeof window === 'undefined') return null
	return localStorage.getItem(STORAGE_KEY)
}

export function setEncProxyUrl(url: string | null) {
	if (typeof window === 'undefined') return
	if (url) {
		localStorage.setItem(STORAGE_KEY, url)
	} else {
		localStorage.removeItem(STORAGE_KEY)
	}
}

export function isEncProxyEnabled(): boolean {
	return !!getEncProxyUrl()
}
