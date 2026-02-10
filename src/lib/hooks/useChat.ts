import { Message } from '@/lib/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Socket } from 'socket.io-client'

export const useChat = (
	socket: Socket | null,
	currentUserId: string | undefined,
	targetUserId: string | undefined,
	channelId?: string | undefined,
	groupId?: string | undefined,
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
			if (!currentUserId || (!targetUserId && !channelId && !groupId)) return

			setIsLoading(true)
			try {
				// Handle Group History via Socket
				if (groupId && socket) {
					socket.emit('get_group_history', {
						group_id: groupId,
						limit: 50,
						offset: 0,
					})

					const handleHistory = (data: any) => {
						if (data.group_id === groupId) {
							const history: Message[] = Array.isArray(data.messages)
								? data.messages.map((msg: any) => ({
										id: msg.id || Math.random().toString(),
										sender_id: msg.sender_id,
										content: msg.content,
										timestamp: msg.timestamp,
										isOwn: msg.sender_id === currentUserId,
										is_read: msg.is_read,
										group_id: msg.group_id,
										type: msg.type || 'text',
									}))
								: []

							history.sort(
								(a, b) =>
									new Date(a.timestamp).getTime() -
									new Date(b.timestamp).getTime(),
							)
							setMessages(history)
							setOffset(50)
							setHasMore(history.length >= 50)
							setIsLoading(false)
							socket.off('group_history', handleHistory)
						}
					}

					// Remove any previous listeners to avoid duplicates if rapid switching
					socket.off('group_history')
					socket.on('group_history', handleHistory)
					return
				}

				// Handle REST API History (Direct & Channels)
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
								type: msg.type || 'text',
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
				if (!groupId) setIsLoading(false) // For REST, stop loading here. For socket, it's in the listener.
			}
		}

		if (targetUserId || channelId || groupId) {
			setMessages([])
			setOffset(0)
			setHasMore(true)
			fetchHistory()
		} else {
			setMessages([])
			setOffset(0)
		}
	}, [targetUserId, currentUserId, channelId, groupId, socket])

	const loadMoreMessages = useCallback(async () => {
		if (
			(!targetUserId && !channelId && !groupId) ||
			!currentUserId ||
			isLoading ||
			!hasMore
		)
			return

		setIsLoading(true)
		try {
			// Handle Group Load More via Socket
			if (groupId && socket) {
				socket.emit('get_group_history', {
					group_id: groupId,
					limit: 50,
					offset: offset,
				})

				const handleMoreHistory = (data: any) => {
					if (data.group_id === groupId) {
						const newOldMessages: Message[] = Array.isArray(data.messages)
							? data.messages.map((msg: any) => ({
									id: msg.id || Math.random().toString(),
									sender_id: msg.sender_id,
									content: msg.content,
									timestamp: msg.timestamp,
									isOwn: msg.sender_id === currentUserId,
									is_read: msg.is_read,
									group_id: msg.group_id,
									type: msg.type || 'text',
								}))
							: []

						if (newOldMessages.length < 50) {
							setHasMore(false)
						}

						newOldMessages.sort(
							(a, b) =>
								new Date(a.timestamp).getTime() -
								new Date(b.timestamp).getTime(),
						)

						setMessages(prev => [...newOldMessages, ...prev])
						setOffset(prev => prev + 50)
						setIsLoading(false)
						socket.off('group_history', handleMoreHistory)
					}
				}

				socket.once('group_history', handleMoreHistory)
				return
			}

			// Handle REST Load More
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
							type: msg.type || 'text',
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
			if (!groupId) setIsLoading(false)
		}
	}, [
		targetUserId,
		channelId,
		groupId,
		currentUserId,
		offset,
		isLoading,
		hasMore,
		socket,
	])

	// 2. Listen for incoming messages
	useEffect(() => {
		if (!socket || (!targetUserId && !channelId && !groupId)) return

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
					type: data.type || 'text',
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
				return
			}

			// Handle Group Message
			if (groupId && data.group_id === groupId) {
				const newMessage: Message = {
					id: data.id || Date.now().toString() + Math.random().toString(),
					sender_id: data.sender_id,
					content: data.content,
					timestamp: data.timestamp || new Date().toISOString(),
					isOwn: data.sender_id === currentUserId,
					is_read: false,
					group_id: data.group_id,
					type: data.type || 'text',
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
				return
			}

			// Handle Direct Message
			if (
				!channelId &&
				!groupId &&
				targetUserId &&
				data.sender_id === targetUserId &&
				!data.channel_id &&
				!data.group_id
			) {
				const newMessage: Message = {
					id: data.id || Date.now().toString() + Math.random().toString(),
					sender_id: data.sender_id,
					content: data.content,
					timestamp: data.timestamp || new Date().toISOString(),
					isOwn: false,
					is_read: false,
					type: data.type || 'text',
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
					type: msg.type || 'text',
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
				return
			}

			// Handle Group Message Confirmation
			if (groupId && msg.group_id === groupId) {
				const newMessage: Message = {
					id: msg.id || Date.now().toString() + Math.random().toString(),
					sender_id: msg.sender_id,
					content: msg.content,
					timestamp: msg.timestamp || new Date().toISOString(),
					isOwn: true,
					is_read: false,
					group_id: msg.group_id,
					type: msg.type || 'text',
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
				return
			}

			// Handle Direct Message Confirmation
			if (
				!channelId &&
				!groupId &&
				targetUserId &&
				(msg.receiver_id === targetUserId ||
					(!msg.receiver_id && !msg.channel_id && !msg.group_id))
			) {
				// Fallback logic for DM
				const newMessage: Message = {
					id: msg.id || Date.now().toString() + Math.random().toString(),
					sender_id: msg.sender_id,
					content: msg.content,
					timestamp: msg.timestamp || new Date().toISOString(),
					isOwn: true,
					is_read: false,
					type: msg.type || 'text',
				}
				setMessages(prevMessages => [...prevMessages, newMessage])
			}
		}

		const handleTyping = (data: any) => {
			// Only for Direct Messages for now
			if (
				!channelId &&
				!groupId &&
				targetUserId &&
				data.sender_id === targetUserId
			) {
				setIsTyping(true)
				if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
				typingTimeoutRef.current = setTimeout(() => {
					setIsTyping(false)
				}, 5000)
			}
		}

		const handleStopTyping = (data: any) => {
			if (
				!channelId &&
				!groupId &&
				targetUserId &&
				data.sender_id === targetUserId
			) {
				setIsTyping(false)
				if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
			}
		}

		const handleMessagesReadUpdate = (data: any) => {
			if (
				!channelId &&
				!groupId &&
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

		const handleError = (err: any) => {
			console.error('Socket error:', err)
			// Optional: Trigger a UI notification here if you have a toast system
			// alert("Error: " + (err.message || "Unknown error"))
		}
		socket.on('error', handleError)

		return () => {
			socket.off('receive_message', handleReceiveMessage)
			socket.off('message_sent', handleSentMessage)
			socket.off('typing', handleTyping)
			socket.off('stop_typing', handleStopTyping)
			socket.off('messages_read_update', handleMessagesReadUpdate)
			socket.off('error', handleError)
		}
	}, [socket, targetUserId, channelId, groupId, currentUserId])

	// 3. Send function
	const sendMessage = useCallback(
		(content: string, type: 'text' | 'voice' = 'text') => {
			if (
				!socket ||
				(!targetUserId && !channelId && !groupId) ||
				!currentUserId
			)
				return

			const messagePayload: any = {
				content: content,
				type: type,
			}

			if (channelId) {
				messagePayload.channel_id = channelId
			} else if (groupId) {
				messagePayload.group_id = groupId
			} else if (targetUserId) {
				messagePayload.target_user_id = targetUserId
			}

			socket.emit('send_message', messagePayload)
		},
		[socket, targetUserId, channelId, groupId, currentUserId],
	)

	const sendTyping = useCallback(() => {
		if (!socket || !targetUserId || channelId || groupId) return // No typing for channels/groups yet

		socket.emit('typing', { target_user_id: targetUserId })
	}, [socket, targetUserId, channelId, groupId])

	const sendStopTyping = useCallback(() => {
		if (!socket || !targetUserId || channelId || groupId) return

		socket.emit('stop_typing', { target_user_id: targetUserId })
	}, [socket, targetUserId, channelId, groupId])

	const markMessagesAsRead = useCallback(
		(messageIds: string[]) => {
			if (!socket || !targetUserId || channelId || groupId) return // Only for DMs

			socket.emit('messages_read', {
				sender_id: targetUserId,
				message_ids: messageIds,
			})
		},
		[socket, targetUserId, channelId, groupId],
	)

	return {
		messages,
		sendMessage,
		loadMoreMessages,
		searchMessages: async () => [], // TODO: Implement search for groups
		isLoading,
		isTyping,
		sendTyping,
		sendStopTyping,
		markMessagesAsRead,
	}
}
