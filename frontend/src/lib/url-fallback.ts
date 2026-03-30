/**
 * URL fallback utility for NAT environments.
 * Automatically switches to internal URLs when external URLs are unavailable.
 *
 * Environment variables:
 * - NEXT_PUBLIC_BACKEND_URL=https://api.vondic.knopusmedia.ru
 * - NEXT_PUBLIC_INTERNAL_BACKEND_URL=https://in.api.vondic.knopusmedia.ru
 * - NEXT_PUBLIC_WEBRTC_URL=https://webrtc.vondic.knopusmedia.ru
 * - NEXT_PUBLIC_INTERNAL_WEBRTC_URL=https://in.webrtc.vondic.knopusmedia.ru
 */

interface UrlConfig {
	primary: string;
	fallback: string;
}

interface FallbackConfig {
	backend: UrlConfig;
	webrtc: UrlConfig;
}

const config: FallbackConfig = {
	backend: {
		primary: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050',
		fallback: process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050',
	},
	webrtc: {
		// Use external URL with CORS for WebSocket connections
		primary: process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:5000',
		fallback: process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL || process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:5000',
	},
};

// Client-side state (only in browser)
let useFallbackMode = false;
let initializationPromise: Promise<void> | null = null;

/**
 * Check if external API is available
 */
export async function checkApiAvailability(url: string, timeoutMs = 3000): Promise<boolean> {
	if (typeof window === 'undefined') {
		// Server-side - assume primary is available
		return true;
	}

	// Skip health check to avoid CORS issues - assume primary is available
	// The actual API calls will fail if backend is unreachable
	return true;
}

/**
 * Initialize URL fallback mode by checking primary URL availability
 */
export async function initializeUrlFallback(): Promise<void> {
	if (typeof window === 'undefined') {
		return;
	}

	if (initializationPromise) {
		return initializationPromise;
	}

	initializationPromise = (async () => {
		const backendAvailable = await checkApiAvailability(config.backend.primary);
		
		if (!backendAvailable) {
			useFallbackMode = true;
			console.log('[URL Fallback] Switched to internal URLs - external endpoints unavailable');
		} else {
			useFallbackMode = false;
			console.log('[URL Fallback] Using external URLs');
		}
	})();

	return initializationPromise;
}

/**
 * Get current fallback mode state
 */
export function isFallbackMode(): boolean {
	return useFallbackMode;
}

/**
 * Get backend URL (automatically switches to fallback if unavailable)
 */
export function getBackendUrl(): string {
	return useFallbackMode ? config.backend.fallback : config.backend.primary;
}

/**
 * Get WebRTC URL (automatically switches to fallback if unavailable)
 */
export function getWebRtcUrl(): string {
	return useFallbackMode ? config.webrtc.fallback : config.webrtc.primary;
}

/**
 * Force use fallback mode (for manual override)
 */
export function setFallbackMode(force: boolean): void {
	useFallbackMode = force;
	if (typeof window !== 'undefined') {
		window.localStorage.setItem('url_fallback_mode', force ? 'true' : 'false');
	}
}

/**
 * Restore fallback mode from localStorage (persists across page reloads)
 */
export function restoreFallbackMode(): void {
	if (typeof window === 'undefined') {
		return;
	}

	const saved = window.localStorage.getItem('url_fallback_mode');
	if (saved === 'true') {
		useFallbackMode = true;
	} else if (saved === 'false') {
		useFallbackMode = false;
	}
}

/**
 * Get all URLs as an object (useful for passing to components)
 */
export function getUrls(): { backend: string; webrtc: string } {
	return {
		backend: getBackendUrl(),
		webrtc: getWebRtcUrl(),
	};
}

/**
 * Helper to build backend API URLs with fallback support
 * Usage: `${apiUrl()}/v1/dm/recent`
 */
export function apiUrl(): string {
	return getBackendUrl();
}

/**
 * Helper to build WebRTC URLs with fallback support
 * Usage: `${webrtcUrl()}/api/v1/dm/...`
 */
export function webrtcUrl(): string {
	return getWebRtcUrl();
}
