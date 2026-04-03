



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
		
		primary: process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:5000',
		fallback: process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL || process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:5000',
	},
};


let useFallbackMode = false;
let initializationPromise: Promise<void> | null = null;


export async function checkApiAvailability(url: string, timeoutMs = 3000): Promise<boolean> {
	if (typeof window === 'undefined') {
		
		return true;
	}

	
	
	return true;
}


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


export function isFallbackMode(): boolean {
	return useFallbackMode;
}


export function getBackendUrl(): string {
	return useFallbackMode ? config.backend.fallback : config.backend.primary;
}


export function getWebRtcUrl(): string {
	return useFallbackMode ? config.webrtc.fallback : config.webrtc.primary;
}


export function setFallbackMode(force: boolean): void {
	useFallbackMode = force;
	if (typeof window !== 'undefined') {
		window.localStorage.setItem('url_fallback_mode', force ? 'true' : 'false');
	}
}


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


export function getUrls(): { backend: string; webrtc: string } {
	return {
		backend: getBackendUrl(),
		webrtc: getWebRtcUrl(),
	};
}


export function apiUrl(): string {
	return getBackendUrl();
}


export function webrtcUrl(): string {
	return getWebRtcUrl();
}
