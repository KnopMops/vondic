import { Socket } from 'socket.io-client'
import { CallState, WebRTCService } from './WebRTCService'

export { CallState } from './WebRTCService'

export interface CallRecord {
	id: string
	callerId: string
	callerName: string
	receiverId: string
	receiverName: string
	type: 'incoming' | 'outgoing' | 'missed'
	duration: number
	startTime: Date
	endTime: Date
	status: 'completed' | 'missed' | 'rejected'
}

export class CallManager {
	private webRTCService: WebRTCService
	private socket: Socket
	private currentCalls: Map<string, CallState> = new Map()
	private callHistory: CallRecord[] = []
	private incomingCall: CallState | null = null
	private activeGroupCallId: string | null = null
	private currentUser: { id: string; name: string; avatar?: string } | null =
		null

	// Callbacks
	public onIncomingCall?: (call: CallState) => void
	public onCallAccepted?: (call: CallState, oldSocketId?: string) => void
	public onCallRejected?: (call: CallState, reason?: string) => void
	public onCallEnded?: (call: CallState) => void
	public onCallFailed?: (call: CallState, error: string) => void
	public onCallStateChange?: (socketId: string, state: CallState) => void
	public onRemoteStream?: (socketId: string, stream: MediaStream) => void
	public onGroupCallIdChange?: (groupId: string | null) => void

	constructor(webRTCService: WebRTCService, socket: Socket) {
		this.webRTCService = webRTCService
		this.socket = socket
		this.setupSocketListeners()
		this.setupWebRTCCallbacks()
	}

	public setCurrentUser(user: { id: string; name: string; avatar?: string }) {
		this.currentUser = user
	}

