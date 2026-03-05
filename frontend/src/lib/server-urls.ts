/**
 * Server-side URLs for internal Docker network communication.
 * Use these in API routes (server-side only).
 * 
 * In Dokploy, set these environment variables:
 * - INTERNAL_BACKEND_URL=http://backend:5050
 * - INTERNAL_WEBRTC_URL=http://webrtc:5000
 */

export function getBackendUrl(): string {
	// Priority: INTERNAL_* (Docker network) > NEXT_PUBLIC_* (dev fallback) > localhost
	if (process.env.INTERNAL_BACKEND_URL) {
		return process.env.INTERNAL_BACKEND_URL;
	}
	if (process.env.NEXT_PUBLIC_BACKEND_URL) {
		return process.env.NEXT_PUBLIC_BACKEND_URL;
	}
	return 'http://localhost:5050';
}

export function getWebrtcUrl(): string {
	// Priority: INTERNAL_* (Docker network) > NEXT_PUBLIC_* (dev fallback) > localhost
	if (process.env.INTERNAL_WEBRTC_URL) {
		return process.env.INTERNAL_WEBRTC_URL;
	}
	if (process.env.NEXT_PUBLIC_WEBRTC_URL) {
		return process.env.NEXT_PUBLIC_WEBRTC_URL;
	}
	return 'http://localhost:5000';
}
