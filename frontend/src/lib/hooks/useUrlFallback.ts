'use client'

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
		
		restoreFallbackMode()

		
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

export function useCurrentUrls(): { backendUrl: string; webrtcUrl: string } {
	return {
		backendUrl: getBackendUrl(),
		webrtcUrl: getWebRtcUrl(),
	}
}
