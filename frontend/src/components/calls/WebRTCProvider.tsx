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
	const { socket } = useSocket()
	const { user } = useAuth()
	const { isInitialized, isWebRTCSupported, initializeWebRTC, cleanup } = useCallStore()

	useEffect(() => {
		// Инициализация WebRTC при наличии сокета и пользователя
		if (socket && user && isWebRTCSupported && !isInitialized) {
			initializeWebRTC(socket, user.id)
				.catch((error) => {
					console.error('Failed to initialize WebRTC:', error)
				})
		}

		// Очистка при размонтировании
		return () => {
			if (isInitialized) {
				cleanup()
			}
		}
	}, [socket, user, isWebRTCSupported, isInitialized, initializeWebRTC, cleanup])

	// Обработка закрытия вкладки/браузера
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
