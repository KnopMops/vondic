'use client'

/**
 * React hook for URL fallback in NAT environments.
 * Automatically switches to internal URLs when external URLs are unavailable.
 */

import { useEffect, useState } from 'react'
import {
	initializeUrlFallback,
	getBackendUrl,
	getWebRtcUrl,
	isFallbackMode,
	restoreFallbackMode,
} from './url-fallback'

interface UseUrlFallbackReturn {
	backendUrl: string
	webrtcUrl: string
	isFallbackMode: boolean
	isInitialized: boolean
}

export function useUrlFallback(): UseUrlFallbackReturn {
	const [isInitialized, setIsInitialized] = useState(false)
	const [fallbackMode, setFallbackModeState] = useState(false)
	const [urls, setUrls] = useState({
		backend: getBackendUrl(),
		webrtc: getWebRtcUrl(),
	})

	useEffect(() => {
		// Restore saved fallback mode from localStorage
		restoreFallbackMode()

		// Initialize and check availability
		initializeUrlFallback()
			.then(() => {
				setFallbackModeState(isFallbackMode())
				setUrls({
					backend: getBackendUrl(),
					webrtc: getWebRtcUrl(),
				})
				setIsInitialized(true)
			})
			.catch(() => {
				// On error, use fallback mode
				setFallbackModeState(true)
				setUrls({
					backend: getBackendUrl(),
					webrtc: getWebRtcUrl(),
				})
				setIsInitialized(true)
			})
	}, [])

	return {
		backendUrl: urls.backend,
		webrtcUrl: urls.webrtc,
		isFallbackMode: fallbackMode,
		isInitialized,
	}
}

/**
 * Simple hook to get URLs without initialization (uses current state)
 */
export function useCurrentUrls(): { backendUrl: string; webrtcUrl: string } {
	return {
		backendUrl: getBackendUrl(),
		webrtcUrl: getWebRtcUrl(),
	}
}
