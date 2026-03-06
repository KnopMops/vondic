'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { setSocketId } from './features/authSlice'
import { useAppDispatch, useAppSelector } from './hooks'

interface SocketContextType {
	socket: Socket | null
	isConnected: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function useSocket() {
	const context = useContext(SocketContext)
	if (context === undefined) {
		throw new Error('useSocket must be used within a SocketProvider')
	}
	return context
}

export function SocketProvider({ children }: { children: React.ReactNode }) {
	const [socket, setSocket] = useState<Socket | null>(null)
	const [isConnected, setIsConnected] = useState(false)
	const { user } = useAppSelector(state => state.auth)
	const dispatch = useAppDispatch()

	useEffect(() => {
		let socketInstance: Socket | null = null

		const connectSocket = async () => {
			if (!user) {
				if (socket) {
					socket.disconnect()
					setSocket(null)
					setIsConnected(false)
				}
				return
			}

			// Avoid reconnecting if already connected with same user (conceptually)
			// But socket depends on token, which might refresh.
			// For simplicity, we reconnect if user changes or mounts.

			try {
				const res = await fetch('/api/auth/socket-token')
				if (!res.ok) return
				const { token } = await res.json()

				if (!token) {
					return
				}

				const socketUrlRaw =
					process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:5000'
				const socketPath = process.env.NEXT_PUBLIC_SOCKET_PATH || '/socket.io'
				const isSecure =
					window.location.protocol === 'https:' ||
					socketUrlRaw.startsWith('https://')
				const httpProtocol = isSecure ? 'https' : 'http'

				let socketUrl = (socketUrlRaw || '').trim()
				if (
					!socketUrl ||
					socketUrl === 'https://' ||
					socketUrl === 'http://' ||
					socketUrl.toLowerCase() === 'https' ||
					socketUrl.toLowerCase() === 'http'
				) {
					socketUrl = isSecure
						? 'https://localhost:5000'
						: 'http://localhost:5000'
				}
				if (socketUrl.startsWith('//')) {
					socketUrl = `${httpProtocol}:${socketUrl}`
				}
				if (!/^https?:\/\//i.test(socketUrl)) {
					socketUrl = `${httpProtocol}://${socketUrl}`
				}
				if (isSecure && socketUrl.startsWith('http://')) {
					socketUrl = socketUrl.replace(/^http:\/\//i, 'https://')
				}
				// Clean malformed 'https://https/...'
				socketUrl = socketUrl.replace(/^https:\/\/https(\/|$)/i, 'https://')

				console.log(
					`Connecting to WebSocket server: ${socketUrl} (secure: ${isSecure})`,
				)

				socketInstance = io(socketUrl, {
					auth: { token },
					transports: ['websocket', 'polling'],
					path: socketPath,
					secure: isSecure,
					timeout: 10000,
					forceNew: true,
					reconnection: true,
					reconnectionAttempts: 5,
					reconnectionDelay: 1000,
				})

				socketInstance.on('connect', () => {
					console.log('Socket connected')
					setIsConnected(true)
					socketInstance?.emit('authenticate', { access_token: token })
				})

				socketInstance.on('disconnect', reason => {
					console.log('Socket disconnected:', reason)
					setIsConnected(false)
				})

				socketInstance.on('connect_error', error => {
					console.error('Socket connection error:', error)
					setIsConnected(false)
				})

				socketInstance.on('reconnect', attemptNumber => {
					console.log('Socket reconnected after', attemptNumber, 'attempts')
					setIsConnected(true)
				})

				socketInstance.on('reconnect_error', error => {
					console.error('Socket reconnection error:', error)
				})

				socketInstance.on('connection_success', (data: any) => {
					console.log('Connection success:', data)
					if (data.socket_id) {
						dispatch(setSocketId(data.socket_id))
					}
				})

				setSocket(socketInstance)
			} catch (error) {
				console.error('Failed to connect socket:', error)
				// Не падаем, просто устанавливаем socket в null
				setSocket(null)
				setIsConnected(false)
			}
		}

		connectSocket()

		return () => {
			if (socketInstance) {
				socketInstance.disconnect()
			}
		}
	}, [user?.id, dispatch]) // Re-run if user ID changes

	return (
		<SocketContext.Provider value={{ socket, isConnected }}>
			{children}
		</SocketContext.Provider>
	)
}
