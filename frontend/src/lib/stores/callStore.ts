import { Socket } from 'socket.io-client'
import { create } from 'zustand'
import { CallManager, CallRecord, CallState } from '../services/CallManager'
import { WebRTCService } from '../services/WebRTCService'

interface CallStore {
	// Состояния
	isInitialized: boolean
	isWebRTCSupported: boolean
	isScreenShareSupported: boolean
	localStream: MediaStream | null
	screenStream: MediaStream | null
	remoteStreams: Map<string, MediaStream>
	activeCalls: Map<string, CallState>
	activeGroupCallId: string | null
	incomingCall: CallState | null
	isMuted: boolean
	isScreenSharing: boolean
	videoStream: MediaStream | null
	isVideoActive: boolean
	callHistory: CallRecord[]

	// Сервисы
	webRTCService: WebRTCService | null
	callManager: CallManager | null
	socket: Socket | null
	currentUserId: string | null

	// Действия
	initializeWebRTC: (
		socket: Socket,
		user: { id: string; name: string; avatar?: string },
	) => Promise<void>
	cleanup: () => void
	setLocalStream: (stream: MediaStream | null) => void
	addActiveCall: (socketId: string, call: CallState) => void
	removeActiveCall: (socketId: string) => void
	updateActiveCall: (socketId: string, call: CallState) => void
	setIncomingCall: (call: CallState | null) => void
	clearIncomingCall: () => void
	toggleMute: () => boolean
	setMuted: (muted: boolean) => void
	addToHistory: (record: CallRecord) => void
	clearHistory: () => void
	startScreenShare: () => Promise<void>
	stopScreenShare: () => Promise<void>
	toggleScreenShare: () => Promise<void>
	startVideo: () => Promise<void>
	stopVideo: () => Promise<void>
	toggleVideo: () => Promise<void>
	isVideoEnabled: () => boolean

	// Действия звонков
	initiateCall: (targetUserId: string, targetUserName: string) => Promise<void>
	initiateGroupCall: (groupId: string) => Promise<void>
	joinVoiceChannel: (channelId: string) => Promise<void>
	leaveVoiceChannel: (channelId: string) => void
	joinGroupCall: (callId: string) => Promise<void>
	leaveGroupCall: (callId: string) => void
	acceptCall: (
		callerSocketId: string,
		callerInfo?: { userId: string; userName: string },
	) => Promise<void>
	rejectCall: (callerSocketId: string) => void
	endCall: (targetSocketId: string) => void
	endAllCalls: () => void

	// Геттеры
	getCallBySocketId: (socketId: string) => CallState | undefined
	getCallByUserId: (userId: string) => CallState | undefined
	getActiveCallsCount: () => number
	getTotalCallDuration: () => number
}

