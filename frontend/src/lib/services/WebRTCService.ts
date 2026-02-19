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
	private screenStream: MediaStream | null = null
	private isSharingScreen: boolean = false
	private remoteStreams: Map<string, MediaStream> = new Map()
	public peerConnections: Map<string, RTCPeerConnection> = new Map()
	private iceCandidateQueue: Map<string, RTCIceCandidate[]> = new Map()
	private incomingIceQueue: Map<string, RTCIceCandidateInit[]> = new Map()
	private configuration: WebRTCConfig
	private hasTurn: boolean = false
	private forceRelay: boolean = false

	// Callbacks
	public onRemoteStream?: (socketId: string, stream: MediaStream) => void
	public onConnectionStateChange?: (
		socketId: string,
		state: RTCPeerConnectionState,
	) => void
	public onLocalStream?: (stream: MediaStream) => void
	public onCallMigrated?: (oldKey: string, newKey: string) => void
	public onScreenShareStateChange?: (
		stream: MediaStream | null,
		isSharing: boolean,
	) => void

	constructor(socket: Socket, userId: string) {
		this.socket = socket
		this.userId = userId
		this.configuration = {
			iceServers: [
				{ urls: 'stun:stun.l.google.com:19302' },
				{ urls: 'stun:stun1.l.google.com:19302' },
			],
		}
		try {
			let turnUrl =
				typeof process !== 'undefined'
					? (process.env.NEXT_PUBLIC_TURN_URL as string | undefined)
					: undefined
			const turnUrlsEnv =
				typeof process !== 'undefined'
					? (process.env.NEXT_PUBLIC_TURN_URLS as string | undefined)
					: undefined
			const turnUser =
				typeof process !== 'undefined'
					? (process.env.NEXT_PUBLIC_TURN_USERNAME as string | undefined)
					: undefined
			const turnPass =
				typeof process !== 'undefined'
					? (process.env.NEXT_PUBLIC_TURN_PASSWORD as string | undefined)
					: undefined
			const turnRawList: string[] = []
			if (turnUrl) turnRawList.push(turnUrl)
			if (turnUrlsEnv)
				turnRawList.push(
					...turnUrlsEnv
						.split(/[,\s]+/)
						.map(s => s.trim())
						.filter(Boolean),
				)
			if (turnRawList.length && turnUser && turnPass) {
				const urls: string[] = []
				for (let u of turnRawList) {
					u = u.trim()
					if (!u) continue
					if (u.startsWith('turn://')) u = 'turn:' + u.slice(7)
					else if (u.startsWith('turns://')) u = 'turns:' + u.slice(8)
					const hasTransport = /\?transport=(udp|tcp)$/i.test(u)
					if (u.startsWith('turns:')) {
						const v = hasTransport ? u : `${u}?transport=tcp`
						urls.push(v)
					} else {
						if (hasTransport) {
							urls.push(u)
						} else {
							const base = u.replace(/\?transport=(udp|tcp)$/i, '')
							urls.push(`${base}?transport=udp`, `${base}?transport=tcp`)
						}
					}
				}
				if (urls.length) {
					;(this.configuration.iceServers as RTCIceServer[]).push({
						urls,
						username: turnUser,
						credential: turnPass,
					} as any)
					this.hasTurn = true
				}
			}
			const fr =
				typeof process !== 'undefined'
					? (process.env.NEXT_PUBLIC_FORCE_RELAY as string | undefined)
					: undefined
			this.forceRelay = fr === 'true'
			if (this.forceRelay && !this.hasTurn) {
				console.warn(
					'[WebRTC] FORCE_RELAY enabled but no TURN credentials provided; ICE may stay in "new"',
				)
			}
		} catch {}
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

	private notifyScreenShareState() {
		if (this.onScreenShareStateChange) {
			this.onScreenShareStateChange(this.screenStream, this.isSharingScreen)
		}
	}

	private async ensureScreenStream(): Promise<MediaStream> {
		if (this.screenStream) {
			return this.screenStream
		}
		const mediaDevices =
			typeof navigator !== 'undefined' ? navigator.mediaDevices : null
		if (!mediaDevices || typeof mediaDevices.getDisplayMedia !== 'function') {
			throw new Error('Демонстрация экрана недоступна на этом устройстве')
		}
		const userAgent =
			typeof navigator !== 'undefined' ? navigator.userAgent : ''
		const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent)
		const videoConstraints = isMobile
			? {
					width: { ideal: 960, max: 1280 },
					height: { ideal: 540, max: 720 },
					frameRate: { ideal: 12, max: 24 },
				}
			: {
					width: { ideal: 1280, max: 1920 },
					height: { ideal: 720, max: 1080 },
					frameRate: { ideal: 15, max: 30 },
				}
		const stream = await navigator.mediaDevices.getDisplayMedia({
			video: videoConstraints,
			audio: false,
		})
		this.screenStream = stream
		this.isSharingScreen = true
		const track = stream.getVideoTracks()[0]
		if (track) {
			track.onended = () => {
				this.stopScreenShare().catch(() => {})
			}
		}
		this.notifyScreenShareState()
		return stream
	}

	private isSocketKey(key: string) {
		return /^[A-Za-z0-9_-]{16,30}$/.test(key)
	}

	async startScreenShare(): Promise<void> {
		const stream = await this.ensureScreenStream()
		const track = stream.getVideoTracks()[0]
		if (!track) return
		const tasks: Promise<void>[] = []
		for (const [socketId, pc] of this.peerConnections.entries()) {
			if (!this.isSocketKey(socketId)) continue
			const sender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (sender) {
				try {
					tasks.push(sender.replaceTrack(track))
				} catch {}
			} else {
				try {
					pc.addTrack(track, stream)
				} catch {}
			}
			tasks.push(
				(async () => {
					const offer = await pc.createOffer()
					await pc.setLocalDescription(offer)
					this.socket.emit('offer', {
						target_socket_id: socketId,
						offer,
						caller_user_id: this.userId,
					})
				})(),
			)
		}
		await Promise.allSettled(tasks)
	}

	async stopScreenShare(): Promise<void> {
		const stream = this.screenStream
		if (!stream) return
		stream.getTracks().forEach(track => {
			try {
				track.stop()
			} catch {}
		})
		this.screenStream = null
		this.isSharingScreen = false
		this.notifyScreenShareState()
		const tasks: Promise<void>[] = []
		for (const [socketId, pc] of this.peerConnections.entries()) {
			if (!this.isSocketKey(socketId)) continue
			const sender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (sender) {
				try {
					pc.removeTrack(sender)
				} catch {}
				try {
					await sender.replaceTrack(null)
				} catch {}
			}
			tasks.push(
				(async () => {
					const offer = await pc.createOffer()
					await pc.setLocalDescription(offer)
					this.socket.emit('offer', {
						target_socket_id: socketId,
						offer,
						caller_user_id: this.userId,
					})
				})(),
			)
		}
		await Promise.allSettled(tasks)
	}

	getScreenStream(): MediaStream | null {
		return this.screenStream
	}

	isScreenSharing(): boolean {
		return this.isSharingScreen
	}

	private setupPeerConnectionHandlers(
		pc: RTCPeerConnection,
		targetSocketId: string,
	) {
		// Обработка ICE кандидатов
		pc.onicecandidate = event => {
			if (event.candidate) {
				const isLikelySocketId = /^[A-Za-z0-9_-]{16,30}$/.test(targetSocketId)
				if (isLikelySocketId) {
					this.socket.emit('ice_candidate', {
						target_socket_id: targetSocketId,
						candidate: event.candidate,
					})
				} else {
					const queue = this.iceCandidateQueue.get(targetSocketId) || []
					queue.push(event.candidate)
					this.iceCandidateQueue.set(targetSocketId, queue)
				}
			}
		}

		// Обработка входящих стримов
		pc.ontrack = event => {
			const stream =
				(event.streams && event.streams[0]) || new MediaStream([event.track])
			const assign = () => {
				this.remoteStreams.set(targetSocketId, stream)
				if (this.onRemoteStream) {
					this.onRemoteStream(targetSocketId, stream)
				}
			}
			try {
				const track = event.track
				if (track && typeof (track as any).onunmute !== 'undefined') {
					;(track as any).onunmute = () => {
						console.log('[WebRTC] Remote track unmuted, assigning stream')
						assign()
					}
				}
			} catch {}
			assign()
		}

		// Обработка изменения состояния соединения
		pc.onconnectionstatechange = () => {
			if (this.onConnectionStateChange) {
				this.onConnectionStateChange(targetSocketId, pc.connectionState)
			}
			if (
				pc.connectionState === 'connected' ||
				pc.connectionState === 'completed'
			) {
				try {
					const receivers = pc.getReceivers() || []
					const tracks = receivers
						.map(r => r.track)
						.filter((t): t is MediaStreamTrack => !!t)
					if (tracks.length > 0) {
						const stream = new MediaStream(tracks)
						this.remoteStreams.set(targetSocketId, stream)
						if (this.onRemoteStream) this.onRemoteStream(targetSocketId, stream)
					}
				} catch {}
			}
		}
		try {
			;(pc as any).oniceconnectionstatechange = () => {
				if (this.onConnectionStateChange) {
					this.onConnectionStateChange(targetSocketId, pc.connectionState)
				}
			}
		} catch {}
	}

	private createPeerConnectionWithPolicy(
		targetSocketId: string,
		policy: 'all' | 'relay' = 'all',
	): RTCPeerConnection {
		const baseConfig: any = { iceServers: this.configuration.iceServers }
		if (policy === 'relay') baseConfig.iceTransportPolicy = 'relay'
		const pc = new RTCPeerConnection(baseConfig)

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

	createPeerConnection(targetSocketId: string): RTCPeerConnection {
		return this.createPeerConnectionWithPolicy(
			targetSocketId,
			this.forceRelay ? 'relay' : 'all',
		)
	}

	ensurePeerConnection(targetSocketId: string): RTCPeerConnection {
		if (this.peerConnections.has(targetSocketId)) {
			return this.peerConnections.get(targetSocketId)!
		}
		return this.createPeerConnection(targetSocketId)
	}

	async ensureLocalAudioSender(
		targetSocketId: string,
	): Promise<RTCPeerConnection> {
		if (!this.localStream) {
			await this.initializeLocalStream()
		}
		const pc = this.ensurePeerConnection(targetSocketId)
		if (this.localStream) {
			const audioTrack = this.localStream.getAudioTracks()[0]
			if (audioTrack) {
				try {
					audioTrack.enabled = true
				} catch {}
				const senders = pc.getSenders()
				const audioSender = senders.find(
					s => s.track && s.track.kind === 'audio',
				)
				if (!audioSender) {
					pc.addTrack(audioTrack, this.localStream)
				} else if (audioSender.track !== audioTrack) {
					try {
						await audioSender.replaceTrack(audioTrack)
					} catch {}
				}
				try {
					const transceivers = pc.getTransceivers()
					const audioTransceiver = transceivers.find(
						t =>
							(t.receiver &&
								t.receiver.track &&
								t.receiver.track.kind === 'audio') ||
							(t.sender && t.sender.track && t.sender.track.kind === 'audio'),
					)
					if (audioTransceiver) {
						const dir: any = (audioTransceiver as any).direction
						if (dir !== 'sendrecv') {
							try {
								;(audioTransceiver as any).direction = 'sendrecv'
							} catch {}
							try {
								if (
									typeof (audioTransceiver as any).setDirection === 'function'
								) {
									;(audioTransceiver as any).setDirection('sendrecv')
								}
							} catch {}
						}
					}
				} catch {}
			}
		}
		return pc
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

			// Ensure local audio is available and attached before creating offer
			if (!this.localStream) {
				this.localStream = await navigator.mediaDevices.getUserMedia({
					audio: true,
					video: false,
				})
				if (this.onLocalStream) {
					this.onLocalStream(this.localStream)
				}
			}

			const pc = this.createPeerConnection(targetUserId)
			// Double-check sender presence for audio
			const hasAudioSender = pc
				.getSenders()
				.some(s => s.track && s.track.kind === 'audio')
			if (this.localStream && !hasAudioSender) {
				const audioTrack = this.localStream.getAudioTracks()[0]
				if (audioTrack) {
					pc.addTrack(audioTrack, this.localStream)
				}
			}

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

		// Process any buffered ICE candidates
		this.processBufferedCandidates(callerSocketId)
	}

	async handleRenegotiationOffer(
		socketId: string,
		offer: RTCSessionDescriptionInit,
	): Promise<void> {
		const pc =
			this.ensurePeerConnection(socketId) || this.createPeerConnection(socketId)
		await pc.setRemoteDescription(new RTCSessionDescription(offer))
		this.processBufferedCandidates(socketId)
		// Immediately generate answer for renegotiation
		await this.acceptCall(socketId)
	}

	async acceptCall(callerSocketId: string): Promise<void> {
		try {
			const pc = await this.ensureLocalAudioSender(callerSocketId)

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
			if (this.onCallMigrated) {
				try {
					this.onCallMigrated(oldKey, newKey)
				} catch {}
			}
		}
	}

	async handleAnswer(data: {
		sender_socket_id: string
		answer: RTCSessionDescriptionInit
	}): Promise<void> {
		console.log(`[WebRTC] Received answer from ${data.sender_socket_id}`)
		// Try to find PC by socket_id
		let pc = this.peerConnections.get(data.sender_socket_id)

		if (!pc) {
			console.log(
				`[WebRTC] PC not found for ${data.sender_socket_id}, checking for outgoing calls in 'have-local-offer' state`,
			)
			// If not found, it might be one of the outgoing calls keyed by userId.
			// This handles the race condition where 'answer' arrives before 'call_accepted'.
			// We look for any PC that is in 'have-local-offer' state.
			for (const [key, connection] of this.peerConnections.entries()) {
				console.log(
					`[WebRTC] Checking PC: key=${key}, state=${connection.signalingState}`,
				)
				if (connection.signalingState === 'have-local-offer') {
					console.log(
						`[WebRTC] Found matching PC keyed by ${key}, migrating to ${data.sender_socket_id}`,
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
			try {
				console.log(
					`[WebRTC] Setting remote description for answer from ${data.sender_socket_id}`,
				)
				await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
				console.log('[WebRTC] Remote description set from answer')
				this.processBufferedCandidates(data.sender_socket_id)

				try {
					const dirs =
						(typeof data.answer.sdp === 'string' &&
							data.answer.sdp.match(/a=(sendrecv|recvonly|sendonly)/g)) ||
						[]
					console.log('Answer direction lines:', dirs)
				} catch {}

				try {
					const trans = pc
						.getTransceivers()
						.find(
							t =>
								t.receiver &&
								t.receiver.track &&
								t.receiver.track.kind === 'audio',
						)
					const dir: any = trans ? (trans as any).direction : ''
					console.log('Remote audio direction from answer:', dir)
					if (dir !== 'sendrecv' && dir !== 'sendonly') {
						console.warn('Remote side is not sending audio')
					}
				} catch {}

				try {
					const rc = pc
						.getReceivers()
						.filter(r => r.track && r.track.kind === 'audio').length
					console.log('Audio receivers count after answer:', rc)
					if (rc === 0) {
						console.warn('No audio receivers after answer')
					}
				} catch {}

				try {
					const hasAudioReceiver = pc
						.getReceivers()
						.some(r => r.track && r.track.kind === 'audio')
					if (!hasAudioReceiver && this.hasTurn) {
						setTimeout(() => {
							const againPc = this.peerConnections.get(data.sender_socket_id)
							if (againPc) {
								const stillNoAudio = !againPc
									.getReceivers()
									.some(r => r.track && r.track.kind === 'audio')
								if (stillNoAudio) {
									this.renegotiateWithRelay(data.sender_socket_id).catch(err =>
										console.error(
											'Relay fallback (no audio receiver) failed:',
											err,
										),
									)
								}
							}
						}, 1500)
					}
				} catch {}

				if (this.hasTurn) {
					setTimeout(() => {
						const current = this.peerConnections.get(data.sender_socket_id)
						if (current && current.connectionState !== 'connected') {
							console.log(
								`[WebRTC] Connection not established, attempting TURN relay fallback for ${data.sender_socket_id}`,
							)
							this.renegotiateWithRelay(data.sender_socket_id).catch(err =>
								console.error('Relay fallback failed:', err),
							)
						}
					}, 8000)
				}
			} catch (err) {
				console.error('[WebRTC] Error setting remote description:', err)
			}
		} else {
			console.error(
				'[WebRTC] Peer connection not found for answer from:',
				data.sender_socket_id,
				'Existing PC keys:',
				Array.from(this.peerConnections.keys()),
			)
			// Last ditch effort: maybe it's just a new incoming answer we didn't expect?
			// But for answers, we must have an offer sent.
		}
	}

	async handleIceCandidate(data: {
		sender_socket_id: string
		candidate: RTCIceCandidateInit
	}) {
		const pc = this.peerConnections.get(data.sender_socket_id)
		if (pc) {
			if (pc.remoteDescription && pc.remoteDescription.type) {
				await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
			} else {
				console.log(
					`Buffering incoming ICE candidate from ${data.sender_socket_id} (remote description not set)`,
				)
				const queue = this.incomingIceQueue.get(data.sender_socket_id) || []
				queue.push(data.candidate)
				this.incomingIceQueue.set(data.sender_socket_id, queue)
			}
		} else {
			// If PC doesn't exist yet, we should also buffer?
			// Usually handleIncomingCall creates PC.
			// If ICE arrives before offer (very rare but possible in some UDP scenarios or race conditions),
			// we should buffer.
			console.log(
				`Buffering incoming ICE candidate from ${data.sender_socket_id} (PC not found)`,
			)
			const queue = this.incomingIceQueue.get(data.sender_socket_id) || []
			queue.push(data.candidate)
			this.incomingIceQueue.set(data.sender_socket_id, queue)
		}
	}

	private async processBufferedCandidates(socketId: string) {
		const queue = this.incomingIceQueue.get(socketId)
		if (queue && queue.length > 0) {
			console.log(
				`Processing ${queue.length} buffered ICE candidates for ${socketId}`,
			)
			const pc = this.peerConnections.get(socketId)
			if (pc) {
				for (const candidate of queue) {
					try {
						await pc.addIceCandidate(new RTCIceCandidate(candidate))
					} catch (e) {
						console.error('Error adding buffered ICE candidate:', e)
					}
				}
				this.incomingIceQueue.delete(socketId)
			}
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

	private async renegotiateWithRelay(targetSocketId: string): Promise<void> {
		this.cleanupCall(targetSocketId)
		const pc = this.createPeerConnectionWithPolicy(targetSocketId, 'relay')
		const offer = await pc.createOffer()
		await pc.setLocalDescription(offer)
		this.socket.emit('offer', {
			target_socket_id: targetSocketId,
			offer,
		})
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
		if (this.screenStream) {
			this.screenStream.getTracks().forEach(track => track.stop())
			this.screenStream = null
			this.isSharingScreen = false
			this.notifyScreenShareState()
		}
	}
}
