import { Socket } from 'socket.io-client'

export interface WebRTCConfig {
	iceServers: RTCIceServer[]
}

export interface CallState {
	socketId: string
	userId: string
	userName?: string
	status: 'calling' | 'ringing' | 'connected' | 'ended' | 'rejected' | 'failed'
	startTime?: Date
	duration?: number
}

export class WebRTCService {
	private socket: Socket
	private userId: string
	private localStream: MediaStream | null = null
	private remoteStreams: Map<string, MediaStream> = new Map()
	private peerConnections: Map<string, RTCPeerConnection> = new Map()
	private configuration: WebRTCConfig

	
	public onRemoteStream?: (socketId: string, stream: MediaStream) => void
	public onConnectionStateChange?: (socketId: string, state: RTCPeerConnectionState) => void
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
				video: false, 
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

	createPeerConnection(targetSocketId: string): RTCPeerConnection {
		const pc = new RTCPeerConnection(this.configuration)

		
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => {
				pc.addTrack(track, this.localStream!)
			})
		}

		
		pc.onicecandidate = (event) => {
			if (event.candidate) {
				this.socket.emit('ice_candidate', {
					target_socket_id: targetSocketId,
					candidate: event.candidate,
				})
			}
		}

		
		pc.ontrack = (event) => {
			const stream = event.streams[0]
			this.remoteStreams.set(targetSocketId, stream)
			
			if (this.onRemoteStream) {
				this.onRemoteStream(targetSocketId, stream)
			}
		}

		
		pc.onconnectionstatechange = () => {
			if (this.onConnectionStateChange) {
				this.onConnectionStateChange(targetSocketId, pc.connectionState)
			}
		}

		this.peerConnections.set(targetSocketId, pc)
		return pc
	}

	async initiateCall(targetUserId: string): Promise<void> {
		try {
			console.log('Initiating call to user:', targetUserId)
			const pc = this.createPeerConnection(targetUserId) 
			const offer = await pc.createOffer()
			await pc.setLocalDescription(offer)
			console.log('Created offer:', offer)

			
			console.log('Emitting call_user event for user_id:', targetUserId)
			this.socket.emit('call_user', { target_user_id: targetUserId })
			
			
			setTimeout(() => {
				console.log('Emitting offer event with target_socket_id:', targetUserId)
				this.socket.emit('offer', {
					target_socket_id: targetUserId, 
					offer: offer,
				})
			}, 100)
		} catch (error) {
			console.error('Failed to initiate call:', error)
			throw error
		}
	}

	async handleIncomingCall(callerSocketId: string): Promise<void> {
		
		this.createPeerConnection(callerSocketId)
	}

	async acceptCall(callerSocketId: string): Promise<void> {
		try {
			const pc = this.peerConnections.get(callerSocketId)
			if (!pc) {
				throw new Error('Peer connection not found')
			}

			
			console.log('Current peer connection state:', pc.signalingState)
			console.log('Current remote description:', pc.remoteDescription)
			
			
			if (!pc.remoteDescription) {
				console.log('Waiting for remote description before creating answer...')
				return new Promise((resolve, reject) => {
					const checkInterval = setInterval(() => {
						if (pc.remoteDescription) {
							clearInterval(checkInterval)
							console.log('Remote description received, creating answer')
							pc.createAnswer()
								.then((answer: RTCSessionDescriptionInit) => {
									console.log('Answer created:', answer)
									return pc.setLocalDescription(new RTCSessionDescription(answer))
								})
								.then(() => {
									console.log('Answer set as local description')
									
									
									this.socket.emit('call_answer', { caller_socket_id: callerSocketId })
									
									
									this.socket.emit('answer', {
										target_socket_id: callerSocketId,
										answer: new RTCSessionDescription(answer),
									})
									
									resolve()
								})
								.catch(error => {
									console.error('Failed to create answer:', error)
									reject(error)
								})
						}
					}, 100)
					
					
					setTimeout(() => {
						clearInterval(checkInterval)
						reject(new Error('Timeout waiting for remote description'))
					}, 10000)
				})
			} else {
				
				const answer = await pc.createAnswer()
				await pc.setLocalDescription(answer)
				console.log('Answer created and set as local description')

				
				this.socket.emit('call_answer', { caller_socket_id: callerSocketId })
				
				
				this.socket.emit('answer', {
					target_socket_id: callerSocketId,
					answer: new RTCSessionDescription(answer),
				})
			}
		} catch (error) {
			console.error('Failed to accept call:', error)
			throw error
		}
	}

	rejectCall(callerSocketId: string): void {
		this.socket.emit('call_reject', { caller_socket_id: callerSocketId })
	}

	endCall(targetSocketId: string): void {
		const pc = this.peerConnections.get(targetSocketId)
		if (pc) {
			pc.close()
			this.peerConnections.delete(targetSocketId)
		}
		
		const remoteStream = this.remoteStreams.get(targetSocketId)
		if (remoteStream) {
			remoteStream.getTracks().forEach(track => track.stop())
			this.remoteStreams.delete(targetSocketId)
		}

		this.socket.emit('call_end', { target_socket_id: targetSocketId })
	}

	async handleOffer(data: { sender_socket_id: string; offer: RTCSessionDescriptionInit }): Promise<void> {
		try {
			const pc = this.peerConnections.get(data.sender_socket_id)
			if (!pc) {
				console.error('No peer connection found for offer from:', data.sender_socket_id)
				return
			}

			console.log('Setting remote description from offer')
			await pc.setRemoteDescription(new RTCSessionDescription(data.offer))
			console.log('Remote description set')
		} catch (error) {
			console.error('Failed to handle offer:', error)
		}
	}

	async handleAnswer(data: { sender_socket_id: string; answer: RTCSessionDescriptionInit }): Promise<void> {
		try {
			const pc = this.peerConnections.get(data.sender_socket_id)
			if (!pc) {
				console.error('No peer connection found for answer from:', data.sender_socket_id)
				return
			}

			console.log('Setting remote description from answer')
			await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
			console.log('Remote description set from answer')
		} catch (error) {
			console.error('Failed to handle answer:', error)
		}
	}

	async handleIceCandidate(data: { sender_socket_id: string; candidate: RTCIceCandidateInit }): Promise<void> {
		try {
			const pc = this.peerConnections.get(data.sender_socket_id)
			if (!pc) {
				return
			}

			await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
			console.log('ICE candidate added from:', data.sender_socket_id)
		} catch (error) {
			console.error('Failed to handle ICE candidate:', error)
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

	private async getSocketIdByUserId(userId: string): Promise<string | null> {
		
		
		return new Promise((resolve) => {
			
			this.socket.emit('get_socket_id', { user_id: userId }, (response: { socket_id: string }) => {
				resolve(response.socket_id || null)
			})
		})
	}

	cleanup(): void {
		this.endAllCalls()
		
		if (this.localStream) {
			this.localStream.getTracks().forEach(track => track.stop())
			this.localStream = null
		}

		this.remoteStreams.clear()
		this.peerConnections.clear()
	}
}
