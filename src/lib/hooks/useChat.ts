import { useCallback, useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'

export interface Message {
	id: string
	sender_id: string
	content: string
	timestamp: string
	isOwn: boolean
	is_read?: boolean
	channel_id?: string
}

export const useChat = (
	socket: Socket | null,
	currentUserId: string | undefined,
	targetUserId: string | undefined,
	channelId?: string | undefined,
) => {
	const [messages, setMessages] = useState<Message[]>([])
	const [offset, setOffset] = useState(0)
	const [hasMore, setHasMore] = useState(true)
	const [isLoading, setIsLoading] = useState(false)
	const [isTyping, setIsTyping] = useState(false)
	const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)

	// 1. Load history when chat opens
	useEffect(() => {
		const fetchHistory = async () => {
			if (!currentUserId || (!targetUserId && !channelId)) return

			setIsLoading(true)
			try {
				let endpoint = '/api/messages/history'
				const body: any = {
					limit: 50,
					offset: 0,
				}
				if (channelId) {
					endpoint = '/api/channels/history'
					body.channel_id = channelId
				} else if (targetUserId) {
					body.target_id = targetUserId
				}

				const response = await fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				})

				if (response.ok) {
					const data = await response.json()
					const history: Message[] = Array.isArray(data)
						? data.map((msg: any) => ({
								id: msg.id || Math.random().toString(),
								sender_id: msg.sender_id,
								content: msg.content,
								timestamp: msg.timestamp,
								isOwn: msg.sender_id === currentUserId,
								is_read: msg.is_read,
								channel_id: msg.channel_id,
							}))
						: []

					history.sort(
						(a, b) =>
							new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
					)
					setMessages(history)
					setOffset(50)
					setHasMore(history.length >= 50)
				}
			} catch (err) {
				console.error('Error loading history:', err)
			} finally {
				setIsLoading(false)
			}
		}

		if (targetUserId || channelId) {
			setMessages([])
			setOffset(0)
			setHasMore(true)
			fetchHistory()
		} else {
			setMessages([])
			setOffset(0)
		}
	}, [targetUserId, currentUserId, channelId])

	const loadMoreMessages = useCallback(async () => {
		if (
			(!targetUserId && !channelId) ||
			!currentUserId ||
			isLoading ||
			!hasMore
		)
			return

		setIsLoading(true)
		try {
			let endpoint = '/api/messages/history'
			const body: any = {
				limit: 50,
				offset: offset,
			}
			if (channelId) {
				endpoint = '/api/channels/history'
				body.channel_id = channelId
			} else if (targetUserId) {
				body.target_id = targetUserId
			}

			const response = await fetch(endpoint, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			})

			if (response.ok) {
				const data = await response.json()
				const newOldMessages: Message[] = Array.isArray(data)
					? data.map((msg: any) => ({
							id: msg.id || Math.random().toString(),
							sender_id: msg.sender_id,
							content: msg.content,
							timestamp: msg.timestamp,
							isOwn: msg.sender_id === currentUserId,
							is_read: msg.is_read,
							channel_id: msg.channel_id,
						}))
					: []

				if (newOldMessages.length < 50) {
					setHasMore(false)
				}

				newOldMessages.sort(
					(a, b) =>
						new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
				)

				setMessages(prev => [...newOldMessages, ...prev])
				setOffset(prev => prev + 50)
			}
		} catch (err) {
			console.error('Error loading more messages:', err)
		} finally {
			setIsLoading(false)
		}
	}, [targetUserId, channelId, currentUserId, offset, isLoading, hasMore])

	// 2. Listen for incoming messages
	useEffect(() => {
		if (!socket || (!targetUserId && !channelId)) return

		const handleReceiveMessage = (data: any) => {
			// Handle Channel Message
			if (channelId && data.channel_id === channelId) {
				const newMessage: Message = {
					id: data.id || Date.now().toString() + Math.random().toString(),
					sender_id: data.sender_id,
					content: data.content,
					timestamp: data.timestamp || new Date().toISOString(),
					isOwn: data.sender_id === currentUserId,
					is_read: false,
					channel_id: data.channel_id,
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
				return
			}

			// Handle Direct Message
			if (
				!channelId &&
				targetUserId &&
				data.sender_id === targetUserId &&
				!data.channel_id
			) {
				const newMessage: Message = {
					id: data.id || Date.now().toString() + Math.random().toString(),
					sender_id: data.sender_id,
					content: data.content,
					timestamp: data.timestamp || new Date().toISOString(),
					isOwn: false,
					is_read: false,
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
			}
		}

		const handleSentMessage = (data: any) => {
			const msg = data.message || data

			// Handle Channel Message Confirmation
			if (channelId && msg.channel_id === channelId) {
				const newMessage: Message = {
					id: msg.id || Date.now().toString() + Math.random().toString(),
					sender_id: msg.sender_id,
					content: msg.content,
					timestamp: msg.timestamp || new Date().toISOString(),
					isOwn: true,
					is_read: false,
					channel_id: msg.channel_id,
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
				return
			}

			// Handle Direct Message Confirmation
			if (
				!channelId &&
				targetUserId &&
				(msg.receiver_id === targetUserId ||
					(!msg.receiver_id && !msg.channel_id))
			) {
				// Fallback logic for DM
				const newMessage: Message = {
					id: msg.id || Date.now().toString() + Math.random().toString(),
					sender_id: msg.sender_id,
					content: msg.content,
					timestamp: msg.timestamp || new Date().toISOString(),
					isOwn: true,
					is_read: false,
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
			}
		}

		const handleTyping = (data: any) => {
			// Only for Direct Messages for now
			if (!channelId && targetUserId && data.sender_id === targetUserId) {
				setIsTyping(true)
				if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
				typingTimeoutRef.current = setTimeout(() => {
					setIsTyping(false)
				}, 5000)
			}
		}

		const handleStopTyping = (data: any) => {
			if (!channelId && targetUserId && data.sender_id === targetUserId) {
				setIsTyping(false)
				if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
			}
		}

		const handleMessagesReadUpdate = (data: any) => {
			if (
				!channelId &&
				targetUserId &&
				data.reader_id === targetUserId &&
				Array.isArray(data.message_ids)
			) {
				setMessages(prevMessages =>
					prevMessages.map(msg =>
						data.message_ids.includes(msg.id) ? { ...msg, is_read: true } : msg,
					),
				)
			}
		}

		socket.on('receive_message', handleReceiveMessage)
		socket.on('message_sent', handleSentMessage)
		socket.on('typing', handleTyping)
		socket.on('stop_typing', handleStopTyping)
		socket.on('messages_read_update', handleMessagesReadUpdate)

		return () => {
			socket.off('receive_message', handleReceiveMessage)
			socket.off('message_sent', handleSentMessage)
			socket.off('typing', handleTyping)
			socket.off('stop_typing', handleStopTyping)
			socket.off('messages_read_update', handleMessagesReadUpdate)
		}
	}, [socket, targetUserId, channelId, currentUserId])

	// 3. Send function
	const sendMessage = useCallback(
		(content: string) => {
			if (!socket || (!targetUserId && !channelId) || !currentUserId) return

			const messagePayload: any = {
				content: content,
			}

			if (channelId) {
				messagePayload.channel_id = channelId
			} else if (targetUserId) {
				messagePayload.target_user_id = targetUserId
			}

			socket.emit('send_message', messagePayload)
		},
		[socket, targetUserId, channelId, currentUserId],
	)

	const sendTyping = useCallback(() => {
		if (!socket || !targetUserId || channelId) return // No typing for channels yet
		socket.emit('typing', { target_user_id: targetUserId })
	}, [socket, targetUserId, channelId])

	const sendStopTyping = useCallback(() => {
		if (!socket || !targetUserId || channelId) return
		socket.emit('stop_typing', { target_user_id: targetUserId })
	}, [socket, targetUserId, channelId])

	const markMessagesAsRead = useCallback(
		(messageIds: string[]) => {
			if (
				!socket ||
				!targetUserId ||
				!currentUserId ||
				messageIds.length === 0 ||
				channelId
			)
				return

			socket.emit('message_read', {
				message_ids: messageIds,
				target_sender_id: targetUserId,
			})
		},
		[socket, targetUserId, currentUserId, channelId],
	)

	const searchMessages = useCallback(
		async (query: string) => {
			if ((!targetUserId && !channelId) || !query.trim()) return []

			try {
				const body: any = {
					query: query.trim(),
				}
				if (channelId) {
					body.channel_id = channelId
				} else if (targetUserId) {
					body.target_id = targetUserId
				}

				const response = await fetch('/api/messages/search', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				})

				if (response.ok) {
					const data = await response.json()
					const foundMessages: Message[] = Array.isArray(data)
						? data.map((msg: any) => ({
								id: msg.id || Math.random().toString(),
								sender_id: msg.sender_id,
								content: msg.content,
								timestamp: msg.timestamp,
								isOwn: msg.sender_id === currentUserId,
								channel_id: msg.channel_id,
							}))
						: []

					foundMessages.sort(
						(a, b) =>
							new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
					)

					return foundMessages
				}
				return []
			} catch (err) {
				console.error('Error searching messages:', err)
				return []
			}
		},
		[targetUserId, channelId, currentUserId],
	)

	return {
		messages,
		sendMessage,
		loadMoreMessages,
		searchMessages,
		isLoading,
		isTyping,
		sendTyping,
		sendStopTyping,
		markMessagesAsRead,
	}
}
