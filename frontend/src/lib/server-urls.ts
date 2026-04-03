



export function getBackendUrl(): string {
	
	
	if (process.env.NEXT_PUBLIC_BACKEND_URL) {
		return process.env.NEXT_PUBLIC_BACKEND_URL;
	}
	
	if (process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL) {
		return process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL;
	}
	return 'http://localhost:5050';
}

export function getWebrtcUrl(): string {
	
	if (process.env.NEXT_PUBLIC_WEBRTC_URL) {
		return process.env.NEXT_PUBLIC_WEBRTC_URL;
	}
	
	if (process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL) {
		return process.env.NEXT_PUBLIC_INTERNAL_WEBRTC_URL;
	}
	return 'http://localhost:5000';
}
