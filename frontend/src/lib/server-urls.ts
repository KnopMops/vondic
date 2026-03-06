/**
 * Server-side URLs for API routes.
 * Uses NEXT_PUBLIC_* variables which should contain domain URLs.
 *
 * In Dokploy, set these environment variables:
 * - NEXT_PUBLIC_BACKEND_URL=https://api.vondic.knopusmedia.ru
 * - NEXT_PUBLIC_WEBRTC_URL=https://webrtc.vondic.knopusmedia.ru
 */

export function getBackendUrl(): string {
	// Use NEXT_PUBLIC_BACKEND_URL (domain) for all requests
	if (process.env.NEXT_PUBLIC_BACKEND_URL) {
		return process.env.NEXT_PUBLIC_BACKEND_URL;
	}
	return 'http://localhost:5050';
}

export function getWebrtcUrl(): string {
	// Use NEXT_PUBLIC_WEBRTC_URL (domain) for all requests
	if (process.env.NEXT_PUBLIC_WEBRTC_URL) {
		return process.env.NEXT_PUBLIC_WEBRTC_URL;
	}
	return 'http://localhost:5000';
}
