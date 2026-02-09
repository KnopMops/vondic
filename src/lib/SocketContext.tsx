'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useAppDispatch, useAppSelector } from './hooks'
import { setSocketId } from './features/authSlice'

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
				// Fetch token
				const res = await fetch('/api/auth/socket-token')
				if (!res.ok) return
				const { token } = await res.json()

				if (!token) {
				// Try once more with a slight delay or just fail
				// But maybe the token is in cookies and we just need to wait?
				// For now, return and let the user re-login or refresh if needed.
				// But wait! If we are here, we have a user in Redux. 
				// The user might have just logged in and token is in cookie.
				return
			}

				// Initialize socket
                // User specified http://localhost:5000 in example. 
                // We should probably use env var or default to that.
                const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'
                
				socketInstance = io(socketUrl, {
					auth: { token },
					// transports: ['websocket'], // Optional, often good to prefer websocket
				})

				socketInstance.on('connect', () => {
					console.log('Socket connected')
					setIsConnected(true)
				})

				socketInstance.on('disconnect', () => {
					console.log('Socket disconnected')
					setIsConnected(false)
				})

				socketInstance.on('connection_success', (data: any) => {
					console.log('Connection success:', data)
					if (data.socket_id) {
						dispatch(setSocketId(data.socket_id))
					}
				})

                // Listen for other events if needed or expose socket for components to listen
                
				setSocket(socketInstance)
			} catch (error) {
				console.error('Failed to connect socket:', error)
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
