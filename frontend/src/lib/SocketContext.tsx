'use client'

import React, {
	createContext,
	useContext,
	useEffect,
	useRef,
	useState,
} from 'react'
import { io, Socket } from 'socket.io-client'
import { setSocketId } from './features/authSlice'
import { useAppDispatch, useAppSelector } from './hooks'
import { getWebRtcUrl } from './url-fallback'

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
	const socketRef = useRef<Socket | null>(null)

	useEffect(() => {
		socketRef.current = socket
	}, [socket])

	useEffect(() => {
		let cancelled = false

		const forceDisconnect = (s: Socket | null | undefined) => {
			if (!s) return
			try {
				
				const ioClient = (s as unknown as { io?: { reconnection: (v: boolean) => void } })
					.io
				ioClient?.reconnection(false)
				s.removeAllListeners()
				s.disconnect()
			} catch {
				void 0
			}
		}

		const onBeforeLogout = () => {
<<<<<<< Updated upstream
=======
			try {
				socketRef.current?.emit('logout')
			} catch {
				void 0
			}
>>>>>>> Stashed changes
			forceDisconnect(socketRef.current)
			socketRef.current = null
			setSocket(null)
			setIsConnected(false)
		}
		if (typeof window !== 'undefined') {
			window.addEventListener('vondic-before-logout', onBeforeLogout)
		}

		const connectSocket = async () => {
			if (!user) {
				
				forceDisconnect(socketRef.current)
				socketRef.current = null
				setSocket(null)
				setIsConnected(false)
				return
			}

			try {
				const res = await fetch('/api/auth/socket-token')
				if (!res.ok || cancelled) return
				const { token } = await res.json()

				if (!token) {
					return
				}

				if (cancelled) return

				
				forceDisconnect(socketRef.current)
				socketRef.current = null

				
				const socketUrlRaw = getWebRtcUrl()
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

				const socketInstance = io(socketUrl, {
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

				if (cancelled) {
					forceDisconnect(socketInstance)
					return
				}

				socketRef.current = socketInstance

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

				socketInstance.on('user_status_changed', (data: { user_id: string; status: string }) => {
					console.log(
						`[presence] user_status_changed: user ${data.user_id} → ${data.status}`,
					)
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
			cancelled = true
			if (typeof window !== 'undefined') {
				window.removeEventListener('vondic-before-logout', onBeforeLogout)
			}
			const s = socketRef.current
			
			try {
				
				const ioClient = (
					s as unknown as {
						io?: { reconnection: (v: boolean) => void }
					}
				)?.io
				ioClient?.reconnection(false)
				s?.removeAllListeners()
				s?.disconnect()
			} catch {
				void 0
			}
			socketRef.current = null
		}
	}, [user?.id, dispatch]) // Re-run if user ID changes

	return (
		<SocketContext.Provider value={{ socket, isConnected }}>
			{children}
		</SocketContext.Provider>
	)
}