export const useCallStore = create<CallStore>((set, get) => ({
	// Начальные состояния
	isInitialized: false,
	isWebRTCSupported:
		typeof window !== 'undefined' && 'RTCPeerConnection' in window,
	isScreenShareSupported:
		typeof window !== 'undefined' &&
		typeof navigator !== 'undefined' &&
		!!navigator.mediaDevices &&
		typeof navigator.mediaDevices.getDisplayMedia === 'function',
	localStream: null,
	screenStream: null,
	videoStream: null,
	isVideoActive: false,
	remoteStreams: new Map(),
	activeCalls: new Map(),
	activeGroupCallId: null,
	incomingCall: null,
	isMuted: false,
	isScreenSharing: false,
	callHistory: [],

	// Сервисы
	webRTCService: null,
	callManager: null,
	socket: null,
	currentUserId: null,

	// Инициализация WebRTC
	initializeWebRTC: async (
		socket: Socket,
		user: { id: string; name: string; avatar?: string },
	) => {
		try {
			if (!get().isWebRTCSupported) {
				throw new Error('WebRTC не поддерживается в этом браузере')
			}

			const webRTCService = new WebRTCService(socket, user.id)
			const callManager = new CallManager(webRTCService, socket)
			callManager.setCurrentUser(user)

			// Настройка callback'ов
			webRTCService.onLocalStream = (stream: MediaStream) => {
				set({ localStream: stream })
			}

			callManager.onRemoteStream = (socketId: string, stream: MediaStream) => {
				const { activeCalls, remoteStreams } = get()
				const call = activeCalls.get(socketId)

				// Обновляем стримы
				const newStreams = new Map(remoteStreams)
				newStreams.set(socketId, stream)

				if (call) {
					call.status = 'connected'
					const newCalls = new Map(activeCalls)
					newCalls.set(socketId, call)
					set({ activeCalls: newCalls, remoteStreams: newStreams })
				} else {
					set({ remoteStreams: newStreams })
				}
			}

			callManager.onIncomingCall = (call: CallState) => {
				set({ incomingCall: call })
			}

			callManager.onCallAccepted = (call: CallState, oldSocketId?: string) => {
				const { activeCalls, remoteStreams } = get()
				const newCalls = new Map(activeCalls)
				const newStreams = new Map(remoteStreams)

				if (oldSocketId) {
					newCalls.delete(oldSocketId)
					// Migrate remote stream if exists
					const stream = newStreams.get(oldSocketId)
					if (stream) {
						newStreams.delete(oldSocketId)
						newStreams.set(call.socketId, stream)
					}
				}
				newCalls.set(call.socketId, call)
				set({
					activeCalls: newCalls,
					remoteStreams: newStreams,
					incomingCall: null,
				})
			}

			callManager.onCallRejected = (call: CallState, reason?: string) => {
				const { activeCalls } = get()
				const newCalls = new Map(activeCalls)
				newCalls.set(call.socketId, call)
				set({ activeCalls: newCalls, incomingCall: null })
			}

			webRTCService.onCallMigrated = (oldKey: string, newKey: string) => {
				const { activeCalls, remoteStreams } = get()
				const newCalls = new Map(activeCalls)
				const newStreams = new Map(remoteStreams)
				const call = newCalls.get(oldKey)
				if (call) {
					newCalls.delete(oldKey)
					newCalls.set(newKey, { ...call, socketId: newKey })
				}
				const stream = newStreams.get(oldKey)
				if (stream) {
					newStreams.delete(oldKey)
					newStreams.set(newKey, stream)
				}
				set({ activeCalls: newCalls, remoteStreams: newStreams })
			}

			webRTCService.onScreenShareStateChange = (
				stream: MediaStream | null,
				isSharing: boolean,
			) => {
				set({ screenStream: stream, isScreenSharing: isSharing })
			}

			callManager.onCallEnded = (call: CallState) => {
				const { activeCalls, callHistory, remoteStreams } = get()
				const newCalls = new Map(activeCalls)
				newCalls.delete(call.socketId)

				const newStreams = new Map(remoteStreams)
				newStreams.delete(call.socketId)

				// Добавляем в историю
				const historyRecord: CallRecord = {
					id: `${call.userId}-${Date.now()}`,
					callerId: user.id,
					callerName: 'Me',
					receiverId: call.userId,
					receiverName: call.userName || 'Unknown',
					type: call.status === 'connected' ? 'outgoing' : 'missed',
					duration: call.duration || 0,
					startTime: call.startTime || new Date(),
					endTime: new Date(),
					status: call.status === 'connected' ? 'completed' : 'missed',
				}

				const newHistory = [historyRecord, ...callHistory]

				set({
					activeCalls: newCalls,
					remoteStreams: newStreams,
					callHistory: newHistory.slice(0, 100), // Ограничиваем историю
				})
			}

			callManager.onCallFailed = (call: CallState, error: string) => {
				console.error('Call failed:', error)
				const { activeCalls } = get()
				const newCalls = new Map(activeCalls)
				if (call.socketId) {
					newCalls.set(call.socketId, { ...call, status: 'failed' })
				}
				set({ activeCalls: newCalls })
			}

			callManager.onCallStateChange = (socketId: string, state: CallState) => {
				const { activeCalls } = get()
				const newCalls = new Map(activeCalls)
				newCalls.set(socketId, state)
				set({ activeCalls: newCalls })
			}

			// Add the video state change callback to the WebRTCService
			webRTCService.onVideoStateChange = (stream: MediaStream | null, isEnabled: boolean) => {
				// Update the video stream in the store
				set({ videoStream: stream, isVideoActive: isEnabled })
			}

			callManager.onGroupCallIdChange = (groupId: string | null) => {
				set({ activeGroupCallId: groupId })
			}

			set({
				isInitialized: true,
				webRTCService,
				callManager,
				socket,
				currentUserId: user.id,
				screenStream: webRTCService.getScreenStream(),
				isScreenSharing: webRTCService.isScreenSharing(),
			})
		} catch (error) {
			console.error('Failed to initialize WebRTC:', error)
			throw error
		}
	},

	// Очистка
	cleanup: () => {
		const { callManager, webRTCService } = get()

		if (callManager) {
			callManager.cleanup()
		}

		if (webRTCService) {
			webRTCService.cleanup()
		}

		set({
			isInitialized: false,
			localStream: null,
			screenStream: null,
			videoStream: null,
			isVideoActive: false,
			remoteStreams: new Map(),
			activeCalls: new Map(),
			activeGroupCallId: null,
			incomingCall: null,
			isMuted: false,
			isScreenSharing: false,
			webRTCService: null,
			callManager: null,
			socket: null,
			currentUserId: null,
		})
	},

	// Управление локальным стримом
	setLocalStream: (stream: MediaStream | null) => {
		set({ localStream: stream })
	},

	// Управление активными звонками
	addActiveCall: (socketId: string, call: CallState) => {
		const { activeCalls } = get()
		const newCalls = new Map(activeCalls)
		newCalls.set(socketId, call)
		set({ activeCalls: newCalls })
	},

	removeActiveCall: (socketId: string) => {
		const { activeCalls } = get()
		const newCalls = new Map(activeCalls)
		newCalls.delete(socketId)
		set({ activeCalls: newCalls })
	},

	updateActiveCall: (socketId: string, call: CallState) => {
		const { activeCalls } = get()
		const newCalls = new Map(activeCalls)
		newCalls.set(socketId, call)
		set({ activeCalls: newCalls })
	},

	// Управление входящим звонком
	setIncomingCall: (call: CallState | null) => {
		set({ incomingCall: call })
	},

	clearIncomingCall: () => {
		set({ incomingCall: null })
	},

	// Управление микрофоном
	toggleMute: () => {
		const { callManager, isMuted } = get()
		if (callManager) {
			const newMutedState = callManager.toggleMute()
			set({ isMuted: newMutedState })
			return newMutedState
		}
		return isMuted
	},

	setMuted: (muted: boolean) => {
		const { callManager } = get()
		if (callManager) {
			const currentMuted = callManager.isMuted()
			if (currentMuted !== muted) {
				callManager.toggleMute()
			}
		}
		set({ isMuted: muted })
	},

	// Управление историей
	addToHistory: (record: CallRecord) => {
		const { callHistory } = get()
		const newHistory = [record, ...callHistory]
		set({ callHistory: newHistory.slice(0, 100) })
	},

	clearHistory: () => {
		set({ callHistory: [] })
	},

	startScreenShare: async () => {
		const { webRTCService, isScreenShareSupported } = get()
		if (!webRTCService || !isScreenShareSupported) return
		try {
			await webRTCService.startScreenShare()
		} catch {
			return
		}
		set({
			screenStream: webRTCService.getScreenStream(),
			isScreenSharing: webRTCService.isScreenSharing(),
		})
	},

	stopScreenShare: async () => {
		const { webRTCService } = get()
		if (!webRTCService) return
		await webRTCService.stopScreenShare()
		set({
			screenStream: webRTCService.getScreenStream(),
			isScreenSharing: webRTCService.isScreenSharing(),
		})
	},

	toggleScreenShare: async () => {
		const { webRTCService, isScreenSharing, isScreenShareSupported } = get()
		if (!webRTCService || !isScreenShareSupported) return
		try {
			if (isScreenSharing) {
				await webRTCService.stopScreenShare()
			} else {
				await webRTCService.startScreenShare()
			}
		} catch {
			return
		}
		set({
			screenStream: webRTCService.getScreenStream(),
			isScreenSharing: webRTCService.isScreenSharing(),
		})
	},

	startVideo: async () => {
		const { callManager } = get()
		if (!callManager) return
		await callManager.startVideo()
	},

	stopVideo: async () => {
		const { callManager } = get()
		if (!callManager) return
		await callManager.stopVideo()
	},

	toggleVideo: async () => {
		const { callManager } = get()
		if (!callManager) return
		await callManager.toggleVideo()
	},

	isVideoEnabled: () => {
		const { callManager } = get()
		if (!callManager) return false
		return callManager.isVideoEnabled()
	},

	// Действия звонков
	initiateCall: async (targetUserId: string, targetUserName: string) => {
		const { callManager } = get()
		if (!callManager) {
			throw new Error('CallManager не инициализирован')
		}

		await callManager.initiateDirectCall(targetUserId, targetUserName)
	},

	initiateGroupCall: async (groupId: string) => {
		const { callManager } = get()
		if (!callManager) throw new Error('CallManager not initialized')
		await callManager.initiateGroupCall(groupId)
	},

	joinVoiceChannel: async (channelId: string) => {
		const { callManager } = get()
		if (!callManager) throw new Error('CallManager not initialized')
		await callManager.joinVoiceChannel(channelId)
	},

	leaveVoiceChannel: (channelId: string) => {
		const { callManager } = get()
		if (!callManager) return
		callManager.leaveVoiceChannel(channelId)
	},

	joinGroupCall: async (callId: string) => {
		const { callManager } = get()
		if (!callManager) throw new Error('CallManager not initialized')
		await callManager.joinGroupCall(callId)
	},

	leaveGroupCall: (callId: string) => {
		const { callManager } = get()
		if (!callManager) return
		callManager.leaveGroupCall(callId)
	},

	acceptCall: async (
		callerSocketId: string,
		callerInfo?: { userId: string; userName: string },
	) => {
		const { callManager, incomingCall } = get()
		if (!callManager) {
			throw new Error('CallManager не инициализирован')
		}

		if (incomingCall?.isGroupCall && incomingCall.callId) {
			await callManager.joinGroupCall(incomingCall.callId)
		} else {
			await callManager.acceptIncomingCall(callerSocketId, callerInfo)
		}
		set({ incomingCall: null })
	},

	rejectCall: (callerSocketId: string) => {
		const { callManager, incomingCall } = get()
		if (!callManager) {
			return
		}

		if (incomingCall?.isGroupCall && incomingCall.callId) {
			callManager.rejectGroupCall(incomingCall.callId)
		} else {
			callManager.rejectIncomingCall(callerSocketId)
		}
		set({ incomingCall: null })
	},

	endCall: (targetSocketId: string) => {
		const { callManager } = get()
		if (!callManager) {
			return
		}

		callManager.endCall(targetSocketId)
	},

	endAllCalls: () => {
		const { callManager } = get()
		if (!callManager) {
			return
		}

		callManager.endAllCalls()
	},

	// Геттеры
	getCallBySocketId: (socketId: string) => {
		const { activeCalls } = get()
		return activeCalls.get(socketId)
	},

	getCallByUserId: (userId: string) => {
		const { activeCalls } = get()
		for (const call of activeCalls.values()) {
			if (call.userId === userId) {
				return call
			}
		}
		return undefined
	},

	getActiveCallsCount: () => {
		const { activeCalls } = get()
		return activeCalls.size
	},

	getTotalCallDuration: () => {
		const { activeCalls } = get()
		let totalDuration = 0
		for (const call of activeCalls.values()) {
			if (call.duration) {
				totalDuration += call.duration
			}
		}
		return totalDuration
	},
}))

// Селекторы для удобного использования
export const useWebRTCService = () => useCallStore(state => state.webRTCService)
export const useCallManager = () => useCallStore(state => state.callManager)
export const useLocalStream = () => useCallStore(state => state.localStream)
export const useRemoteStreams = () => useCallStore(state => state.remoteStreams)
export const useActiveCalls = () => useCallStore(state => state.activeCalls)
export const useActiveGroupCallId = () =>
	useCallStore(state => state.activeGroupCallId)
export const useIncomingCall = () => useCallStore(state => state.incomingCall)
export const useCallHistory = () => useCallStore(state => state.callHistory)
export const useIsMuted = () => useCallStore(state => state.isMuted)
export const useIsInitialized = () => useCallStore(state => state.isInitialized)
export const useIsWebRTCSupported = () =>
	useCallStore(state => state.isWebRTCSupported)
export const useIsScreenShareSupported = () =>
	useCallStore(state => state.isScreenShareSupported)

export const useStartVideo = () => useCallStore(state => state.startVideo)
export const useStopVideo = () => useCallStore(state => state.stopVideo)
export const useToggleVideo = () => useCallStore(state => state.toggleVideo)
export const useIsVideoEnabled = () => useCallStore(state => state.isVideoEnabled)
