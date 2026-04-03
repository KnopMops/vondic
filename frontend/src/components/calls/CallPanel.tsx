'use client'

import {
	HelpCircle,
	Mic,
	MicOff,
	Monitor,
	MonitorOff,
	PhoneOff,
	ScreenShare,
	Settings2,
	Users,
	Video,
	VideoOff,
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useCallStore } from '../../lib/stores/callStore'

interface CallPanelProps {
	onClose?: () => void
}

export const CallPanel: React.FC<CallPanelProps> = ({ onClose }) => {
	const {
		activeCalls,
		activeGroupCallId,
		localStream,
		screenStream,
		remoteStreams,
		isMuted,
		isVideoEnabled,
		isScreenSharing,
		isScreenShareSupported,
		endCall,
		toggleMute,
		toggleVideo,
		toggleScreenShare,
		leaveGroupCall,
	} = useCallStore()

	const [duration, setDuration] = useState(0)
	const [localParticipant, setLocalParticipant] = useState<{
		id: string
		username: string
		avatarUrl?: string
	} | null>(null)
	const remoteAudioRefs = useRef<Map<string, HTMLAudioElement>>(new Map())
	const [remoteScreenShares, setRemoteScreenShares] = useState<
		Map<string, MediaStream>
	>(new Map())

	const [panelHeight, setPanelHeight] = useState(400)
	const [panelWidth, setPanelWidth] = useState(400)
	const [panelPosition, setPanelPosition] = useState({ x: 0, y: 0 })
	const [isResizing, setIsResizing] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const resizeStartPos = useRef({ x: 0, y: 0 })
	const resizeStartSize = useRef({ width: 0, height: 0 })
	const dragStartPos = useRef({ x: 0, y: 0 })
	const lastResizeTime = useRef(0)
	const panelRef = useRef<HTMLDivElement>(null)

	const [isFullscreen, setIsFullscreen] = useState(false)

	const localScreenVideoRef = useRef<HTMLVideoElement>(null)
	const remoteScreenVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())
	const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map())

	const [showHelpTooltip, setShowHelpTooltip] = useState(false)
	const [showSettingsPanel, setShowSettingsPanel] = useState(false)
	const [remoteVolume, setRemoteVolume] = useState<number>(1)

	useEffect(() => {
		try {
			const userData = localStorage.getItem('user_data')
			if (userData) {
				const user = JSON.parse(userData)
				setLocalParticipant({
					id: user.id,
					username: user.username,
					avatarUrl: user.avatar_url,
				})
			}
		} catch {}
	}, [])

	useEffect(() => {
		const interval = setInterval(() => {
			setDuration(prev => prev + 1)
		}, 1000)
		return () => clearInterval(interval)
	}, [])

	const formatDuration = (seconds: number) => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}

	// Handle remote screen shares
	useEffect(() => {
		const newRemoteScreenShares = new Map<string, MediaStream>()

		activeCalls.forEach((call, socketId) => {
			if (call.status !== 'connected') return

			const stream = remoteStreams.get(socketId)
			if (!stream) return

			const videoTracks = stream.getVideoTracks()
			if (videoTracks.length > 0) {
				const screenShareStream = new MediaStream()
				videoTracks.forEach(track => {
					screenShareStream.addTrack(track)
				})
				if (screenShareStream.getTracks().length > 0) {
					newRemoteScreenShares.set(socketId, screenShareStream)
				}
			}
		})

		setRemoteScreenShares(prev => {
			const prevKeys = Array.from(prev.keys())
			const newKeys = Array.from(newRemoteScreenShares.keys())
			if (prevKeys.length !== newKeys.length) return newRemoteScreenShares
			const hasAllKeys = newKeys.every(key => prev.has(key))
			if (!hasAllKeys) return newRemoteScreenShares
			let changed = false
			for (const [key, stream] of newRemoteScreenShares.entries()) {
				if (prev.get(key) !== stream) {
					changed = true
					break
				}
			}
			return changed ? newRemoteScreenShares : prev
		})
	}, [activeCalls, remoteStreams])

	// Handle remote audio
	useEffect(() => {
		activeCalls.forEach((call, socketId) => {
			if (call.status !== 'connected') return

			const stream = remoteStreams.get(socketId)
			if (!stream) return

			const audioEl = remoteAudioRefs.current.get(socketId)
			if (audioEl) {
				audioEl.srcObject = stream
				audioEl.muted = false
				audioEl.volume = remoteVolume
				audioEl.play().catch(() => {})
			}
		})

		const currentKeys = Array.from(remoteAudioRefs.current.keys())
		currentKeys.forEach(key => {
			if (!activeCalls.has(key)) {
				remoteAudioRefs.current.delete(key)
			}
		})
	}, [activeCalls.size, remoteStreams.size, remoteVolume])

	// Handle remote video (webcam)
	useEffect(() => {
		activeCalls.forEach((call, socketId) => {
			if (call.status !== 'connected') return

			const stream = remoteStreams.get(socketId)
			if (!stream) return

			const videoEl = remoteVideoRefs.current.get(socketId)
			if (videoEl) {
				const videoTracks = stream.getVideoTracks()
				if (videoTracks.length > 0) {
					if (videoEl.srcObject !== stream) {
						videoEl.srcObject = stream
						videoEl.play().catch(() => {})
					}
				} else {
					// No video tracks, clear the video element
					if (videoEl.srcObject) {
						videoEl.srcObject = null
					}
				}
			}
		})

		// Cleanup removed participants
		const currentVideoKeys = Array.from(remoteVideoRefs.current.keys())
		currentVideoKeys.forEach(key => {
			if (!activeCalls.has(key)) {
				const videoEl = remoteVideoRefs.current.get(key)
				if (videoEl) {
					videoEl.srcObject = null
				}
				remoteVideoRefs.current.delete(key)
			}
		})
	}, [activeCalls.size, remoteStreams.size])

	// Handle screen share video
	useEffect(() => {
		// Local screen share
		if (localScreenVideoRef.current && screenStream) {
			const videoEl = localScreenVideoRef.current
			if (videoEl.srcObject !== screenStream) {
				videoEl.srcObject = screenStream
				videoEl.play().catch(() => {})
			}
		} else if (localScreenVideoRef.current && !screenStream) {
			localScreenVideoRef.current.srcObject = null
		}

		// Remote screen shares
		remoteScreenShares.forEach((stream, socketId) => {
			const videoEl = remoteScreenVideoRefs.current.get(socketId)
			if (videoEl) {
				if (videoEl.srcObject !== stream) {
					videoEl.srcObject = stream
					videoEl.play().catch(() => {})
				}
			}
		})

		// Cleanup removed screen shares
		const currentScreenKeys = Array.from(remoteScreenVideoRefs.current.keys())
		currentScreenKeys.forEach(key => {
			if (!remoteScreenShares.has(key)) {
				const videoEl = remoteScreenVideoRefs.current.get(key)
				if (videoEl) {
					videoEl.srcObject = null
				}
				remoteScreenVideoRefs.current.delete(key)
			}
		})
	}, [screenStream, remoteScreenShares])

	const localAudioRef = useRef<HTMLAudioElement>(null)
	useEffect(() => {
		if (localAudioRef.current && localStream) {
			localAudioRef.current.srcObject = localStream
			localAudioRef.current.muted = true
			localAudioRef.current.volume = 0
			localAudioRef.current.play().catch(() => {})
		}
	}, [localStream])

	// Resize handlers
	const handleResizeStart = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		setIsResizing(true)
		resizeStartPos.current = { x: e.clientX, y: e.clientY }
		resizeStartSize.current = { width: panelWidth, height: panelHeight }
		lastResizeTime.current = 0
		document.body.style.cursor = 'nwse-resize'
		document.body.style.userSelect = 'none'
	}

	const handleDragStart = (e: React.MouseEvent) => {
		// Only drag if clicking the header and NOT a button
		if ((e.target as HTMLElement).closest('button')) return

		e.preventDefault()
		setIsDragging(true)
		dragStartPos.current = {
			x: e.clientX - panelPosition.x,
			y: e.clientY - panelPosition.y,
		}
		document.body.style.cursor = 'grabbing'
		document.body.style.userSelect = 'none'
	}

	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isResizing) {
				// Throttle resize updates to 16ms (~60fps)
				const now = Date.now()
				if (now - lastResizeTime.current < 16) return
				lastResizeTime.current = now

				const deltaX = resizeStartPos.current.x - e.clientX
				const deltaY = resizeStartPos.current.y - e.clientY

				const newWidth = Math.max(
					300,
					Math.min(1000, resizeStartSize.current.width + deltaX),
				)
				const newHeight = Math.max(
					200,
					Math.min(800, resizeStartSize.current.height + deltaY),
				)

				setPanelWidth(newWidth)
				setPanelHeight(newHeight)
			} else if (isDragging) {
				const newX = e.clientX - dragStartPos.current.x
				const newY = e.clientY - dragStartPos.current.y

				// Constraints to keep panel within window
				const maxX = window.innerWidth - panelWidth
				const maxY = window.innerHeight - panelHeight

				setPanelPosition({
					x: Math.max(
						-panelWidth + 100,
						Math.min(window.innerWidth - 100, newX),
					),
					y: Math.max(0, Math.min(window.innerHeight - 50, newY)),
				})
			}
		}

		const handleMouseUp = () => {
			setIsResizing(false)
			setIsDragging(false)
			document.body.style.cursor = ''
			document.body.style.userSelect = ''
		}

		if (isResizing || isDragging) {
			window.addEventListener('mousemove', handleMouseMove)
			window.addEventListener('mouseup', handleMouseUp)
		}

		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
		}
	}, [isResizing, isDragging, panelWidth, panelHeight])

	const participants = React.useMemo(() => {
		const list: Array<{
			id: string
			username: string
			avatarUrl?: string
			isLocal: boolean
			hasVideo: boolean
			hasAudio: boolean
		}> = []

		if (localParticipant) {
			list.push({
				...localParticipant,
				isLocal: true,
				hasVideo: localStream?.getVideoTracks().length ?? 0 > 0,
				hasAudio: localStream?.getAudioTracks().length ?? 0 > 0,
			})
		}

		activeCalls.forEach(call => {
			if (call.userId && call.userName && call.status === 'connected') {
				const stream = remoteStreams.get(call.socketId)
				// Кэшируем проверку треков, чтобы избежать частых пересчётов
				const videoTrackCount = stream ? stream.getVideoTracks().length : 0
				const audioTrackCount = stream ? stream.getAudioTracks().length : 0

				list.push({
					id: call.userId,
					username: call.userName,
					avatarUrl: call.userAvatar,
					isLocal: false,
					hasVideo: videoTrackCount > 0,
					hasAudio: audioTrackCount > 0,
				})
			}
		})

		return list
	}, [localParticipant, activeCalls, remoteStreams.size, localStream])

	const allCallsConnected = React.useMemo(() => {
		if (activeGroupCallId) return true
		if (activeCalls.size === 0) return false
		return Array.from(activeCalls.values()).every(
			call => call.status === 'connected',
		)
	}, [activeCalls, activeGroupCallId])

	const handleEndCall = () => {
		if (activeGroupCallId) {
			leaveGroupCall(activeGroupCallId)
		} else {
			activeCalls.forEach(call => {
				endCall(call.socketId)
			})
		}
		if (onClose) onClose()
	}

	if (!activeGroupCallId && !allCallsConnected) {
		return null
	}

	const participantName = activeGroupCallId
		? 'Групповой звонок'
		: participants.find(p => !p.isLocal)?.username || 'Звонок'

	const participantAvatar = activeGroupCallId
		? null
		: participants.find(p => !p.isLocal)?.avatarUrl

	const participantCount = participants.length

	const hasScreenShare = screenStream !== null || remoteScreenShares.size > 0

	return (
		<div
			ref={panelRef}
			className={`fixed z-50 bg-[#2b2d31] rounded-xl shadow-2xl border border-[#1e1f22] overflow-hidden flex flex-col transition-all duration-300 ${isFullscreen ? 'fixed inset-0 w-full h-full !rounded-none z-[60]' : ''}`}
			style={
				isFullscreen
					? {}
					: {
							width: `${panelWidth}px`,
							height: `${panelHeight}px`,
							bottom: '16px',
							right: '16px',
							transform: `translate(${panelPosition.x}px, ${panelPosition.y}px)`,
						}
			}
		>
			<div
				className='absolute top-0 left-0 w-4 h-4 cursor-nwse-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>

			<div
				className='absolute top-0 right-0 w-4 h-4 cursor-nesw-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>

			<div
				className='absolute bottom-0 left-0 w-4 h-4 cursor-nesw-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>

			<div
				className='absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>

			<div
				className='absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>
			<div
				className='absolute bottom-0 left-0 right-0 h-1 cursor-ns-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>
			<div
				className='absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>
			<div
				className='absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize z-[10]'
				onMouseDown={handleResizeStart}
			/>

			<div className='h-full flex flex-col'>
				<div
					className='p-3 border-b border-[#1e1f22] flex-shrink-0 cursor-grab active:cursor-grabbing'
					onMouseDown={handleDragStart}
				>
					<div className='flex items-center justify-between'>
						<div className='flex items-center gap-3 pointer-events-none'>
							<div className='w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0'>
								{activeGroupCallId ? (
									<Users className='w-5 h-5' />
								) : participantAvatar ? (
									<img
										src={participantAvatar}
										alt=''
										className='w-full h-full object-cover rounded-full'
									/>
								) : (
									participantName.charAt(0).toUpperCase()
								)}
							</div>
							<div>
								<h3 className='text-white font-semibold text-sm'>
									{participantName}
								</h3>
								<div className='flex items-center gap-2 text-xs text-gray-400'>
									<span className='flex items-center gap-1 text-green-400'>
										<span className='w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse' />
										{formatDuration(duration)}
									</span>
									<span>•</span>
									<span>
										{participantCount}{' '}
										{participantCount === 1
											? 'участник'
											: participantCount < 5
												? 'участника'
												: 'участников'}
									</span>
								</div>
							</div>
						</div>
						<div className='flex items-center gap-1'>
							<div className='relative'>
								<button
									onMouseEnter={() => setShowHelpTooltip(true)}
									onMouseLeave={() => setShowHelpTooltip(false)}
									className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
									title='Информация о звонке'
								>
									<HelpCircle className='w-4 h-4' />
								</button>
								{showHelpTooltip && (
									<div className='absolute right-0 top-full mt-2 w-48 bg-[#1e1f22] border border-[#35373c] rounded-lg shadow-2xl z-[100] p-3'>
										<p className='text-[10px] text-gray-400 uppercase font-bold mb-1'>
											Статус
										</p>
										<p className='text-xs text-green-400 mb-2'>
											Соединение установлено
										</p>
										<p className='text-[10px] text-gray-400 uppercase font-bold mb-1'>
											Длительность
										</p>
										<p className='text-xs text-white'>
											{formatDuration(duration)}
										</p>
									</div>
								)}
							</div>
							<div className='relative'>
								<button
									onMouseEnter={() => setShowSettingsPanel(true)}
									onMouseLeave={() => setShowSettingsPanel(false)}
									className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
									title='Настройки звука'
								>
									<Settings2 className='w-4 h-4' />
								</button>
								{showSettingsPanel && (
									<div className='absolute right-0 top-full mt-2 w-56 bg-[#1e1f22] border border-[#35373c] rounded-lg shadow-2xl z-[100] p-3'>
										<p className='text-[10px] text-gray-400 uppercase font-bold mb-2'>
											Громкость собеседников
										</p>
										<input
											type='range'
											min='0'
											max='100'
											value={remoteVolume * 100}
											onChange={e =>
												setRemoteVolume(Number(e.target.value) / 100)
											}
											className='w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500'
										/>
										<div className='flex justify-between mt-1'>
											<span className='text-[10px] text-gray-500'>0%</span>
											<span className='text-[10px] text-gray-500'>100%</span>
										</div>
									</div>
								)}
							</div>
							<button
								onClick={() => setIsFullscreen(!isFullscreen)}
								className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
								title={
									isFullscreen
										? 'Выйти из полноэкранного режима'
										: 'Во весь экран'
								}
							>
								{isFullscreen ? (
									<MonitorOff className='w-4 h-4' />
								) : (
									<Monitor className='w-4 h-4' />
								)}
							</button>
							<button
								onClick={handleEndCall}
								className='p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors'
								title='Завершить звонок'
							>
								<PhoneOff className='w-4 h-4' />
							</button>
						</div>
					</div>
				</div>

				<div className='flex-1 overflow-y-auto p-3'>
					{hasScreenShare && (
						<div className='mb-3'>
							<div className='bg-[#1e1f22] rounded-lg overflow-hidden aspect-video relative'>
								{screenStream && (
									<video
										autoPlay
										playsInline
										muted
										className='w-full h-full object-contain'
										ref={localScreenVideoRef}
									/>
								)}
								{Array.from(remoteScreenShares.entries()).map(
									([socketId, stream]) => (
										<video
											key={socketId}
											autoPlay
											playsInline
											muted
											className='w-full h-full object-contain absolute inset-0'
											ref={el => {
												if (el) {
													remoteScreenVideoRefs.current.set(socketId, el)
												} else {
													remoteScreenVideoRefs.current.delete(socketId)
												}
											}}
										/>
									),
								)}
								<div className='absolute bottom-2 left-2 right-2 flex items-center justify-between'>
									<div className='px-2 py-1 bg-black/60 rounded text-xs text-white flex items-center gap-1.5'>
										<ScreenShare className='w-3 h-3 text-emerald-400' />
										{screenStream
											? 'Демонстрация экрана (Вы)'
											: 'Демонстрация экрана'}
									</div>
									<button
										onClick={() => setIsFullscreen(!isFullscreen)}
										className='p-1.5 bg-black/60 hover:bg-black/80 rounded text-white transition-colors'
										title={
											isFullscreen
												? 'Выйти из полноэкранного режима'
												: 'Во весь экран'
										}
									>
										{isFullscreen ? (
											<MonitorOff className='w-3.5 h-3.5' />
										) : (
											<Monitor className='w-3.5 h-3.5' />
										)}
									</button>
								</div>
							</div>
						</div>
					)}

					<div
						className={`grid gap-2 mb-3 ${
							participantCount === 1
								? 'grid-cols-1'
								: participantCount === 2
									? 'grid-cols-2'
									: participantCount <= 4
										? 'grid-cols-2'
										: 'grid-cols-3'
						}`}
					>
						{participants.map(participant => (
							<div
								key={participant.id}
								className='relative bg-[#1e1f22] rounded-lg overflow-hidden group hover:bg-[#35373c] transition-colors'
								style={{ aspectRatio: participantCount <= 2 ? '16/9' : '1/1' }}
							>
								<div className='absolute inset-0 flex items-center justify-center'>
									{participant.hasVideo && !participant.isLocal ? (
										<video
											autoPlay
											playsInline
											muted
											className='w-full h-full object-cover'
											ref={el => {
												if (el) {
													remoteVideoRefs.current.set(participant.id, el)
												} else {
													remoteVideoRefs.current.delete(participant.id)
												}
											}}
										/>
									) : participant.avatarUrl && !participant.isLocal ? (
										<img
											src={participant.avatarUrl}
											alt={participant.username}
											className='w-full h-full object-cover'
										/>
									) : (
										<div className='w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-lg'>
											{participant.username.charAt(0).toUpperCase()}
										</div>
									)}
								</div>

								<div className='absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent' />

								<div className='absolute bottom-0 left-0 right-0 p-2 flex items-center gap-2'>
									<div className='flex-1 min-w-0'>
										<p className='text-white font-semibold text-xs truncate drop-shadow-lg'>
											{participant.username}
											{participant.isLocal && (
												<span className='text-gray-400 ml-1'>(Вы)</span>
											)}
										</p>
									</div>
								</div>

								<div className='absolute top-2 right-2 flex flex-col gap-1'>
									{participant.isLocal && isMuted && (
										<div
											className='p-1.5 bg-red-500/90 rounded-full text-white shadow-lg'
											title='Микрофон выключен'
										>
											<MicOff className='w-3.5 h-3.5' />
										</div>
									)}
									{participant.isLocal && !isVideoEnabled() && (
										<div
											className='p-1.5 bg-red-500/90 rounded-full text-white shadow-lg'
											title='Камера выключена'
										>
											<VideoOff className='w-3.5 h-3.5' />
										</div>
									)}
									{participant.isLocal && isScreenSharing && (
										<div
											className='p-1.5 bg-emerald-500/90 rounded-full text-white shadow-lg'
											title='Демонстрация экрана'
										>
											<Monitor className='w-3.5 h-3.5' />
										</div>
									)}
									{!participant.isLocal && participant.hasAudio && (
										<div
											className='p-1.5 bg-green-500/90 rounded-full text-white shadow-lg'
											title='Говорит'
										>
											<Mic className='w-3.5 h-3.5' />
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				</div>

				<div className='p-3 border-t border-[#1e1f22] flex-shrink-0'>
					<div className='flex items-center justify-center gap-2'>
						<button
							onClick={toggleMute}
							className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
								isMuted
									? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
									: 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'
							}`}
							title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
						>
							{isMuted ? (
								<MicOff className='w-5 h-5' />
							) : (
								<Mic className='w-5 h-5' />
							)}
						</button>

						<button
							onClick={toggleVideo}
							className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
								!isVideoEnabled()
									? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
									: 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'
							}`}
							title={!isVideoEnabled() ? 'Включить камеру' : 'Выключить камеру'}
						>
							{!isVideoEnabled() ? (
								<VideoOff className='w-5 h-5' />
							) : (
								<Video className='w-5 h-5' />
							)}
						</button>

						{isScreenShareSupported && (
							<button
								onClick={toggleScreenShare}
								className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg transition-colors ${
									isScreenSharing
										? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
										: 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'
								}`}
								title={
									isScreenSharing
										? 'Остановить демонстрацию'
										: 'Демонстрация экрана'
								}
							>
								{isScreenSharing ? (
									<MonitorOff className='w-5 h-5' />
								) : (
									<Monitor className='w-5 h-5' />
								)}
							</button>
						)}

						<button
							onClick={handleEndCall}
							className='flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors'
							title='Завершить звонок'
						>
							<PhoneOff className='w-5 h-5' />
						</button>
					</div>
				</div>
			</div>

			{Array.from(activeCalls.entries()).map(
				([socketId, call]) =>
					call.status === 'connected' && (
						<audio
							key={socketId}
							ref={el => {
								if (el) {
									remoteAudioRefs.current.set(socketId, el)
									const stream = remoteStreams.get(socketId)
									if (stream) {
										el.srcObject = stream
										el.muted = false
										el.volume = 1
										el.play().catch(() => {})
									}
								} else {
									remoteAudioRefs.current.delete(socketId)
								}
							}}
							autoPlay
							playsInline
						/>
					),
			)}

			<audio ref={localAudioRef} autoPlay playsInline muted />
		</div>
	)
}