	private setupSocketListeners(): void {
		// --- Group Call Listeners ---
		this.socket.on('group_call_started', (data: any) => {
			console.log('Group call started:', data)
			this.activeGroupCallId = data.call_id
			if (this.onGroupCallIdChange) this.onGroupCallIdChange(data.call_id)
		})

		this.socket.on('incoming_group_call', (data: any) => {
			console.log('Incoming group call:', data)
			const callState: CallState = {
				socketId: '',
				userId: data.group_id,
				userName: `Групповой звонок`,
				avatarUrl: data.caller_avatar_url,
				status: 'ringing',
				startTime: new Date(),
				isGroupCall: true,
				groupId: data.group_id,
				callId: data.call_id,
			}
			this.incomingCall = callState
			if (this.onIncomingCall) this.onIncomingCall(callState)
		})

		this.socket.on('group_call_participant_joined', async (data: any) => {
			console.log('Participant joined group call:', data)
			const { call_id, user_id, socket_id } = data

			if (this.activeGroupCallId !== call_id) return
			if (socket_id === this.socket.id) return

			const mySocketId = this.socket.id
			const iCreateOffer = mySocketId < socket_id

			if (iCreateOffer) {
				console.log(`I (${mySocketId}) am creating offer for ${socket_id}`)
				const pc = await this.webRTCService.ensureLocalAudioSender(socket_id)
				const offer = await pc.createOffer()
				await pc.setLocalDescription(offer)

				this.socket.emit('offer', {
					target_socket_id: socket_id,
					offer: offer,
					caller_user_id: this.currentUser?.id,
					caller_username: this.currentUser?.name,
					caller_avatar_url: this.currentUser?.avatar,
				})
			} else {
				console.log(`I (${mySocketId}) am waiting for offer from ${socket_id}`)
				await this.webRTCService.ensureLocalAudioSender(socket_id)
			}

			const callState: CallState = {
				socketId: socket_id,
				userId: user_id,
				status: 'connected',
				startTime: new Date(),
				isGroupCall: true,
				callId: call_id,
			}
			this.currentCalls.set(socket_id, callState)
			this.updateCallState(socket_id, callState)
		})

		this.socket.on('group_call_accepted', (data: any) => {
			console.log('Group call accepted:', data)
			// This might be confirmation for me joining, or someone else accepting?
			// If it's for me, I might not need to do anything as I already set activeGroupCallId
		})

		this.socket.on('group_call_rejected', (data: any) => {
			console.log('Group call rejected:', data)
			// Handle rejection (e.g. if I tried to join but was rejected)
			if (data.call_id === this.activeGroupCallId) {
				this.leaveGroupCall(data.call_id)
			}
		})

		this.socket.on('group_call_ended', (data: any) => {
			const { call_id } = data
			if (this.activeGroupCallId === call_id) {
				console.log('Group call ended')
				this.activeGroupCallId = null
				if (this.onGroupCallIdChange) this.onGroupCallIdChange(null)
				this.webRTCService.peerConnections.forEach(pc => pc.close())
				this.webRTCService.peerConnections.clear()
				this.currentCalls.clear()
				if (this.onCallEnded)
					this.onCallEnded({
						socketId: '',
						userId: '',
						status: 'ended',
						isGroupCall: true,
						callId: call_id,
					})
			}
		})

		// --- Voice Channel Call Listeners (Persistent) ---
		this.socket.on('voice_channel_participant_joined', async (data: any) => {
			console.log('Voice channel participant joined:', data)
			const { channel_id, user_id, socket_id } = data
			if (!channel_id || !socket_id) return
			if (socket_id === this.socket.id) return

			// Decide offer side deterministically
			const mySocketId = this.socket.id
			const iCreateOffer = mySocketId < socket_id

			if (iCreateOffer) {
				const pc = await this.webRTCService.ensureLocalAudioSender(socket_id)
				const offer = await pc.createOffer()
				await pc.setLocalDescription(offer)
				this.socket.emit('offer', {
					target_socket_id: socket_id,
					offer,
					caller_user_id: this.currentUser?.id,
					caller_username: this.currentUser?.name,
					caller_avatar_url: this.currentUser?.avatar,
				})
			} else {
				await this.webRTCService.ensureLocalAudioSender(socket_id)
			}

			const callState: CallState = {
				socketId: socket_id,
				userId: user_id,
				status: 'connected',
				startTime: new Date(),
				isGroupCall: true,
				callId: channel_id,
			}
			this.currentCalls.set(socket_id, callState)
			this.updateCallState(socket_id, callState)
		})

		this.socket.on('voice_channel_participant_left', (data: any) => {
			const { channel_id, socket_id } = data
			if (!channel_id || !socket_id) return
			this.handleCallEnded(socket_id)
		})

		// Входящий звонок
		this.socket.on('incoming_call', (...args: any[]) => {
			console.log(
				'DEBUG: incoming_call raw args:',
				JSON.stringify(args, null, 2),
			)
			let from_socket_id: string | undefined
			let offer: RTCSessionDescriptionInit | undefined
			let caller_user_id: string | undefined
			let caller_username: string | undefined
			let caller_avatar_url: string | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				// Handle both naming conventions
				from_socket_id = firstArg.from_socket_id || firstArg.caller_socket_id

				// Caller identity (new server fields)
				caller_user_id = firstArg.caller_user_id
				caller_username = firstArg.caller_username
				caller_avatar_url = firstArg.caller_avatar_url

				// Strategy 1: Standard offer object
				if (firstArg.offer) {
					offer = firstArg.offer
				}
				// Strategy 2: Parse offer_json string
				else if (firstArg.offer_json) {
					try {
						offer = JSON.parse(firstArg.offer_json)
						console.log('Successfully parsed offer from offer_json')
					} catch (e) {
						console.error('Failed to parse offer_json:', e)
					}
				}
				// Strategy 3: Construct from flat properties
				else if (firstArg.sdp && firstArg.type) {
					offer = {
						sdp: firstArg.sdp,
						type: firstArg.type as RTCSdpType,
					}
					console.log('Constructed offer from flat sdp/type properties')
				}
				// Strategy 4: Nested payload/data
				else if (firstArg.payload?.offer) {
					offer = firstArg.payload.offer
				} else if (firstArg.data?.offer) {
					offer = firstArg.data.offer
				}
			} else if (args.length >= 2) {
				// Assume (socketId, offer) signature
				if (typeof args[0] === 'string') from_socket_id = args[0]
				if (typeof args[1] === 'object') offer = args[1]

				// Caller identity (new server fields)
				caller_user_id = firstArg.caller_user_id
				caller_username = firstArg.caller_username
				caller_avatar_url = firstArg.caller_avatar_url
			}

			if (from_socket_id && offer) {
				this.handleIncomingCall(from_socket_id, offer, {
					userId: caller_user_id,
					userName: caller_username,
					avatarUrl: caller_avatar_url,
				})
			} else {
				console.error(
					'Invalid incoming_call data structure - missing offer or socket_id:',
					args,
				)
				if (from_socket_id && !offer) {
					// Request offer from caller for backward compatibility
					console.log('Requesting offer from caller via request_offer')
					this.socket.emit('request_offer', {
						target_socket_id: from_socket_id,
					})

					// Prepare incoming call state so UI can show identity immediately
					const callState: CallState = {
						socketId: from_socket_id,
						userId: caller_user_id || from_socket_id,
						userName: caller_username || 'Неизвестный пользователь',
						avatarUrl: caller_avatar_url,
						status: 'ringing',
						startTime: new Date(),
					}
					this.incomingCall = callState
					this.currentCalls.set(from_socket_id, callState)
					if (this.onIncomingCall) this.onIncomingCall(callState)
				}
			}
		})

