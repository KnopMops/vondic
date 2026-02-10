import { Socket } from 'socket.io-client'

export interface WebRTCConfig {
	iceServers: RTCIceServer[]
}

export interface CallState {
	socketId: string
	userId: string
	userName?: string
	avatarUrl?: string
	status: 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'failed'
	startTime?: Date
	duration?: number
	isGroupCall?: boolean
	groupId?: string
	callId?: string
}

export class WebRTCService {
	private socket: Socket
	private userId: string
	private localStream: MediaStream | null = null
	private remoteStreams: Map<string, MediaStream> = new Map()
	public peerConnections: Map<string, RTCPeerConnection> = new Map()
	private iceCandidateQueue: Map<string, RTCIceCandidate[]> = new Map()
	private configuration: WebRTCConfig

	// Callbacks
	public onRemoteStream?: (socketId: string, stream: MediaStream) => void
	public onConnectionStateChange?: (
		socketId: string,
		state: RTCPeerConnectionState,
	) => void
	public onLocalStream?: (stream: MediaStream) => void

	constructor(socket: Socket, userId: string) {
		this.socket = socket
		this.userId = userId
		this.configuration = {
			iceServers: [
				{ urls: 'stun:stun.l.google.com:19302' },
				{ urls: 'stun:stun1.l.google.com:19302' },
			],
		}
	}

	async initializeLocalStream(): Promise<MediaStream> {
		try {
			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: true,
				video: false, // Только аудио для голосовых звонков
			})

			if (this.onLocalStream) {
				this.onLocalStream(this.localStream)
			}

