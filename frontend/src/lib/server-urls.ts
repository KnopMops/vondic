/**
 * Server-side URLs for API routes with NAT fallback support.
 * Uses NEXT_PUBLIC_* variables which should contain domain URLs.
 *
 * In Dokploy, set these environment variables:
 * - NEXT_PUBLIC_BACKEND_URL=https://api.vondic.knopusmedia.ru
 * - NEXT_PUBLIC_INTERNAL_BACKEND_URL=https://in.api.vondic.knopusmedia.ru
 * - NEXT_PUBLIC_WEBRTC_URL=https://webrtc.vondic.knopusmedia.ru
 * - NEXT_PUBLIC_INTERNAL_WEBRTC_URL=https://in.webrtc.vondic.knopusmedia.ru
 */

export function getBackendUrl(): string {
	// Use primary URL (api.vondic.knopusmedia.ru) - it's accessible from Docker network
	// Internal URL (in.api.vondic.knopusmedia.ru) has SSL certificate issues
	if (process.env.NEXT_PUBLIC_BACKEND_URL) {
		return process.env.NEXT_PUBLIC_BACKEND_URL;
	}
	// Fallback to internal URL
	if (process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL) {
		return process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL;
	}
	return 'http://localhost:5050';
}

export function getWebrtcUrl(): string {
	// Use primary URL first
	if (process.env.NEXT_PUBLIC_WEBRTC_URL) {
		return process.env.NEXT_PUBLIC_WEBRTC_URL;
	}
	// Fallback to internal URL
	if (process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL) {
		return process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL;
	}
	return 'http://localhost:5000';
}