		// Звонок принят (Initiator receives call_accepted)
		this.socket.on('call_accepted', (...args: any[]) => {
			console.log(
				'DEBUG: call_accepted raw args:',
				JSON.stringify(args, null, 2),
			)
			let responder_socket_id: string | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				responder_socket_id = firstArg.responder_socket_id
			} else if (args.length >= 1 && typeof args[0] === 'string') {
				// Fallback if server sends just ID string
				responder_socket_id = args[0]
			}

			if (responder_socket_id) {
				// For call_accepted, we might not get the answer SDP immediately if it comes in a separate 'answer' event
				// The prompt says: "Initiator: call_accepted (contains responder_socket_id) -> ... const pc = this.createPC(responder_socket_id)..."
				// And then "this.socket.on('answer', ...)"

				// However, my handleCallAccepted logic expects an answer to setRemoteDescription.
				// If call_accepted doesn't have the answer, we should just map the call and wait for 'answer' event.
				// OR, we can try to migrate the PC here.

				this.handleCallAcceptedSignal(responder_socket_id)
			} else {
				console.error('Invalid call_accepted data structure:', args)
			}
		})

		// Ответ SDP (Initiator receives answer)
		this.socket.on('answer', (...args: any[]) => {
			console.log('DEBUG: answer raw args:', JSON.stringify(args, null, 2))
			let sender_socket_id: string | undefined
			let answer: RTCSessionDescriptionInit | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				sender_socket_id =
					firstArg.sender_socket_id ||
					firstArg.from_socket_id ||
					firstArg.responder_socket_id ||
					firstArg.target_socket_id
				answer = firstArg.answer
			}

			if (sender_socket_id && sender_socket_id === this.socket.id) {
				sender_socket_id = undefined
			}

			if (sender_socket_id && answer) {
				this.webRTCService.handleAnswer({
					sender_socket_id: sender_socket_id,
					answer: answer,
				})
				// Ensure UI mapping even if server doesn't send call_accepted
				this.handleCallAcceptedSignal(sender_socket_id)
			}
		})

		// Дополнительное событие offer для совместимости
		this.socket.on('offer', (...args: any[]) => {
			let from_socket_id: string | undefined
			let offer: RTCSessionDescriptionInit | undefined
			let caller_user_id: string | undefined
			let caller_username: string | undefined
			let caller_avatar_url: string | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				from_socket_id =
					firstArg.from_socket_id ||
					firstArg.caller_socket_id ||
					firstArg.sender_socket_id

				caller_user_id = firstArg.caller_user_id
				caller_username = firstArg.caller_username
				caller_avatar_url = firstArg.caller_avatar_url

				if (firstArg.offer) {
					offer = firstArg.offer
				} else if (firstArg.offer_json) {
					try {
						offer = JSON.parse(firstArg.offer_json)
					} catch {}
				} else if (firstArg.sdp && firstArg.type) {
					offer = { sdp: firstArg.sdp, type: firstArg.type as RTCSdpType }
				} else if (firstArg.payload?.offer) {
					offer = firstArg.payload.offer
				} else if (firstArg.data?.offer) {
					offer = firstArg.data.offer
				}
			} else if (args.length >= 2) {
				if (typeof args[0] === 'string') from_socket_id = args[0]
				if (typeof args[1] === 'object') offer = args[1]
			}
			if (from_socket_id && offer) {
				if (this.currentCalls.has(from_socket_id)) {
					// Renegotiation on existing call: auto-accept without modal
					this.webRTCService
						.handleRenegotiationOffer(from_socket_id, offer)
						.catch(e => console.error('Renegotiation failed:', e))
				} else {
					this.handleIncomingCall(from_socket_id, offer, {
						userId: caller_user_id,
						userName: caller_username,
						avatarUrl: caller_avatar_url,
					})
				}
			}
		})

		// Звонок завершен
		this.socket.on('call_end', (...args: any[]) => {
			console.log('DEBUG: call_end raw args:', JSON.stringify(args, null, 2))
			let from_socket_id: string | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				from_socket_id =
					firstArg.from_socket_id ||
					firstArg.caller_socket_id ||
					firstArg.sender_socket_id ||
					firstArg.responder_socket_id ||
					firstArg.target_socket_id
			} else if (args.length >= 1 && typeof args[0] === 'string') {
				from_socket_id = args[0]
			}

			if (from_socket_id) {
				this.handleCallEnded(from_socket_id)
			} else {
				console.error('Invalid call_end data structure:', args)
			}
		})

		// Compatibility: some servers emit 'call_ended' instead of 'call_end'
		this.socket.on('call_ended', (...args: any[]) => {
			console.log('DEBUG: call_ended raw args:', JSON.stringify(args, null, 2))
			let from_socket_id: string | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				from_socket_id =
					firstArg.from_socket_id ||
					firstArg.caller_socket_id ||
					firstArg.sender_socket_id ||
					firstArg.responder_socket_id ||
					firstArg.target_socket_id
			} else if (args.length >= 1 && typeof args[0] === 'string') {
				from_socket_id = args[0]
			}

			if (from_socket_id) {
				this.handleCallEnded(from_socket_id)
			} else {
				console.error('Invalid call_ended data structure:', args)
			}
		})

		// Звонок отклонен
		this.socket.on('call_reject', (...args: any[]) => {
			console.log('DEBUG: call_reject raw args:', JSON.stringify(args, null, 2))
			let from_socket_id: string | undefined
			let reason: string | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				from_socket_id =
					firstArg.from_socket_id ||
					firstArg.caller_socket_id ||
					firstArg.sender_socket_id ||
					firstArg.responder_socket_id ||
					firstArg.target_socket_id
				reason = firstArg.reason
			} else if (args.length >= 1 && typeof args[0] === 'string') {
				from_socket_id = args[0]
			}

			if (from_socket_id) {
				this.handleCallRejected(from_socket_id, reason)
			} else {
				console.error('Invalid call_reject data structure:', args)
			}
		})

		// Compatibility: some servers emit 'call_rejected' instead of 'call_reject'
		this.socket.on('call_rejected', (...args: any[]) => {
			console.log(
				'DEBUG: call_rejected raw args:',
				JSON.stringify(args, null, 2),
			)
			let from_socket_id: string | undefined
			let reason: string | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				from_socket_id =
					firstArg.from_socket_id ||
					firstArg.caller_socket_id ||
					firstArg.sender_socket_id ||
					firstArg.responder_socket_id ||
					firstArg.target_socket_id
				reason = firstArg.reason
			} else if (args.length >= 1 && typeof args[0] === 'string') {
				from_socket_id = args[0]
			}

			if (from_socket_id) {
				this.handleCallRejected(from_socket_id, reason)
			} else {
				console.error('Invalid call_rejected data structure:', args)
			}
		})

		// Ошибка звонка
		this.socket.on('error', (data: { message?: string }) => {
			const message = typeof data?.message === 'string' ? data.message : ''
			const hasActiveCall =
				this.currentCalls.size > 0 ||
				!!this.incomingCall ||
				!!this.activeGroupCallId
			if (!hasActiveCall) return
			if (/attachments must be a list/i.test(message)) return
			this.handleCallFailed(message || 'Unknown error')
		})

		this.socket.on('call_failed', (data: { message?: string }) => {
			const message = typeof data?.message === 'string' ? data.message : ''
			this.handleCallFailed(message || 'Unknown error')
		})

		// ICE кандидаты
		this.socket.on('ice_candidate', (...args: any[]) => {
			// console.log('Received ICE candidate args:', args)
			let from_socket_id: string | undefined
			let candidate: RTCIceCandidateInit | undefined

			const firstArg = args[0]
			if (typeof firstArg === 'object' && firstArg !== null) {
				from_socket_id =
					firstArg.from_socket_id ||
					firstArg.caller_socket_id ||
					firstArg.sender_socket_id
				candidate = firstArg.candidate
			} else if (args.length >= 2) {
				if (typeof args[0] === 'string') from_socket_id = args[0]
				if (typeof args[1] === 'object') candidate = args[1]
			}

			if (from_socket_id && candidate) {
				console.log('Received ICE candidate from:', from_socket_id)
				this.webRTCService.handleIceCandidate({
					sender_socket_id: from_socket_id,
					candidate: candidate,
				})
			} else {
				console.error('Invalid ice_candidate data structure:', args)
			}
		})
	}

	private setupWebRTCCallbacks(): void {
		this.webRTCService.onRemoteStream = (
			socketId: string,
			stream: MediaStream,
		) => {
			const call = this.currentCalls.get(socketId)
			if (call) {
				call.status = 'connected'
				call.startTime = new Date()
				this.updateCallState(socketId, call)
			}
			if (this.onRemoteStream) {
				this.onRemoteStream(socketId, stream)
			}
		}

		this.webRTCService.onConnectionStateChange = (
			socketId: string,
			state: RTCPeerConnectionState,
		) => {
			const call = this.currentCalls.get(socketId)
			if (call) {
				if (
					state === 'disconnected' ||
					state === 'failed' ||
					state === 'closed'
				) {
					this.handleCallEnded(socketId)
				}
			}
		}
	}

	async initiateGroupCall(groupId: string): Promise<void> {
		try {
			await this.webRTCService.initializeLocalStream()
			this.socket.emit('call_group', { group_id: groupId })
			console.log('Initiated group call for group:', groupId)
		} catch (error) {
			console.error('Failed to initiate group call:', error)
			throw error
		}
	}

	async joinVoiceChannel(channelId: string): Promise<void> {
		try {
			await this.webRTCService.initializeLocalStream()
			this.socket.emit('join_voice_channel', { channel_id: channelId })
			console.log('Joined voice channel:', channelId)

			this.activeGroupCallId = channelId
			if (this.onGroupCallIdChange) this.onGroupCallIdChange(channelId)
		} catch (error) {
			console.error('Failed to join voice channel:', error)
			throw error
		}
	}

	leaveVoiceChannel(channelId: string): void {
		this.socket.emit('leave_voice_channel', { channel_id: channelId })

		this.activeGroupCallId = null
		if (this.onGroupCallIdChange) this.onGroupCallIdChange(null)

		// Close all peer connections gracefully for this context
		this.webRTCService.peerConnections.forEach(pc => pc.close())
		this.webRTCService.peerConnections.clear()
		this.currentCalls.clear()
	}

	joinGroupCall(callId: string): void {
		this.webRTCService.initializeLocalStream().then(() => {
			this.socket.emit('group_call_answer', { call_id: callId })
			this.activeGroupCallId = callId
			if (this.onGroupCallIdChange) this.onGroupCallIdChange(callId)

			if (this.incomingCall && this.incomingCall.callId === callId) {
				this.incomingCall = null
			}
		})
	}

	leaveGroupCall(callId: string): void {
		this.socket.emit('group_call_end', { call_id: callId })
		this.activeGroupCallId = null
		if (this.onGroupCallIdChange) this.onGroupCallIdChange(null)

		this.webRTCService.peerConnections.forEach(pc => pc.close())
		this.webRTCService.peerConnections.clear()
		this.currentCalls.clear()

		if (this.onCallEnded) {
			this.onCallEnded({
				socketId: '',
				userId: '',
				status: 'ended',
				isGroupCall: true,
				callId: callId,
			})
		}
	}

	rejectGroupCall(callId: string): void {
		this.socket.emit('group_call_reject', { call_id: callId })
		if (this.incomingCall && this.incomingCall.callId === callId) {
			this.incomingCall = null
		}
	}

	async initiateDirectCall(
		targetUserId: string,
		targetUserName: string,
	): Promise<void> {
		try {
			await this.webRTCService.initializeLocalStream()
			await this.webRTCService.initiateCall(targetUserId)

			// Создаем запись о звонке
			const callState: CallState = {
				socketId: '', // Будет обновлено при ответе
				userId: targetUserId,
				userName: targetUserName,
				status: 'calling',
				startTime: new Date(),
			}

			// Временно сохраняем с userId как ключ, так как socketId пока неизвестен
			this.currentCalls.set(targetUserId, callState)
			this.updateCallState(targetUserId, callState)
		} catch (error) {
			console.error('Failed to initiate call:', error)
			const callState: CallState = {
				socketId: '',
				userId: targetUserId,
				userName: targetUserName,
				status: 'failed',
				startTime: new Date(),
			}
			this.updateCallState(targetUserId, callState)

			if (this.onCallFailed) {
				this.onCallFailed(
					callState,
					error instanceof Error ? error.message : 'Unknown error',
				)
			}
		}
	}

	private async handleIncomingCall(
		callerSocketId: string,
		offer: RTCSessionDescriptionInit,
		info?: { userId?: string; userName?: string; avatarUrl?: string },
	): Promise<void> {
		try {
			console.log('Handling incoming call from socket:', callerSocketId)

			const callState: CallState = {
				socketId: callerSocketId,
				userId: info?.userId || callerSocketId,
				userName: info?.userName || 'Входящий звонок',
				avatarUrl: info?.avatarUrl,
				status: 'ringing',
				startTime: new Date(),
			}

			this.incomingCall = callState
			this.currentCalls.set(callerSocketId, callState)
			console.log('Incoming call state set (modal should show now):', callState)

			if (this.onIncomingCall) {
				this.onIncomingCall(callState)
			}

			// Do NOT initializeLocalStream here because it might block showing the modal
			// Instead, just prepare the PC with the remote offer
			await this.webRTCService.handleIncomingCall(callerSocketId, offer)
		} catch (error) {
			console.error('Failed to handle incoming call:', error)
		}
	}

	private async handleCallAcceptedSignal(
		responderSocketId: string,
	): Promise<void> {
		console.log('Call accepted signal from:', responderSocketId)

		// Check if we have a call waiting for this answer
		let call = this.currentCalls.get(responderSocketId)
		let oldSocketId: string | undefined

		if (!call) {
			console.log(
				'Current call keys before migration:',
				Array.from(this.currentCalls.keys()),
			)
			for (const [key, state] of this.currentCalls.entries()) {
				if (state.status === 'calling') {
					console.log(`Mapping call from ${key} to ${responderSocketId}`)
					call = state
					oldSocketId = key
					this.currentCalls.delete(key)
					this.currentCalls.set(responderSocketId, call)

					// Update call details
					call.socketId = responderSocketId

					// Tell WebRTCService to migrate
					this.webRTCService.migrateCall(key, responderSocketId)
					console.log(
						'Current call keys after migration:',
						Array.from(this.currentCalls.keys()),
					)
					break
				}
			}
		}

		if (call) {
			call.status = 'connected'
			call.startTime = new Date()
			this.updateCallState(responderSocketId, call)

			if (this.onCallAccepted) {
				this.onCallAccepted(call, oldSocketId)
			}
		} else {
			console.warn('Received call_accepted but no matching call found')
		}
	}

	private async handleCallAccepted(
		responderSocketId: string,
		answer: RTCSessionDescriptionInit,
	): Promise<void> {
		// This method is now legacy or used if answer comes with call_accepted (not the case per prompt)
		// Keeping it for backward compatibility if needed, but the logic is now split.
		// If we receive an answer, we usually just want to pass it to WebRTCService.

		await this.webRTCService.handleAnswer({
			sender_socket_id: responderSocketId,
			answer: answer,
		})
	}

	async acceptIncomingCall(
		callerSocketId: string,
		callerInfo?: { userId: string; userName: string },
	): Promise<void> {
		try {
			// Ensure local media is available and attached before answering
			if (!this.webRTCService.getLocalStream()) {
				await this.webRTCService.initializeLocalStream()
			}
			await this.webRTCService.acceptCall(callerSocketId)

			// Clear incoming call state immediately
			if (this.incomingCall && this.incomingCall.socketId === callerSocketId) {
				this.incomingCall = null
			}

			const call = this.currentCalls.get(callerSocketId)
			if (call) {
				call.status = 'connected'
				call.startTime = new Date()
				if (callerInfo) {
					call.userId = callerInfo.userId
					call.userName = callerInfo.userName
				}
				this.updateCallState(callerSocketId, call)
			}
		} catch (error) {
			console.error('Failed to accept call:', error)
			throw error
		}
	}

	rejectIncomingCall(callerSocketId: string): void {
		this.webRTCService.rejectCall(callerSocketId)
		// No need to manually set status here as handleCallEnded will do it
		this.handleCallEnded(callerSocketId, 'rejected')
		this.incomingCall = null
	}

	endCall(targetSocketId: string): void {
		this.webRTCService.endCall(targetSocketId)
		this.handleCallEnded(targetSocketId)
	}

	endAllCalls(): void {
		this.webRTCService.endAllCalls()
		for (const socketId of this.currentCalls.keys()) {
			this.handleCallEnded(socketId)
		}
	}

	private handleCallEnded(
		socketId: string,
		status: 'ended' | 'rejected' = 'ended',
	): void {
		let call = this.currentCalls.get(socketId)
		let resourceKey = socketId

		// If call not found by socketId, check if we have a pending call keyed by userId
		if (!call) {
			for (const [key, state] of this.currentCalls.entries()) {
				if (state.status === 'calling') {
					console.log(`Mapping call end/reject from ${key} to ${socketId}`)
					call = state
					resourceKey = key
					// Migrate state to socketId for consistency
					this.currentCalls.delete(key)
					this.currentCalls.set(socketId, call)
					call.socketId = socketId
					break
				}
			}
		}

		// Always clean up WebRTC resources
		this.webRTCService.cleanupCall(resourceKey)
		if (resourceKey !== socketId) {
			this.webRTCService.cleanupCall(socketId)
		}

		if (call) {
			call.status = status
			call.duration = call.startTime
				? (new Date().getTime() - call.startTime.getTime()) / 1000
				: 0

			// Archive to history (simplified)
			// this.callHistory.push(...)

			this.currentCalls.delete(socketId)
			this.updateCallState(socketId, call) // Notify UI one last time

			if (this.onCallEnded) {
				this.onCallEnded(call)
			}
		}

		if (this.incomingCall && this.incomingCall.socketId === socketId) {
			this.incomingCall = null
		}
	}

	private handleCallFailed(message: string): void {
		// Find relevant call if possible, or notify generic error
		console.error('Call failed:', message)
		// If we have a single call in 'calling' state, it's likely that one
		for (const [key, state] of this.currentCalls.entries()) {
			if (state.status === 'calling') {
				state.status = 'failed'
				this.updateCallState(key, state)
				if (this.onCallFailed) {
					this.onCallFailed(state, message)
				}
			}
		}
	}

	private handleCallRejected(responderSocketId: string, reason?: string) {
		console.log(`Call rejected by ${responderSocketId}, reason: ${reason}`)
		this.handleCallEnded(responderSocketId, 'rejected')
	}

	private updateCallState(socketId: string, state: CallState): void {
		if (this.onCallStateChange) {
			this.onCallStateChange(socketId, state)
		}
	}

	getIncomingCall(): CallState | null {
		return this.incomingCall
	}

	toggleMute(): boolean {
		return this.webRTCService.toggleMute()
	}

	isMuted(): boolean {
		return this.webRTCService.isMuted()
	}

	cleanup(): void {
		this.webRTCService.cleanup()
		this.currentCalls.clear()
		this.socket.off('incoming_call')
		this.socket.off('call_accepted')
		this.socket.off('answer')
		this.socket.off('offer')
		this.socket.off('call_end')
		this.socket.off('call_ended')
		this.socket.off('call_reject')
		this.socket.off('call_rejected')
		this.socket.off('error')
		this.socket.off('ice_candidate')
	}
}