			return this.localStream
		} catch (error) {
			console.error('Error accessing microphone:', error)
			throw new Error('Не удалось получить доступ к микрофону')
		}
	}

	private setupPeerConnectionHandlers(
		pc: RTCPeerConnection,
		targetSocketId: string,
	) {
		// Обработка ICE кандидатов
		pc.onicecandidate = event => {
			if (event.candidate) {
				// Check if targetSocketId looks like a UUID (length > 30 is a safe heuristic for UUID vs SocketID)
				// Socket.IO IDs are usually 20 chars. UUIDs are 36.
				if (targetSocketId.length > 30) {
					console.log('Buffering ICE candidate for userId:', targetSocketId)
					const queue = this.iceCandidateQueue.get(targetSocketId) || []
					queue.push(event.candidate)
					this.iceCandidateQueue.set(targetSocketId, queue)
				} else {
					this.socket.emit('ice_candidate', {
						target_socket_id: targetSocketId,
						candidate: event.candidate,
					})
				}
			}
		}

		// Обработка входящих стримов
		pc.ontrack = event => {
			const stream = event.streams[0]
			this.remoteStreams.set(targetSocketId, stream)

			if (this.onRemoteStream) {
				this.onRemoteStream(targetSocketId, stream)
			}
		}

		// Обработка изменения состояния соединения
		pc.onconnectionstatechange = () => {
			if (this.onConnectionStateChange) {
				this.onConnectionStateChange(targetSocketId, pc.connectionState)
			}
		}
	}

	createPeerConnection(targetSocketId: string): RTCPeerConnection {
		const pc = new RTCPeerConnection(this.configuration)

		// Добавление локального стрима
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => {
				pc.addTrack(track, this.localStream!)
			})
		}

		this.setupPeerConnectionHandlers(pc, targetSocketId)

		this.peerConnections.set(targetSocketId, pc)
		return pc
	}

	ensurePeerConnection(targetSocketId: string): RTCPeerConnection {
		if (this.peerConnections.has(targetSocketId)) {
			return this.peerConnections.get(targetSocketId)!
		}
		return this.createPeerConnection(targetSocketId)
	}

	migrateCall(oldKey: string, newKey: string): void {
		const pc = this.peerConnections.get(oldKey)
		if (pc) {
			this.peerConnections.delete(oldKey)
			this.peerConnections.set(newKey, pc)

			const stream = this.remoteStreams.get(oldKey)
			if (stream) {
				this.remoteStreams.delete(oldKey)
				this.remoteStreams.set(newKey, stream)
			}

			// Note: Handlers attached to this PC still use the oldKey in their closures.
			// This might be an issue if the server expects the newKey for ICE candidates.
			// However, for group calls we use socketIds directly.
		}
	}

	async initiateCall(targetUserId: string): Promise<void> {
		try {
			console.log('Initiating call to user:', targetUserId)
			// Note: We use targetUserId as a temporary key for the PC until we get the socketId from the answer/events
			// Or ideally, we should map userId to socketId before creating PC.
			// However, since we don't have the socketId yet, we'll store it by userId?
			// Wait, createPeerConnection expects a key. If we use userId, subsequent events using socketId won't match.
			// But we can't get socketId easily without asking server.
			// The flow implies we send to userId, server routes to socketId.
			// When we receive 'call_accepted', we get 'from_socket_id'.
			// So we need to migrate the PC from userId key to socketId key then.

			const pc = this.createPeerConnection(targetUserId)
			const offer = await pc.createOffer()
			await pc.setLocalDescription(offer)
			console.log('Created offer:', offer)

			// Отправляем сигнал о звонке
			console.log('Emitting call_user event for user_id:', targetUserId)

			const payload = {
				target_user_id: targetUserId,
				offer: offer,
			}

			console.log(
				'DEBUG: Emitting call_user payload:',
				JSON.stringify(payload, null, 2),
			)
			this.socket.emit('call_user', payload)
		} catch (error) {
			console.error('Failed to initiate call:', error)
			throw error
		}
	}

	async handleIncomingCall(
		callerSocketId: string,
		offer: RTCSessionDescriptionInit,
	): Promise<void> {
		console.log('Handling incoming call from:', callerSocketId)
		// Создаем peer connection для входящего звонка
		const pc = this.createPeerConnection(callerSocketId)

		// Устанавливаем полученный offer
		await pc.setRemoteDescription(new RTCSessionDescription(offer))
		console.log('Remote description set for incoming call')
	}

	async acceptCall(callerSocketId: string): Promise<void> {
		try {
			const pc = this.peerConnections.get(callerSocketId)
			if (!pc) {
				throw new Error('Peer connection not found')
			}

			// Создаем answer
			const answer = await pc.createAnswer()
			await pc.setLocalDescription(answer)
			console.log('Answer created and set as local description')

			// Отправляем сигнал о принятии звонка (confirmation)
			this.socket.emit('call_answer', { caller_socket_id: callerSocketId })

			// Отправляем SDP answer
			const answerPayload = {
				target_socket_id: callerSocketId,
				answer: answer,
			}

			console.log(
				'DEBUG: Emitting answer payload:',
				JSON.stringify(answerPayload, null, 2),
			)
			this.socket.emit('answer', answerPayload)
		} catch (error) {
			console.error('Failed to accept call:', error)
			throw error
		}
	}

	public migrateCall(oldKey: string, newKey: string): void {
		const pc = this.peerConnections.get(oldKey)
		if (pc) {
			console.log(`Migrating peer connection from ${oldKey} to ${newKey}`)
			this.peerConnections.delete(oldKey)
			this.peerConnections.set(newKey, pc)

			// Update handlers to use new key
			this.setupPeerConnectionHandlers(pc, newKey)

			// Migrate remote stream
			const stream = this.remoteStreams.get(oldKey)
			if (stream) {
				this.remoteStreams.delete(oldKey)
				this.remoteStreams.set(newKey, stream)
			}

			// Flush buffered ICE candidates
			if (this.iceCandidateQueue.has(oldKey)) {
				const queue = this.iceCandidateQueue.get(oldKey)
				if (queue) {
					console.log(`Flushing ${queue.length} ICE candidates to ${newKey}`)
					queue.forEach(candidate => {
						this.socket.emit('ice_candidate', {
							target_socket_id: newKey,
							candidate: candidate,
						})
					})
					this.iceCandidateQueue.delete(oldKey)
				}
			}
		}
	}

	async handleAnswer(data: {
		sender_socket_id: string
		answer: RTCSessionDescriptionInit
	}): Promise<void> {
		// Try to find PC by socket_id
		let pc = this.peerConnections.get(data.sender_socket_id)

		if (!pc) {
			// If not found, it might be one of the outgoing calls keyed by userId.
			// This handles the race condition where 'answer' arrives before 'call_accepted'.
			// We look for any PC that is in 'have-local-offer' state.
			for (const [key, connection] of this.peerConnections.entries()) {
				if (connection.signalingState === 'have-local-offer') {
					console.log(
						`Found matching PC keyed by ${key}, migrating to ${data.sender_socket_id}`,
					)

					// Perform migration
					this.migrateCall(key, data.sender_socket_id)

					// Get the migrated PC
					pc = this.peerConnections.get(data.sender_socket_id)
					break
				}
			}
		}

		if (pc) {
			await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
			console.log('Remote description set from answer')
		} else {
			console.error(
				'Peer connection not found for answer from:',
				data.sender_socket_id,
			)
		}
	}

	async handleIceCandidate(data: {
		sender_socket_id: string
		candidate: RTCIceCandidateInit
	}) {
		const pc = this.peerConnections.get(data.sender_socket_id)
		if (pc) {
			await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
		}
	}

	rejectCall(callerSocketId: string): void {
		// "Завершение/отклонение звонка" -> call_reject
		this.socket.emit('call_reject', { caller_socket_id: callerSocketId })
		this.cleanupCall(callerSocketId)
	}

	endCall(targetSocketId: string): void {
		this.socket.emit('call_end', { target_socket_id: targetSocketId })
		this.cleanupCall(targetSocketId)
	}

	public cleanupCall(socketId: string) {
		const pc = this.peerConnections.get(socketId)
		if (pc) {
			pc.close()
			this.peerConnections.delete(socketId)
		}

		const remoteStream = this.remoteStreams.get(socketId)
		if (remoteStream) {
			remoteStream.getTracks().forEach(track => track.stop())
			this.remoteStreams.delete(socketId)
		}
	}

	endAllCalls(): void {
		for (const socketId of this.peerConnections.keys()) {
			this.socket.emit('call_end', { target_socket_id: socketId })
			this.cleanupCall(socketId)
		}
	}

	toggleMute(): boolean {
		if (!this.localStream) {
			return false
		}

		const audioTrack = this.localStream.getAudioTracks()[0]
		if (audioTrack) {
			audioTrack.enabled = !audioTrack.enabled
			return !audioTrack.enabled
		}

		return false
	}

	isMuted(): boolean {
		if (!this.localStream) {
			return false
		}

		const audioTrack = this.localStream.getAudioTracks()[0]
		return audioTrack ? !audioTrack.enabled : false
	}

	getLocalStream(): MediaStream | null {
		return this.localStream
	}

	getRemoteStream(socketId: string): MediaStream | null {
		return this.remoteStreams.get(socketId) || null
	}

	getAllRemoteStreams(): Map<string, MediaStream> {
		return new Map(this.remoteStreams)
	}

	getPeerConnection(socketId: string): RTCPeerConnection | null {
		return this.peerConnections.get(socketId) || null
	}

	getAllPeerConnections(): Map<string, RTCPeerConnection> {
		return new Map(this.peerConnections)
	}

	cleanup(): void {
		this.endAllCalls()

		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop())
			this.localStream = null
		}
	}
}
