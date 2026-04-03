'use client'

import { useAuth } from '@/lib/AuthContext'
import { useSocket } from '@/lib/SocketContext'
import { useCallStore } from '@/lib/stores/callStore'
import React, { createContext, ReactNode, useContext, useEffect } from 'react'

interface WebRTCContextType {
	isInitialized: boolean
	isSupported: boolean
}

const WebRTCContext = createContext<WebRTCContextType | null>(null)

export const useWebRTC = () => {
	const context = useContext(WebRTCContext)
	if (!context) {
		throw new Error('useWebRTC must be used within WebRTCProvider')
	}
	return context
}

interface WebRTCProviderProps {
	children: ReactNode
}

export const WebRTCProvider: React.FC<WebRTCProviderProps> = ({ children }) => {
	const { socket, isConnected } = useSocket()
	const { user } = useAuth()
	const { isInitialized, isWebRTCSupported, initializeWebRTC, cleanup } = useCallStore()

	useEffect(() => {
		
		if (socket && user && isWebRTCSupported && !isInitialized && isConnected) {
			console.log('[WebRTCProvider] Initializing WebRTC...')
			initializeWebRTC(socket, {
				id: user.id,
				name: user.username || user.name || 'Unknown',
				avatar: user.avatar_url,
			}).catch(error => {
				console.error('Failed to initialize WebRTC:', error)
			})
		}

		
		return () => {
			if (isInitialized) {
				cleanup()
			}
		}
		
	}, [socket, user, isWebRTCSupported, isInitialized, isConnected])

	
	useEffect(() => {
		const handleBeforeUnload = () => {
			if (isInitialized) {
				cleanup()
			}
		}

		window.addEventListener('beforeunload', handleBeforeUnload)
		return () => {
			window.removeEventListener('beforeunload', handleBeforeUnload)
		}
	}, [isInitialized, cleanup])

	const contextValue: WebRTCContextType = {
		isInitialized,
		isSupported: isWebRTCSupported,
	}

	return (
		<WebRTCContext.Provider value={contextValue}>
			{children}
		</WebRTCContext.Provider>
	)
}
