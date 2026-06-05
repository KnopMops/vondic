/** Headers for server-side Next.js → api/webrtc (nginx allows with matching secret). */
export function vondicProxySecretHeader(): Record<string, string> {
	const secret = process.env.VONDIC_PROXY_SECRET?.trim()
	if (!secret) return {}
	return { 'X-Vondic-Proxy-Secret': secret }
}

export function withVondicProxyHeaders(init?: HeadersInit): HeadersInit {
	const headers = new Headers(init)
	const extra = vondicProxySecretHeader()
	for (const [k, v] of Object.entries(extra)) {
		headers.set(k, v)
	}
	return headers
}
