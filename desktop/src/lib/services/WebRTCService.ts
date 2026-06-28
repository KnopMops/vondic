import { Socket } from 'socket.io-client'
import { getDiscordLikeAudioConstraints } from './AudioProcessor'

/** Внутренний coturn (LAN). Переопределение: NEXT_PUBLIC_INTERNAL_TURN_HOST */
const DEFAULT_INTERNAL_TURN_HOST = '192.168.120.248'

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
	private videoStream: MediaStream | null = null
	private screenStream: MediaStream | null = null
	private isSharingScreen: boolean = false
	private isVideoEnabled: boolean = false
	private remoteStreams: Map<string, MediaStream> = new Map()
	public peerConnections: Map<string, RTCPeerConnection> = new Map()
	private iceCandidateQueue: Map<string, RTCIceCandidate[]> = new Map()
	private incomingIceQueue: Map<string, RTCIceCandidateInit[]> = new Map()
	private configuration: WebRTCConfig
	private hasTurn: boolean = false
	private forceRelay: boolean = false
	private turnTested: boolean = false
	private useInternalTurnOnly: boolean = false
	/** Резолвнутый хост internal TURN (для фильтра iceServers и логов) */
	private internalTurnHostResolved: string = DEFAULT_INTERNAL_TURN_HOST
	private iceDisconnectTimeouts: Map<string, NodeJS.Timeout> = new Map()

	
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
	public onVideoStateChange?: (stream: MediaStream | null, isEnabled: boolean) => void

	constructor(socket: Socket, userId: string) {
		this.socket = socket
		this.userId = userId
		this.configuration = {
			iceServers: [
				{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
				{ urls: 'stun:192.168.120.248:3478' },
			],
		}
		try {
			console.log('[WebRTC] Проверка доступа к TURN…')
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

			
			const internalTurnHost =
				typeof process !== 'undefined'
					? (process.env.NEXT_PUBLIC_INTERNAL_TURN_HOST as string | undefined)
					: undefined
			this.internalTurnHostResolved = (
				internalTurnHost ||
				DEFAULT_INTERNAL_TURN_HOST
			).trim()
			const internalTurnUrls = [
				`turn:${this.internalTurnHostResolved}:3478?transport=udp`,
				`turn:${this.internalTurnHostResolved}:3478?transport=tcp`,
			]
			
			const turnRawList: string[] = []
			if (turnUrl) turnRawList.push(turnUrl)
			if (turnUrlsEnv)
				turnRawList.push(
					...turnUrlsEnv
						.split(/[,\s]+/)
						.map(s => s.trim())
						.filter(Boolean),
				)
			
			// Add internal TURN as fallback
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
					// Add external TURN servers first
					;(this.configuration.iceServers as RTCIceServer[]).push({
						urls,
						username: turnUser,
						credential: turnPass,
					} as any)
					this.hasTurn = true
					
					// Add internal TURN (LAN) as fallback
					;(this.configuration.iceServers as RTCIceServer[]).push({
						urls: internalTurnUrls,
						username: turnUser,
						credential: turnPass,
					} as any)

					console.log(
						`[WebRTC] TURN: внешний + internal fallback (${this.internalTurnHostResolved})`,
					)
				}
			} else if (turnUser && turnPass) {
				// Only internal TURN if no external configured
				;(this.configuration.iceServers as RTCIceServer[]).push({
					urls: internalTurnUrls,
					username: turnUser,
					credential: turnPass,
				} as any)
				this.hasTurn = true
				console.log(
					`[WebRTC] Подключено к internal TURN (${this.internalTurnHostResolved})`,
				)
			}

			const useExternalTurn =
				turnRawList.length > 0 && Boolean(turnUser) && Boolean(turnPass)
			if (useExternalTurn && this.hasTurn) {
				queueMicrotask(() => {
					void this.testTurnAndFallback().then(() => {
						if (this.useInternalTurnOnly) {
							console.log(
								`[WebRTC] Подключено к internal TURN (${this.internalTurnHostResolved})`,
							)
						}
					})
				})
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
			// Use the browser's native audio processing (Discord-like).
			// Avoiding a custom Web Audio chain prevents latency, glitches and
			// the "robotic/choppy" sound users report.
			const audioConstraints = getDiscordLikeAudioConstraints()

			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: audioConstraints,
				video: false, // Только аудио для голосовых звонков
			})

			// Re-apply constraints on the captured audio track.
			const audioTrack = this.localStream.getAudioTracks()[0]
			if (audioTrack) {
				try {
					await audioTrack.applyConstraints(audioConstraints)
				} catch (e) {
					console.warn('Could not apply advanced audio constraints:', e)
				}
			}

			if (this.onLocalStream) {
				this.onLocalStream(this.localStream)
			}

			console.log('[WebRTC] Native audio capture enabled')
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

		// Full HD 60fps constraints for smooth, Discord-like screen sharing.
		// We request 60fps and high resolution; the browser will fall back
		// gracefully if the display/capture source cannot provide it.
		const videoConstraints: MediaTrackConstraints = {
			width: { ideal: 1920, max: 2560 },
			height: { ideal: 1080, max: 1440 },
			frameRate: { ideal: 60, max: 60 },
			cursor: 'always',
			displaySurface: 'monitor',
		}

		try {
			const stream = await navigator.mediaDevices.getDisplayMedia({
				video: videoConstraints,
				audio: true, // Capture system audio for screen share
			} as any)

			this.screenStream = stream
			this.isSharingScreen = true

			const track = stream.getVideoTracks()[0]
			if (track) {
				// Try to lock the best available resolution and framerate.
				try {
					await track.applyConstraints({
						width: { ideal: 1920 },
						height: { ideal: 1080 },
						frameRate: { ideal: 60 },
						advanced: [
							{ width: 1920, height: 1080, frameRate: 60 },
							{ width: 1920, height: 1080, frameRate: 30 },
							{ width: 1600, height: 900, frameRate: 60 },
							{ width: 1280, height: 720, frameRate: 60 },
						],
					} as any)
					
					// Log actual constraints applied
					const settings = track.getSettings()
					console.log('[WebRTC] Screen share settings:', {
						width: settings.width,
						height: settings.height,
						frameRate: settings.frameRate,
					})
				} catch (e) {
					console.warn('Failed to apply screen share constraints:', e)
				}

				track.onended = () => {
					console.log('[WebRTC] Screen share track ended by user')
					this.stopScreenShare().catch(() => {})
				}
			}

			this.notifyScreenShareState()
			return stream
		} catch (error: any) {
			console.error('[WebRTC] Screen share error:', error)
			if (error.name === 'NotAllowedError') {
				throw new Error('Демонстрация экрана отменена пользователем')
			}
			throw new Error('Ошибка при захвате экрана: ' + error.message)
		}
	}

	private isSocketKey(key: string): boolean {
		if (!key) return false
		if (/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(key)) {
			return false
		}
		if (key.length < 10) {
			return false
		}
		return /^[A-Za-z0-9_-]{10,45}$/.test(key)
	}

	private async applyBitrateConstraints(
		sender: RTCRtpSender,
		track: MediaStreamTrack,
	): Promise<void> {
		try {
			const params = sender.getParameters()
			if (!params.encodings || params.encodings.length === 0) {
				params.encodings = [{}]
			}
			if (track.kind === 'video') {
				if (this.isSharingScreen && this.screenStream?.getVideoTracks()[0] === track) {
					// Discord-like screen share: high resolution needs high bitrate.
					params.encodings[0].maxBitrate = 8_000_000
					params.encodings[0].degradationPreference = 'maintain-framerate'
					console.log('[WebRTC] Applied screen share bitrate limit: 8 Mbps')
				} else {
					// 720p/1080p camera quality.
					params.encodings[0].maxBitrate = 2_500_000
					params.encodings[0].degradationPreference = 'balanced'
					console.log('[WebRTC] Applied camera bitrate limit: 2.5 Mbps')
				}
			} else if (track.kind === 'audio') {
				// Discord-like voice quality (~128 kbps Opus).
				params.encodings[0].maxBitrate = 128_000
				console.log('[WebRTC] Applied audio bitrate limit: 128 kbps')
			}
			await sender.setParameters(params)
		} catch (e) {
			console.warn('[WebRTC] Failed to apply bitrate constraints:', e)
		}
	}

	async startScreenShare(): Promise<void> {
		const stream = await this.ensureScreenStream()
		const videoTrack = stream.getVideoTracks()[0]
		// Note: We do NOT capture system audio from screen share to avoid replacing microphone audio
		// Users will hear each other through microphone audio while screen sharing
		if (!videoTrack) return

		const tasks: Promise<void>[] = []
		for (const [socketId, pc] of this.peerConnections.entries()) {
			if (!this.isSocketKey(socketId)) continue

			// Check if we can renegotiate - must be in stable state
			if (pc.signalingState !== 'stable') {
				console.log(`[WebRTC] Cannot start screen share: PC for ${socketId} is in ${pc.signalingState}, waiting for stable state`)
				continue
			}

			// Replace/add video track with screen share
			let videoSender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (videoSender) {
				try {
					await videoSender.replaceTrack(videoTrack)
					console.log(`[WebRTC] Replaced video track with screen share for ${socketId}`)
				} catch (e) {
					console.error(`[WebRTC] Failed to replace video track for ${socketId}:`, e)
				}
			} else {
				try {
					videoSender = pc.addTrack(videoTrack, stream)
					console.log(`[WebRTC] Added screen share video track for ${socketId}`)
				} catch (e) {
					console.error(`[WebRTC] Failed to add video track for ${socketId}:`, e)
				}
			}
			if (videoSender) {
				void this.applyBitrateConstraints(videoSender, videoTrack)
			}

			// Keep microphone audio - do NOT replace with system audio
			// This ensures users can still talk while screen sharing

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
						console.log(`[WebRTC] Screen share offer sent to ${socketId}`)
					} catch (e) {
						console.error(`[WebRTC] Screen share offer failed for ${socketId}:`, e)
					}
				})(),
			)
		}
		await Promise.allSettled(tasks)
		console.log(`[WebRTC] Screen share started to ${tasks.length} peer(s)`)
		
		// Emit screen share state change to notify other participants
		this.socket.emit('screen_share_state_changed', {
			sender_socket_id: this.socket.id,
			is_sharing: true,
			user_id: this.userId
		})
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

			// Remove screen share video track
			const videoSender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (videoSender) {
				try {
					await videoSender.replaceTrack(null)
					console.log(`[WebRTC] Removed screen share track for ${socketId}`)
				} catch (e) {
					console.error(`[WebRTC] Failed to replace video track with null for ${socketId}:`, e)
				}
			}

			// Microphone audio was never replaced, so nothing to restore

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
						console.log(`[WebRTC] Screen share stop offer sent to ${socketId}`)
					} catch (e) {
						console.error(`[WebRTC] Stop screen share offer failed for ${socketId}:`, e)
					}
				})(),
			)
		}
		await Promise.allSettled(tasks)
		console.log(`[WebRTC] Screen share stopped for ${tasks.length} peer(s)`)
		
		// Emit screen share state change to notify other participants
		this.socket.emit('screen_share_state_changed', {
			sender_socket_id: this.socket.id,
			is_sharing: false,
			user_id: this.userId
		})
	}

	getScreenStream(): MediaStream | null {
		return this.screenStream
	}

	isScreenSharing(): boolean {
		return this.isSharingScreen
	}

	// Video methods
	private async ensureVideoStream(): Promise<MediaStream> {
		if (this.videoStream) {
			return this.videoStream
		}
		const mediaDevices =
			typeof navigator !== 'undefined' ? navigator.mediaDevices : null
		if (!mediaDevices || typeof mediaDevices.getUserMedia !== 'function') {
			throw new Error('Доступ к камере недоступен на этом устройстве')
		}

		// High-quality video constraints for camera
		const videoConstraints: MediaTrackConstraints = {
			width: { ideal: 1280, max: 1920 },
			height: { ideal: 720, max: 1080 },
			frameRate: { ideal: 30, max: 30 },
			facingMode: 'user',
		}

		try {
			const stream = await navigator.mediaDevices.getUserMedia({
				video: videoConstraints,
				audio: false,
			})

			this.videoStream = stream
			this.isVideoEnabled = true

			const track = stream.getVideoTracks()[0]
			if (track) {
				// Apply constraints for optimal quality
				try {
					await track.applyConstraints({
						width: { ideal: 1280 },
						height: { ideal: 720 },
						frameRate: { ideal: 30 },
					})
				} catch (e) {
					console.warn('Failed to apply video constraints:', e)
				}

				track.onended = () => {
					console.log('[WebRTC] Video track ended')
					this.stopVideo().catch(() => {})
				}
			}

			return stream
		} catch (error: any) {
			console.error('[WebRTC] Video error:', error)
			if (error.name === 'NotAllowedError') {
				throw new Error('Доступ к камере запрещён')
			} else if (error.name === 'NotFoundError') {
				throw new Error('Камера не найдена')
			}
			throw new Error('Ошибка доступа к камере: ' + error.message)
		}
	}

	async startVideo(): Promise<void> {
		const stream = await this.ensureVideoStream()
		const track = stream.getVideoTracks()[0]
		if (!track) return

		const tasks: Promise<void>[] = []
		for (const [socketId, pc] of this.peerConnections.entries()) {
			if (!this.isSocketKey(socketId)) continue

			// Check if we can renegotiate - must be in stable state
			if (pc.signalingState !== 'stable') {
				console.log(`[WebRTC] Cannot start video: PC for ${socketId} is in ${pc.signalingState}, waiting for stable state`)
				continue
			}

			let sender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (sender) {
				try {
					await sender.replaceTrack(track)
					console.log(`[WebRTC] Replaced video track with camera for ${socketId}`)
				} catch (e) {
					console.error(`[WebRTC] Failed to replace video track for ${socketId}:`, e)
				}
			} else {
				try {
					sender = pc.addTrack(track, stream)
					console.log(`[WebRTC] Added camera video track for ${socketId}`)
				} catch (e) {
					console.error(`[WebRTC] Failed to add video track for ${socketId}:`, e)
				}
			}
			if (sender) {
				void this.applyBitrateConstraints(sender, track)
			}

			tasks.push(
				(async () => {
					try {
						// Check state again before creating offer
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed, skipping video offer for ${socketId}`)
							return
						}
						const offer = await pc.createOffer()
						// Double-check state before setting local description
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed during offer creation, skipping video offer for ${socketId}`)
							return
						}
						await pc.setLocalDescription(offer)
						this.socket.emit('offer', {
							target_socket_id: socketId,
							offer,
							caller_user_id: this.userId,
						})
						console.log(`[WebRTC] Video offer sent to ${socketId}`)
					} catch (e) {
						console.error(`[WebRTC] Video offer failed for ${socketId}:`, e)
					}
				})(),
			)
		}
		await Promise.allSettled(tasks)

		// Notify video state change
		if (this.onVideoStateChange) {
			this.onVideoStateChange(this.videoStream, true)
		}

		// Emit video state change to other participants
		for (const [socketId] of this.peerConnections.entries()) {
			if (this.isSocketKey(socketId)) {
				this.socket.emit('video_state_changed', {
					sender_socket_id: socketId,
					has_video: true,
					user_id: this.userId
				});
			}
		}

		console.log(`[WebRTC] Video started to ${tasks.length} peer(s)`)
	}

	async stopVideo(): Promise<void> {
		this.isVideoEnabled = false

		const tasks: Promise<void>[] = []
		for (const [socketId, pc] of this.peerConnections.entries()) {
			if (!this.isSocketKey(socketId)) continue

			// Check if we can renegotiate - must be in stable state
			if (pc.signalingState !== 'stable') {
				console.log(`[WebRTC] Cannot stop video: PC for ${socketId} is in ${pc.signalingState}, waiting for stable state`)
				continue
			}

			const sender = pc.getSenders().find(s => s.track?.kind === 'video')
			if (sender) {
				try {
					await sender.replaceTrack(null)
					console.log(`[WebRTC] Removed camera video track for ${socketId}`)
				} catch (e) {
					console.error(`[WebRTC] Failed to replace video track with null for ${socketId}:`, e)
				}
			}

			tasks.push(
				(async () => {
					try {
						// Check state again before creating offer
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed, skipping stop video offer for ${socketId}`)
							return
						}
						const offer = await pc.createOffer()
						// Double-check state before setting local description
						if (pc.signalingState !== 'stable') {
							console.log(`[WebRTC] State changed during offer creation, skipping stop video offer for ${socketId}`)
							return
						}
						await pc.setLocalDescription(offer)
						this.socket.emit('offer', {
							target_socket_id: socketId,
							offer,
							caller_user_id: this.userId,
						})
						console.log(`[WebRTC] Video stop offer sent to ${socketId}`)
					} catch (e) {
						console.error(`[WebRTC] Stop video offer failed for ${socketId}:`, e)
					}
				})(),
			)
		}
		await Promise.allSettled(tasks)

		// Stop all video tracks
		if (this.videoStream) {
			this.videoStream.getVideoTracks().forEach(track => {
				track.stop()
			})
			this.videoStream = null
		}

		// Notify video state change
		if (this.onVideoStateChange) {
			this.onVideoStateChange(null, false)
		}

		// Emit video state change to other participants
		for (const [socketId] of this.peerConnections.entries()) {
			if (this.isSocketKey(socketId)) {
				this.socket.emit('video_state_changed', {
					sender_socket_id: socketId,
					has_video: false,
					user_id: this.userId
				});
			}
		}

		console.log(`[WebRTC] Video stopped for ${tasks.length} peer(s)`)
	}

	toggleVideo(): Promise<void> {
		if (this.isVideoEnabledState()) {
			return this.stopVideo()
		} else {
			return this.startVideo()
		}
	}

	getVideoStream(): MediaStream | null {
		return this.videoStream
	}

	isVideoEnabledState(): boolean {
		return this.isVideoEnabled
	}

	private setupPeerConnectionHandlers(
		pc: RTCPeerConnection,
		targetSocketId: string,
	) {
		// Обработка ICE кандидатов
		pc.onicecandidate = event => {
			if (event.candidate) {
				const isLikelySocketId = this.isSocketKey(targetSocketId)
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

			// Add the new track if not already present
			// Do NOT remove existing tracks - just add new ones
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

			// Debounce stream updates to prevent flickering
			const now = Date.now()
			const lastUpdate = (this as any)._lastStreamUpdate?.get(targetSocketId) || 0
			if (now - lastUpdate < 100) {
				// Skip if less than 100ms since last update
				return
			}
			(this as any)._lastStreamUpdate = (this as any)._lastStreamUpdate || new Map()
			;(this as any)._lastStreamUpdate.set(targetSocketId, now)

			const assign = () => {
				console.log(`[WebRTC] Assigning remote stream for ${targetSocketId}, tracks: ${stream?.getTracks().length}`)
				if (this.onRemoteStream) {
					this.onRemoteStream(targetSocketId, stream!)
				}
			}
			try {
				const track = event.track
				if (track) {
					// Use a timeout to prevent premature track removal during renegotiation
					let trackEndTimeout: any = null
					
					track.onended = () => {
						console.log(`[WebRTC] Remote ${track.kind} track ended for ${targetSocketId}, waiting 2s before removal...`)
						// Don't remove immediately - wait 2 seconds in case it's just renegotiation
						trackEndTimeout = setTimeout(() => {
							// Check if track is still in ended state
							if (track.readyState === 'ended') {
								console.log(`[WebRTC] Removing ended ${track.kind} track from stream for ${targetSocketId}`)
								try {
									if (stream && stream.getTracks().includes(track)) {
										stream.removeTrack(track)
										console.log(`[WebRTC] Removed ${track.kind} track from stream for ${targetSocketId}`)
									}
								} catch (e) {
									console.error(`[WebRTC] Could not remove ended track:`, e)
								}
								assign()
							} else {
								console.log(`[WebRTC] Track ${track.kind} recovered for ${targetSocketId}, not removing`)
							}
						}, 2000)
					}

					// Check for mute/unmute events - debounce these too
					let muteDebounceTimer: any = null
					if (typeof (track as any).onunmute !== 'undefined') {
						;(track as any).onunmute = () => {
							console.log(`[WebRTC] Remote ${track.kind} track unmuted for ${targetSocketId}`)
							// Clear pending removal if track comes back
							if (trackEndTimeout) {
								clearTimeout(trackEndTimeout)
								trackEndTimeout = null
							}
							clearTimeout(muteDebounceTimer)
							muteDebounceTimer = setTimeout(assign, 100)
						}
						;(track as any).onmute = () => {
							console.log(`[WebRTC] Remote ${track.kind} track muted for ${targetSocketId}`)
							clearTimeout(muteDebounceTimer)
							muteDebounceTimer = setTimeout(assign, 100)
						}
					}
				}
			} catch {}
			assign()
		}

		// Обработка изменения состояния соединения
		pc.onconnectionstatechange = () => {
			console.log(`[WebRTC] Connection state changed for ${targetSocketId}: ${pc.connectionState}`)
			console.log(`[WebRTC] ICE state: ${pc.iceConnectionState}, Signaling: ${pc.signalingState}`)
			
			if (this.onConnectionStateChange) {
				this.onConnectionStateChange(targetSocketId, pc.connectionState)
			}
			
			if (pc.connectionState === 'connected') {
				console.log(`[WebRTC] ✅ Connection ESTABLISHED for ${targetSocketId}`)
				// Sync remote stream tracks with current receivers
				this.syncRemoteStreamTracks(targetSocketId);
			} else if (pc.connectionState === 'failed') {
				console.error(`[WebRTC] ❌ Connection FAILED for ${targetSocketId}`)
				console.error(`[WebRTC] ICE: ${pc.iceConnectionState}, Signaling: ${pc.signalingState}`)
				console.error(`[WebRTC] Local candidates: ${pc.localDescription ? JSON.parse(pc.localDescription).candidates?.length || 0 : 0}`)
				
				// Try ICE restart
				console.log(`[WebRTC] Attempting ICE restart for ${targetSocketId}`)
				this.attemptIceRestart(targetSocketId).catch(e =>
					console.error('[WebRTC] ICE restart failed:', e)
				)
			} else if (pc.connectionState === 'disconnected') {
				console.warn(`[WebRTC] ⚠️ Connection DISCONNECTED for ${targetSocketId}. Will attempt reconnect...`)
			}
		}
		
		// Handle signaling state changes which might occur when tracks are added/removed
		pc.onsignalingstatechange = () => {
			console.log(`[WebRTC] Signaling state changed for ${targetSocketId}: ${pc.signalingState}`)
			// Only sync tracks when transitioning to stable state after being connected
			// This prevents unnecessary track manipulation during renegotiation
			if (pc.signalingState === 'stable' && pc.connectionState === 'connected') {
				this.syncRemoteStreamTracks(targetSocketId);
			}
		}

		try {
			;(pc as any).oniceconnectionstatechange = () => {
				console.log(`[WebRTC] ICE connection state changed for ${targetSocketId}: ${pc.iceConnectionState}`)
				if (this.onConnectionStateChange) {
					this.onConnectionStateChange(targetSocketId, pc.connectionState)
				}

				// Clear any existing timeout
				const existingTimeout = this.iceDisconnectTimeouts.get(targetSocketId)
				if (existingTimeout) {
					clearTimeout(existingTimeout)
					this.iceDisconnectTimeouts.delete(targetSocketId)
				}

				// Handle ICE failures with restart
				if (pc.iceConnectionState === 'failed') {
					console.log(`[WebRTC] ICE failed for ${targetSocketId}, attempting ICE restart`)
					this.attemptIceRestart(targetSocketId).catch(e =>
						console.error('ICE restart failed:', e)
					)
				}

				// If disconnected, wait a bit then restart ICE if still disconnected
				if (pc.iceConnectionState === 'disconnected') {
					console.log(`[WebRTC] ICE disconnected for ${targetSocketId}, waiting for reconnection...`)
					const timeout = setTimeout(() => {
						if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
							console.log(`[WebRTC] ICE still disconnected for ${targetSocketId}, attempting ICE restart`)
							this.attemptIceRestart(targetSocketId).catch(e =>
								console.error('ICE restart failed:', e)
							)
						}
					}, 3000) // Wait 3 seconds before attempting restart
					this.iceDisconnectTimeouts.set(targetSocketId, timeout)
				}

				// Clear timeout on connected/checking
				if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'checking') {
					this.iceDisconnectTimeouts.delete(targetSocketId)
				}
			}
		} catch {}
	}

	private createPeerConnectionWithPolicy(
		targetSocketId: string,
		policy: 'all' | 'relay' = 'all',
	): RTCPeerConnection {
		// Use internal TURN only if external failed
		let iceServers = this.configuration.iceServers

		if (this.useInternalTurnOnly) {
			// Только internal TURN (LAN)
			iceServers = this.configuration.iceServers.filter(server => {
				const urls = Array.isArray(server.urls) ? server.urls : [server.urls]
				return urls.some(url =>
					String(url).includes(this.internalTurnHostResolved),
				)
			})
			console.log(
				`[WebRTC] Используется только internal TURN (${this.internalTurnHostResolved})`,
			)
		}

		const baseConfig: any = { iceServers }
		if (policy === 'relay') baseConfig.iceTransportPolicy = 'relay'
		const pc = new RTCPeerConnection(baseConfig)

		// Add local AUDIO stream tracks (microphone)
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => {
				const sender = pc.addTrack(track, this.localStream!)
				void this.applyBitrateConstraints(sender, track)
			})
			console.log(`[WebRTC] Added local audio track to new PC for ${targetSocketId}`)
		}

		// Add video track if camera is active (NOT screen share - that's started explicitly)
		if (this.videoStream) {
			const videoTrack = this.videoStream.getVideoTracks()[0]
			if (videoTrack) {
				const sender = pc.addTrack(videoTrack, this.videoStream)
				void this.applyBitrateConstraints(sender, videoTrack)
				console.log(`[WebRTC] Added camera video track to new PC for ${targetSocketId}`)
			}
		}

		// NOTE: Screen share is NOT added automatically - it must be started explicitly via startScreenShare()
		// This prevents screen share from interfering with call establishment

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
				offer: {
					sdp: offer.sdp,
					type: offer.type,
				},
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
			if (existingPc.signalingState === 'stable') {
				console.log(`[WebRTC] Existing PC in stable state for ${callerSocketId}, handling as renegotiation`)
				return this.handleRenegotiationOffer(callerSocketId, offer)
			}
			if (existingPc.signalingState === 'have-remote-offer') {
				console.log(`[WebRTC] Already have remote offer for ${callerSocketId}, skipping duplicate`)
				return
			}
			console.log(`[WebRTC] Cannot handle incoming call: existing PC state is ${existingPc.signalingState}`)
			return
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
				answer: {
					sdp: answer.sdp,
					type: answer.type,
				},
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
				throw new Error(`Cannot accept call: PC state is ${pc.signalingState}, expected 'have-remote-offer'`)
			}

			// Создаем answer
			const answer = await pc.createAnswer()
			// Double-check state again before setting local description
			if (pc.signalingState !== 'have-remote-offer') {
				throw new Error(`State changed during answer creation for ${callerSocketId}: ${pc.signalingState}`)
			}
			await pc.setLocalDescription(answer)
			console.log('Answer created and set as local description')

			const serializedAnswer = {
				sdp: answer.sdp,
				type: answer.type,
			}

			// Отправляем сигнал о принятии звонка + SDP в одном событии (для мобильного клиента)
			this.socket.emit('call_answer', { caller_socket_id: callerSocketId, answer: serializedAnswer })

			// Также отправляем SDP answer через стандартный 'answer' event (для веб клиентов)
			const answerPayload = {
				target_socket_id: callerSocketId,
				answer: serializedAnswer,
			}

			console.log(
				'DEBUG: Emitting answer payload:',
				JSON.stringify(answerPayload, null, 2),
			)
			this.socket.emit('answer', answerPayload)
		} catch (error) {
			console.error('Failed to accept call:', error)
			// Handle failed ICE negotiation by forcing internal TURN and renegotiation
			if (this.hasTurn) {
					console.log(
						`[WebRTC] Accept call failed, переключение на internal TURN (${this.internalTurnHostResolved}) для ${callerSocketId}`,
					)
				this.useInternalTurnOnly = true
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
			// For group calls, we also accept answers in 'stable' state
			if (currentState !== 'have-local-offer' && currentState !== 'stable') {
				console.log(`[WebRTC] Skipping answer from ${data.sender_socket_id}: connection state is ${currentState}, expected 'have-local-offer' or 'stable'`)
				return
			}

			// If in stable state, we need to create a new offer first (renegotiation)
			if (currentState === 'stable') {
				console.log(`[WebRTC] PC is in stable state, renegotiating for ${data.sender_socket_id}`)
				// Skip this answer as we need to renegotiate
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
									console.log(
										`[WebRTC] No audio receiver, internal TURN (${this.internalTurnHostResolved}) для ${data.sender_socket_id}`,
									)
									this.useInternalTurnOnly = true
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
						if (current && current.connectionState === 'failed') {
							console.log(
								`[WebRTC] Connection failed, attempting TURN relay fallback for ${data.sender_socket_id}`,
							)
							console.log(
								`[WebRTC] Connection failed, internal TURN (${this.internalTurnHostResolved}) для ${data.sender_socket_id}`,
							)
							this.useInternalTurnOnly = true
							this.renegotiateWithRelay(data.sender_socket_id).catch(err =>
								console.error('Relay fallback failed:', err),
							)
						} else if (current) {
							console.log(`[WebRTC] Connection state after answer: ${current.connectionState}, ICE: ${(current as any).iceConnectionState}`)
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
			// Check if the connection is ready to accept ICE candidates
			// Only add ICE candidate if we have a remote description set
			if (pc.remoteDescription && pc.remoteDescription.type) {
				// Check connection state to ensure it's appropriate to add ICE candidates
				if (pc.signalingState === 'stable' || pc.signalingState === 'have-remote-offer' || pc.signalingState === 'have-local-pranswer') {
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
						`Buffering ICE candidate for ${data.sender_socket_id} - PC state is ${pc.signalingState}`,
					)
					const queue = this.incomingIceQueue.get(data.sender_socket_id) || []
					queue.push(data.candidate)
					this.incomingIceQueue.set(data.sender_socket_id, queue)
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

	/**
	 * Synchronize remote stream tracks with the current receivers for a given peer connection
	 */
	private syncRemoteStreamTracks(targetSocketId: string) {
		const pc = this.peerConnections.get(targetSocketId);
		if (!pc) return;

		let stream = this.remoteStreams.get(targetSocketId);
		if (!stream) {
			stream = new MediaStream();
			this.remoteStreams.set(targetSocketId, stream);
		}

		try {
			const receivers = pc.getReceivers() || [];
			const existingTracks = stream.getTracks();

			// Add any new tracks from receivers
			receivers.forEach(receiver => {
				if (receiver.track) {
					const trackExists = existingTracks.some(t =>
						t.id === receiver.track.id && t.kind === receiver.track.kind && t.readyState === receiver.track.readyState
					);
					if (!trackExists) {
						// Simply add the new track - do NOT remove existing tracks
						// Removing tracks causes audio disruption
						console.log(`[WebRTC] Adding ${receiver.track.kind} track to remote stream for ${targetSocketId}`);
						stream!.addTrack(receiver.track);
					}
				}
			});

			// Update UI with the updated stream
			if (this.onRemoteStream) {
				this.onRemoteStream(targetSocketId, stream);
			}
		} catch (e) {
			console.error('[WebRTC] Error syncing remote stream tracks:', e);
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
				// Only process buffered candidates if the connection is in a valid state
				if (pc.remoteDescription && pc.remoteDescription.type && 
					(pc.signalingState === 'stable' || pc.signalingState === 'have-remote-offer' || pc.signalingState === 'have-local-pranswer')) {
					for (const candidate of queue) {
						try {
							await pc.addIceCandidate(new RTCIceCandidate(candidate))
						} catch (e) {
							console.error('Error adding buffered ICE candidate:', e)
						}
					}
				} else {
					console.log(
						`Cannot process buffered candidates for ${socketId} - PC state is ${pc.signalingState}`,
					)
					// Keep candidates in queue for later processing when state is appropriate
					return
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
		
		// Stop screen share and video before cleaning up
		this.stopScreenShare().catch(() => {})
		this.stopVideo().catch(() => {})
		
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

		// Check if we're in a stable state to send a new offer
		// Both offerer and answerer can initiate ICE restart by creating a new offer
		if (pc.signalingState === 'stable' || pc.signalingState === 'have-local-offer') {
			console.log(`[WebRTC] Restarting ICE for ${targetSocketId}`)
			try {
				const offer = await pc.createOffer({ iceRestart: true })
				await pc.setLocalDescription(offer)
				this.socket.emit('offer', {
					target_socket_id: targetSocketId,
					offer,
				})
				console.log(`[WebRTC] ICE restart offer sent to ${targetSocketId}`)
			} catch (e: any) {
				console.error('[WebRTC] ICE restart failed:', e)
				// Fall back to full reconnect with internal TURN only
				if (this.hasTurn) {
					console.log(
						`[WebRTC] ICE restart failed, internal TURN (${this.internalTurnHostResolved}) для ${targetSocketId}`,
					)
					this.useInternalTurnOnly = true
					await this.renegotiateWithRelay(targetSocketId)
				}
			}
		} else {
			console.log(`[WebRTC] Cannot restart ICE in signaling state: ${pc.signalingState}, waiting for stable state`)
		}
	}

	public cleanupCall(socketId: string) {
		// Clear ICE disconnect timeout
		const existingTimeout = this.iceDisconnectTimeouts.get(socketId)
		if (existingTimeout) {
			clearTimeout(existingTimeout)
			this.iceDisconnectTimeouts.delete(socketId)
		}

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

		// If this is the last connection, stop screen share and video
		if (this.peerConnections.size === 0) {
			this.stopScreenShare().catch(() => {})
			this.stopVideo().catch(() => {})
		}
	}

	endAllCalls(): void {
		for (const socketId of this.peerConnections.keys()) {
			this.socket.emit('call_end', { target_socket_id: socketId })
			this.cleanupCall(socketId)
		}
	}

	/**
	 * Проверка внешнего TURN; при сбое — только internal (LAN).
	 */
	async testTurnAndFallback(): Promise<void> {
		if (this.turnTested) {
			return
		}

		this.turnTested = true

		// Skip if no TURN configured or already using internal
		if (!this.hasTurn || this.useInternalTurnOnly) {
			return
		}

		console.log('[WebRTC] Проверка внешнего TURN (relay)…')

		// Create test peer connection
		const testPc = new RTCPeerConnection({
			iceServers: this.configuration.iceServers,
			iceTransportPolicy: 'relay',
		})

		return new Promise((resolve) => {
			let resolved = false
			let relayGathered = false

			const cleanup = () => {
				resolved = true
				testPc.onicecandidate = null
				testPc.close()
			}

			testPc.onicecandidate = event => {
				if (resolved) return
				if (event.candidate) {
					console.log('[WebRTC] TURN candidate gathered:', event.candidate.candidate)
					if (event.candidate.candidate.includes('typ relay')) {
						relayGathered = true
						cleanup()
						console.log('[WebRTC] Внешний TURN доступен (получен relay-кандидат)')
						resolve()
					}
				} else {
					// End of candidate gathering
					if (!relayGathered && !resolved) {
						cleanup()
						console.warn(
							`[WebRTC] Внешний TURN недоступен (нет relay-кандидатов), переключение на internal (${this.internalTurnHostResolved})`,
						)
						this.useInternalTurnOnly = true
						resolve()
					}
				}
			}

			// Add dummy track and create offer to trigger ICE candidate gathering
			try {
				testPc.addTransceiver('audio')
				testPc.createOffer()
					.then(offer => testPc.setLocalDescription(offer))
					.catch(err => {
						console.error('[WebRTC] Error during TURN test offer:', err)
					})
			} catch (e) {
				console.error('[WebRTC] Error starting ICE test:', e)
			}

			// If no relay candidate after 3 seconds, fallback to internal TURN
			setTimeout(() => {
				if (!resolved) {
					cleanup()
					console.warn(
						`[WebRTC] Таймаут TURN (3с), переключение на internal (${this.internalTurnHostResolved})`,
					)
					this.useInternalTurnOnly = true
					resolve()
				}
			}, 3000)
		})
	}

	/**
	 * Принудительно только internal TURN.
	 */
	forceInternalTurn(): void {
		this.useInternalTurnOnly = true
		console.log(
			`[WebRTC] Принудительно internal TURN (${this.internalTurnHostResolved})`,
		)
		
		// Recreate all peer connections
		const oldConnections = Array.from(this.peerConnections.entries())
		oldConnections.forEach(([socketId, oldPc]) => {
			oldPc.close()
			this.peerConnections.delete(socketId)
			this.createPeerConnection(socketId)
		})
	}

	/**
	 * Check if using internal TURN only
	 */
	isUsingInternalTurn(): boolean {
		return this.useInternalTurnOnly
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

		// Clear all ICE disconnect timeouts
		this.iceDisconnectTimeouts.forEach(timeout => clearTimeout(timeout))
		this.iceDisconnectTimeouts.clear()

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

	// Audio Processing Controls (kept for API compatibility, now no-ops because
	// we rely on the browser's native processing for the cleanest Discord-like
	// audio and to avoid choppy output from a custom Web Audio chain).
	setNoiseSuppression(_level: number) {
		console.log('[WebRTC] Native noise suppression is used; setNoiseSuppression is a no-op')
	}

	setGain(_db: number) {
		console.log('[WebRTC] Native gain control is used; setGain is a no-op')
	}

	setEchoCancellation(_enabled: boolean) {
		console.log('[WebRTC] Native echo cancellation is used; setEchoCancellation is a no-op')
	}

	setAutoGainControl(_enabled: boolean) {
		console.log('[WebRTC] Native AGC is used; setAutoGainControl is a no-op')
	}

	async suspendAudioProcessing() {
		// no-op
	}

	async resumeAudioProcessing() {
		// no-op
	}

	getAudioProcessor(): null {
		return null
	}
}
