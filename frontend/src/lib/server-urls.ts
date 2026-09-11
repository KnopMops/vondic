import { getActiveBackendUrl, getActiveSignalingUrl } from './callRouting';

export function getBackendUrl(): string {
	if (typeof window !== 'undefined') {
		const custom = getActiveBackendUrl();
		if (custom) return custom;
		if (process.env.NEXT_PUBLIC_BACKEND_URL) {
			return process.env.NEXT_PUBLIC_BACKEND_URL;
		}
		if (process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL) {
			return process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL;
		}
		return 'http://localhost:5050';
	}

	// Server-side code (Next route handlers)
	if (process.env.INTERNAL_BACKEND_URL) {
		return process.env.INTERNAL_BACKEND_URL;
	}
	if (process.env.BACKEND_URL) {
		return process.env.BACKEND_URL;
	}
	return 'http://backend:5050';
}

export function getWebrtcUrl(): string {
	if (typeof window !== 'undefined') {
		const custom = getActiveSignalingUrl();
		if (custom) return custom;
		if (process.env.NEXT_PUBLIC_WEBRTC_URL) {
			return process.env.NEXT_PUBLIC_WEBRTC_URL;
		}
		if (process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL) {
			return process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL;
		}
		return 'http://localhost:5000';
	}

	if (process.env.INTERNAL_WEBRTC_URL) {
		return process.env.INTERNAL_WEBRTC_URL;
	}
	if (process.env.WEBRTC_URL) {
		return process.env.WEBRTC_URL;
	}
	return 'http://webrtc:5000';
}
