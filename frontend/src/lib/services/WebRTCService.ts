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
						
			// Check if we can renegotiate - must be in stable state
			if (pc.signalingState !== 'stable') {
				console.log(`[WebRTC] Cannot start screen share: PC for ${socketId} is in ${pc.signalingState}, waiting for stable state`)
				// If in have-local-offer or have-remote-offer, we need to wait or handle the current negotiation first
				continue
			}
						
			const sender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (sender) {
				try {
					await sender.replaceTrack(track)
				} catch (e) {
					console.error(`[WebRTC] Failed to replace video track for ${socketId}:`, e)
				}
			} else {
				try {
					pc.addTrack(track, stream)
				} catch (e) {
					console.error(`[WebRTC] Failed to add video track for ${socketId}:`, e)
				}
			}
			tasks.push(
				(async () => {
					try {
						// Check state again before creating offer
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed, skipping screen share offer for ${socketId}`)
							return
						}
						const offer = await pc.createOffer()
						// Double-check state before setting local description
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed during offer creation, skipping screen share offer for ${socketId}`)
							return
						}
						await pc.setLocalDescription(offer)
						this.socket.emit('offer', {
							target_socket_id: socketId,
							offer,
							caller_user_id: this.userId,
						})
					} catch (e) {
						console.error(`[WebRTC] Screen share offer failed for ${socketId}:`, e)
					}
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
						
			// Check if we can renegotiate - must be in stable state
			if (pc.signalingState !== 'stable') {
				console.log(`[WebRTC] Cannot stop screen share: PC for ${socketId} is in ${pc.signalingState}, waiting for stable state`)
				continue
			}
						
			const sender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (sender) {
				try {
					pc.removeTrack(sender)
				} catch (e) {
					console.error(`[WebRTC] Failed to remove video sender for ${socketId}:`, e)
				}
				try {
					await sender.replaceTrack(null)
				} catch (e) {
					console.error(`[WebRTC] Failed to replace video track with null for ${socketId}:`, e)
				}
			}
			tasks.push(
				(async () => {
					try {
						// Check state again before creating offer
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed, skipping stop screen share offer for ${socketId}`)
							return
						}
						const offer = await pc.createOffer()
						// Double-check state before setting local description
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed during offer creation, skipping stop screen share offer for ${socketId}`)
							return
						}
						await pc.setLocalDescription(offer)
						this.socket.emit('offer', {
							target_socket_id: socketId,
							offer,
							caller_user_id: this.userId,
						})
					} catch (e) {
						console.error(`[WebRTC] Stop screen share offer failed for ${socketId}:`, e)
					}
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
			console.log(`[WebRTC] ontrack for ${targetSocketId}: kind=${event.track.kind}, state=${event.track.readyState}, muted=${event.track.muted}`)
			
			// Get or create stream for this peer
			let stream = this.remoteStreams.get(targetSocketId)
			if (!stream) {
				stream = new MediaStream()
				this.remoteStreams.set(targetSocketId, stream)
			}
			
		// Add track to stream if not already present
			// For audio tracks, ensure we only have one active audio track per peer to prevent interference
			if (event.track.kind === 'audio') {
				// Remove any existing audio tracks of the same kind to prevent audio mixing issues
				const existingAudioTracks = stream.getTracks().filter(t => t.kind === 'audio')
				existingAudioTracks.forEach(track => {
					try {
						stream!.removeTrack(track)
					} catch (e) {
						console.error(`[WebRTC] Could not remove audio track:`, e)
					}
				})
			}
						
			// Add the new track if not already present
			if (!stream.getTracks().includes(event.track)) {
				try {
					stream.addTrack(event.track)
					console.log(`[WebRTC] Added ${event.track.kind} track to stream for ${targetSocketId}`)
				} catch (e) {
					console.error(`[WebRTC] Could not add track to stream:`, e)
				}
			} else {
				console.log(`[WebRTC] Track already exists in stream for ${targetSocketId}`)
			}
			
			const assign = () => {
				console.log(`[WebRTC] Assigning remote stream for ${targetSocketId}, tracks: ${stream?.getTracks().length}`)
				if (this.onRemoteStream) {
					this.onRemoteStream(targetSocketId, stream!)
				}
			}
			try {
				const track = event.track
				if (track && typeof (track as any).onunmute !== 'undefined') {
					;(track as any).onunmute = () => {
						console.log(`[WebRTC] Remote ${track.kind} track unmuted for ${targetSocketId}`)
						assign()
					}
					;(track as any).onmute = () => {
						console.log(`[WebRTC] Remote ${track.kind} track muted for ${targetSocketId}`)
					}
				}
			} catch {}
			assign()
		}

		// Обработка изменения состояния соединения
		pc.onconnectionstatechange = () => {
			console.log(`[WebRTC] Connection state changed for ${targetSocketId}: ${pc.connectionState}`)
			if (this.onConnectionStateChange) {
				this.onConnectionStateChange(targetSocketId, pc.connectionState)
			}
			if (pc.connectionState === 'connected') {
				// Ensure stream has all tracks - don't create new stream if one exists
				try {
					let stream = this.remoteStreams.get(targetSocketId)
					if (!stream) {
						stream = new MediaStream()
						this.remoteStreams.set(targetSocketId, stream)
					}
					
					// Add any missing tracks from receivers
					const receivers = pc.getReceivers() || []
					const existingTracks = stream.getTracks()
					receivers.forEach(r => {
						if (r.track && !existingTracks.includes(r.track)) {
							console.log(`[WebRTC] Adding missing ${r.track.kind} track to stream on connection`)
							stream!.addTrack(r.track)
						}
					})
					
					// Update UI with the updated stream
					if (stream.getTracks().length > 0 && this.onRemoteStream) {
						this.onRemoteStream(targetSocketId, stream)
					}
				} catch (e) {
					console.error('[WebRTC] Error updating stream on connection:', e)
				}
			} else if (pc.connectionState === 'failed') {
				console.log(`[WebRTC] Connection failed for ${targetSocketId}, attempting ICE restart`)
				this.attemptIceRestart(targetSocketId).catch(e => 
					console.error('ICE restart failed:', e)
				)
			}
		}
		try {
			;(pc as any).oniceconnectionstatechange = () => {
				console.log(`[WebRTC] ICE connection state changed for ${targetSocketId}: ${pc.iceConnectionState}`)
				if (this.onConnectionStateChange) {
					this.onConnectionStateChange(targetSocketId, pc.connectionState)
				}
				// Handle ICE failures with restart
				if (pc.iceConnectionState === 'failed') {
					console.log(`[WebRTC] ICE failed for ${targetSocketId}, attempting ICE restart`)
					this.attemptIceRestart(targetSocketId).catch(e => 
						console.error('ICE restart failed:', e)
					)
				}
				// Log when ICE becomes disconnected - might be temporary
				if (pc.iceConnectionState === 'disconnected') {
					console.log(`[WebRTC] ICE disconnected for ${targetSocketId}, waiting for reconnection...`)
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
			console.log(`[WebRTC] ensureLocalAudioSender for ${targetSocketId}: audioTrack=${!!audioTrack}, enabled=${audioTrack?.enabled}`)
			if (audioTrack) {
				try {
					audioTrack.enabled = true
				} catch {}
				const senders = pc.getSenders()
				const audioSender = senders.find(
					s => s.track && s.track.kind === 'audio',
				)
				if (!audioSender) {
					console.log(`[WebRTC] Adding audio track to PC for ${targetSocketId}`)
					pc.addTrack(audioTrack, this.localStream)
				} else if (audioSender.track !== audioTrack) {
					console.log(`[WebRTC] Replacing audio track for ${targetSocketId}`)
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
						console.log(`[WebRTC] Audio transceiver direction for ${targetSocketId}: ${dir}`)
						if (dir !== 'sendrecv') {
							console.log(`[WebRTC] Setting transceiver direction to sendrecv for ${targetSocketId}`)
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
		// Check if we already have a PC for this caller
		const existingPc = this.peerConnections.get(callerSocketId)
		if (existingPc) {
			console.log(`PC already exists for ${callerSocketId}, state: ${existingPc.signalingState}`)
			// If already connected, skip
			if (existingPc.signalingState === 'stable') {
				console.log(`Already connected to ${callerSocketId}, skipping incoming call`)
				return
			}
		}
		
		// Создаем peer connection для входящего звонка
		const pc = existingPc || this.createPeerConnection(callerSocketId)

		// Check state before setting remote description
		if (pc.signalingState !== 'stable') {
			console.log(`Cannot handle incoming call: PC state is ${pc.signalingState}`)
			return
		}

		// Ensure local audio track is available and added to the connection
		if (!this.localStream) {
			await this.initializeLocalStream();
		}
		
		// Add local audio track if not already present
		if (this.localStream) {
			const audioTrack = this.localStream.getAudioTracks()[0];
			if (audioTrack) {
				const existingSender = pc.getSenders().find(s => s.track?.kind === 'audio');
				if (!existingSender) {
					try {
						pc.addTrack(audioTrack, this.localStream);
					} catch (e) {
						console.error(`[WebRTC] Failed to add audio track to incoming call PC:`, e);
					}
				}
			}
		}

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
		
		// Check if we can accept this offer
		if (pc.signalingState !== 'stable') {
			console.log(`Skipping renegotiation offer from ${socketId}: state is ${pc.signalingState}`)
			return
		}
		
		try {
			// Check state before setting remote description
			if (pc.signalingState !== 'stable') {
				console.log(`Cannot process renegotiation offer from ${socketId}: state is ${pc.signalingState}`)
				return
			}
			await pc.setRemoteDescription(new RTCSessionDescription(offer))
			this.processBufferedCandidates(socketId)
			// Create and send answer for the renegotiation offer
			const answer = await pc.createAnswer()
			await pc.setLocalDescription(answer)
			// Send the answer back to the peer
			this.socket.emit('answer', {
				target_socket_id: socketId,
				answer,
			})
		} catch (e: any) {
			if (e.message?.includes('wrong state') || e.message?.includes('stable')) {
				console.log(`Ignoring renegotiation offer race condition for ${socketId}`)
			} else {
				console.error('Error handling renegotiation offer:', e)
			}
		}
	}

	async acceptCall(callerSocketId: string): Promise<void> {
		try {
			const pc = await this.ensureLocalAudioSender(callerSocketId)
			
			// Double-check state right before creating answer
			if (pc.signalingState !== 'have-remote-offer') {
				// If we're in stable state, it means we might have already processed the offer or it was processed elsewhere
				if (pc.signalingState === 'stable') {
					console.log(`PC is in stable state, cannot create answer for ${callerSocketId}`)
					return
				}
				// If we're in have-local-offer, it means we already created an offer ourselves
				else if (pc.signalingState === 'have-local-offer') {
					console.log(`PC is in have-local-offer state, cannot create answer for ${callerSocketId}`)
					return
				}
				// For other states, log and return
				else {
					console.log(`Cannot accept call: PC state is ${pc.signalingState}, expected 'have-remote-offer'`)
					return
				}
			}

			// Создаем answer
			const answer = await pc.createAnswer()
			// Double-check state again before setting local description
			if (pc.signalingState !== 'have-remote-offer') {
				console.log(`State changed during answer creation, skipping for ${callerSocketId}`)
				return
			}
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
			// Handle failed ICE negotiation by forcing a renegotiation with TURN
			if (this.hasTurn) {
				this.renegotiateWithRelay(callerSocketId).catch(err =>
					console.error('Relay fallback failed:', err),
				)
			}

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
			
			// After migration, ensure local audio track is properly added if needed
			if (this.localStream) {
				const audioTrack = this.localStream.getAudioTracks()[0];
				if (audioTrack) {
					const existingSender = pc.getSenders().find(s => s.track?.kind === 'audio');
					if (!existingSender) {
						try {
							pc.addTrack(audioTrack, this.localStream);
							console.log(`[WebRTC] Added audio track after migrating connection from ${oldKey} to ${newKey}`);
						} catch (e) {
							console.error(`[WebRTC] Failed to add audio track after migration:`, e);
						}
					} else if (existingSender.track !== audioTrack) {
						try {
							existingSender.replaceTrack(audioTrack);
							console.log(`[WebRTC] Replaced audio track after migrating connection from ${oldKey} to ${newKey}`);
						} catch (e) {
							console.error(`[WebRTC] Failed to replace audio track after migration:`, e);
						}
					}
				}
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
			// Check if we're in the right state to accept an answer
			const currentState = pc.signalingState
			// We should be in 'have-local-offer' state if we sent an offer and are receiving an answer
			if (currentState !== 'have-local-offer') {
				console.log(`[WebRTC] Skipping answer from ${data.sender_socket_id}: connection state is ${currentState}, expected 'have-local-offer'`)
				return
			}
						
			// Double-check state right before setting remote description
			if (pc.signalingState !== 'have-local-offer') {
				console.log(`[WebRTC] State changed during answer processing, skipping answer for ${data.sender_socket_id}`)
				return
			}
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
			} catch (err: any) {
				// Check if it's a state error - this can happen in race conditions
				if (err.message?.includes('wrong state') || err.message?.includes('stable')) {
					console.log(`[WebRTC] Ignoring answer for ${data.sender_socket_id} - state race condition`)
				} else {
					console.error('[WebRTC] Error setting remote description:', err)
				}
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
				try {
					await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
				} catch (e: any) {
					// Ignore "Unknown ufrag" errors - these happen when ICE candidates
					// arrive for a previous ICE generation that was replaced
					if (e.message?.includes('ufrag') || e.message?.includes('Unknown')) {
						console.log(`Ignoring stale ICE candidate from ${data.sender_socket_id}`)
					} else {
						console.error('Error adding ICE candidate:', e)
					}
				}
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

	// Attempt ICE restart to recover from connection failures
	private async attemptIceRestart(targetSocketId: string): Promise<void> {
		const pc = this.peerConnections.get(targetSocketId)
		if (!pc) {
			console.log(`[WebRTC] No PC for ${targetSocketId}, cannot restart ICE`)
			return
		}

		// Check if we're the offerer or answerer
		const isOfferer = pc.localDescription?.type === 'offer'
		
		if (isOfferer) {
			console.log(`[WebRTC] Restarting ICE as offerer for ${targetSocketId}`)
			try {
				const offer = await pc.createOffer({ iceRestart: true })
				await pc.setLocalDescription(offer)
				this.socket.emit('offer', {
					target_socket_id: targetSocketId,
					offer,
				})
			} catch (e: any) {
				console.error('[WebRTC] ICE restart failed:', e)
				// Fall back to full reconnect with relay
				if (this.hasTurn) {
					await this.renegotiateWithRelay(targetSocketId)
				}
			}
		} else {
			console.log(`[WebRTC] Not the offerer for ${targetSocketId}, requesting ICE restart from peer`)
			// Request the other side to restart ICE by sending a restart offer
			// We can't initiate ICE restart as answerer
		}
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
