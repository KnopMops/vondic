'use client'

import { getAttachmentUrl } from '@/lib/utils'
import {
	FiChevronDown as ChevronDown,
	FiChevronUp as ChevronUp,
	FiHelpCircle as HelpCircle,
	FiMaximize2 as Maximize2,
	FiMic as Mic,
	FiMicOff as MicOff,
	FiMinimize2 as Minimize2,
	FiMonitor as Monitor,
	FiPhoneOff as PhoneOff,
	FiVideo as Video,
	FiVideoOff as VideoOff,
	FiVolume2 as Volume2,
	FiX as X,
} from 'react-icons/fi'
import {
	LuMonitorOff as MonitorOff,
	LuSettings2 as Settings2,
} from 'react-icons/lu'
import React, { useEffect, useRef, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'

interface ActiveCallProps {
	callInfo: CallState
	onEndCall: (socketId: string) => void
	onMuteToggle: () => void
	onScreenShareToggle: () => void
	onVideoToggle: () => void
	isMuted: boolean
	isScreenSharing: boolean
	isVideoEnabled: boolean
	isScreenShareSupported: boolean
	localStream: MediaStream | null
	screenStream: MediaStream | null
	remoteStream: MediaStream | null
	videoStream: MediaStream | null
}

const ActiveCall: React.FC<ActiveCallProps> = ({
	callInfo,
	onEndCall,
	onMuteToggle,
	onScreenShareToggle,
	onVideoToggle,
	isMuted,
	isScreenSharing,
	isVideoEnabled,
	isScreenShareSupported,
	localStream,
	screenStream,
	remoteStream,
	videoStream,
}) => {
	const remoteAudioRef = useRef<HTMLAudioElement>(null)
	const localAudioRef = useRef<HTMLAudioElement>(null)
	const remoteVideoRef = useRef<HTMLVideoElement>(null)
	const localVideoRef = useRef<HTMLVideoElement>(null)
	const localScreenRef = useRef<HTMLVideoElement>(null)
	const callWindowRef = useRef<HTMLDivElement>(null)

	const [duration, setDuration] = useState(0)
	const [isMinimized, setIsMinimized] = useState(false)
	const [isExpanded, setIsExpanded] = useState(false)
	const [pingMs, setPingMs] = useState<number>(0)
	const [connState, setConnState] = useState<string>('')
	const [iceConnState, setIceConnState] = useState<string>('')
	const [wasDisconnected, setWasDisconnected] = useState(false)

	
	const [isDragging, setIsDragging] = useState(false)
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [windowSize, setWindowSize] = useState({ width: 400, height: 500 })

	
	const [isFullscreen, setIsFullscreen] = useState(false)

	
	const [isResizing, setIsResizing] = useState(false)
	const [resizeDirection, setResizeDirection] = useState<string>('')
	const [resizeStart, setResizeStart] = useState({
		x: 0,
		y: 0,
		width: 0,
		height: 0,
	})
	const [lastResizeTime, setLastResizeTime] = useState(0)

	
	const [expandedVideo, setExpandedVideo] = useState<
		'local' | 'remote' | 'screen' | null
	>(null)
	const [hoverVideo, setHoverVideo] = useState<
		'local' | 'remote' | 'screen' | null
	>(null)

	
	const [remoteVolume, setRemoteVolume] = useState<number>(1)
	const [localVolume, setLocalVolume] = useState<number>(1)
	const [showVolumeSettings, setShowVolumeSettings] = useState(false)

	const [showHelpTooltip, setShowHelpTooltip] = useState(false)
	const [showSettingsPanel, setShowSettingsPanel] = useState(false)
	const [participantVolumes, setParticipantVolumes] = useState<Map<string, number>>(new Map())
	const [showHeaderHelpTooltip, setShowHeaderHelpTooltip] = useState(false)
	const [showHeaderSettingsPanel, setShowHeaderSettingsPanel] = useState(false)

	const isFullscreenSupported =
		typeof document !== 'undefined' &&
		(!!document.documentElement.requestFullscreen ||
			(document.documentElement as any).webkitRequestFullscreen ||
			(document.documentElement as any).mozRequestFullScreen ||
			(document.documentElement as any).msRequestFullscreen)

	
	useEffect(() => {
		if (typeof window !== 'undefined') {
			setPosition({
				x: window.innerWidth - 340,
				y: window.innerHeight - 420,
			})
		}
	}, [])

	
	useEffect(() => {
		const handleVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				if (wasDisconnected && callInfo.status === 'connected') {
					console.log('[ActiveCall] Tab became visible, call still connected')
					setWasDisconnected(false)
				}
				if (remoteAudioRef.current && remoteStream) {
					remoteAudioRef.current.play().catch(err => {
						console.log(
							'[ActiveCall] Could not resume audio after tab switch:',
							err,
						)
					})
				}
			} else if (document.visibilityState === 'hidden') {
				console.log('[ActiveCall] Tab hidden, call should remain active')
				setWasDisconnected(false)
			}
		}

		document.addEventListener('visibilitychange', handleVisibilityChange)
		return () => {
			document.removeEventListener('visibilitychange', handleVisibilityChange)
		}
	}, [wasDisconnected, callInfo.status, remoteStream])

	
	useEffect(() => {
		if (callInfo.status === 'connected') {
			setWasDisconnected(false)
		} else if (callInfo.status === 'ended' || callInfo.status === 'failed') {
			setWasDisconnected(true)
		}
	}, [callInfo.status])

	
	useEffect(() => {
		if (callInfo.status === 'connected' && callInfo.startTime) {
			const interval = setInterval(() => {
				const elapsed = Math.floor(
					(Date.now() - callInfo.startTime!.getTime()) / 1000,
				)
				setDuration(elapsed)
			}, 1000)
			return () => clearInterval(interval)
		}
	}, [callInfo.status, callInfo.startTime])

	
	useEffect(() => {
		if (remoteAudioRef.current) {
			remoteAudioRef.current.volume = remoteVolume
		}
	}, [remoteVolume])

	useEffect(() => {
		const el = remoteAudioRef.current
		if (!el) return
		if (remoteStream) {
			el.srcObject = remoteStream
			el.muted = false
			el.volume = remoteVolume
			const audioTracks = remoteStream.getAudioTracks()
			audioTracks.forEach(track => {
				try {
					const settings: any = {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
						noiseSuppressionLevel: 'high',
						echoCancellationLevel: 'high',
					}
					track.applyConstraints({ advanced: [settings] }).catch(() => {})
				} catch (e) {
					console.log('[ActiveCall] Could not apply audio constraints:', e)
				}
			})
			el.play().catch(() => {})
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
		}
	}, [remoteStream, callInfo.status, iceConnState])

	
	useEffect(() => {
		if (localAudioRef.current && localStream) {
			localAudioRef.current.srcObject = localStream
			localAudioRef.current.muted = true
			localAudioRef.current.play().catch(() => {})
			const audioTracks = localStream.getAudioTracks()
			audioTracks.forEach(track => {
				try {
					const settings: any = {
						echoCancellation: true,
						noiseSuppression: true,
						autoGainControl: true,
					}
					track.applyConstraints({ advanced: [settings] }).catch(() => {})
				} catch (e) {
					console.log(
						'[ActiveCall] Could not apply local audio constraints:',
						e,
					)
				}
			})
		}
	}, [localStream])

	
	useEffect(() => {
		const el = localVideoRef.current
		if (!el) return
		const hasVideo = !!videoStream?.getVideoTracks().length
		if (videoStream && hasVideo) {
			el.srcObject = videoStream
			el.muted = true
			el.play().catch(() => {})
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
		}
	}, [videoStream])

	useEffect(() => {
		const el = remoteVideoRef.current
		if (!el) return
		const hasVideo = !!remoteStream?.getVideoTracks().length
		if (remoteStream && hasVideo) {
			el.srcObject = remoteStream
			el.muted = true
			el.play().catch(() => {})
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
		}
	}, [remoteStream])

	useEffect(() => {
		const el = localScreenRef.current
		if (!el) return
		const hasVideo = !!screenStream?.getVideoTracks().length
		if (screenStream && hasVideo) {
			el.srcObject = screenStream
			el.muted = true
			el.play().catch(() => {})
		} else {
			try {
				el.pause()
			} catch {}
			el.srcObject = null
		}
	}, [screenStream])

	
	useEffect(() => {
		let timer: any
		const poll = async () => {
			try {
				const stats = await callInfo.peerConnection?.getStats()
				if (!stats) return
				let selectedId = ''
				stats.forEach(r => {
					const anyr: any = r
					if (r.type === 'transport' && anyr.selectedCandidatePairId) {
						selectedId = anyr.selectedCandidatePairId
					}
				})
				let pair: any = null
				stats.forEach(r => {
					const anyr: any = r
					if (r.type === 'candidate-pair') {
						if (selectedId ? r.id === selectedId : anyr.selected) {
							pair = anyr
						}
					}
				})
				if (pair) {
					const rtt =
						typeof pair.currentRoundTripTime === 'number'
							? pair.currentRoundTripTime * 1000
							: typeof pair.roundTripTime === 'number'
								? pair.roundTripTime * 1000
								: 0
					setPingMs(Math.max(0, Math.round(rtt)))
				}
			} catch {}
		}
		poll()
		timer = setInterval(poll, 1000)
		return () => clearInterval(timer)
	}, [callInfo.peerConnection])

	
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDragging) {
				const newX = e.clientX - dragOffset.x
				const newY = e.clientY - dragOffset.y
				const windowWidth = window.innerWidth
				const windowHeight = window.innerHeight

				const clampedX = Math.max(
					0,
					Math.min(newX, windowWidth - windowSize.width),
				)
				const clampedY = Math.max(
					0,
					Math.min(newY, windowHeight - windowSize.height),
				)

				setPosition({ x: clampedX, y: clampedY })
			}

			if (isResizing) {
				
				const now = Date.now()
				if (now - lastResizeTime < 16) return
				setLastResizeTime(now)

				const deltaX = e.clientX - resizeStart.x
				const deltaY = e.clientY - resizeStart.y

				let newWidth = resizeStart.width
				let newHeight = resizeStart.height

				if (resizeDirection.includes('e')) {
					newWidth = Math.max(280, resizeStart.width + deltaX)
				} else if (resizeDirection.includes('w')) {
					newWidth = Math.max(280, resizeStart.width - deltaX)
				}

				if (resizeDirection.includes('s')) {
					newHeight = Math.max(350, resizeStart.height + deltaY)
				} else if (resizeDirection.includes('n')) {
					newHeight = Math.max(350, resizeStart.height - deltaY)
				}

				setWindowSize({ width: newWidth, height: newHeight })

				if (resizeDirection.includes('w')) {
					setPosition(prev => ({
						...prev,
						x: resizeStart.x - (newWidth - resizeStart.width),
					}))
				}
				if (resizeDirection.includes('n')) {
					setPosition(prev => ({
						...prev,
						y: resizeStart.y - (newHeight - resizeStart.height),
					}))
				}
			}
		}

		const handleMouseUp = () => {
			setIsDragging(false)
			setIsResizing(false)
			setResizeDirection('')
			document.body.style.cursor = 'default'
			document.body.style.userSelect = 'auto'
		}

		if (isDragging || isResizing) {
			document.addEventListener('mousemove', handleMouseMove)
			document.addEventListener('mouseup', handleMouseUp)
			document.body.style.cursor = isDragging ? 'grabbing' : 'se-resize'
			document.body.style.userSelect = 'none'
		}

		return () => {
			document.removeEventListener('mousemove', handleMouseMove)
			document.removeEventListener('mouseup', handleMouseUp)
			document.body.style.cursor = 'default'
			document.body.style.userSelect = 'auto'
		}
	}, [
		isDragging,
		dragOffset,
		isResizing,
		resizeDirection,
		resizeStart,
		windowSize,
	])

	
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement)
		}
		document.addEventListener('fullscreenchange', handleFullscreenChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
		}
	}, [])

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}

	const handleEndCall = () => {
		onEndCall(callInfo.socketId)
	}

	const handleMuteToggle = () => {
		onMuteToggle()
		const el = remoteAudioRef.current
		if (el) {
			el.muted = false
			el.volume = 1
			el.play().catch(() => {})
		}
	}

	const toggleMinimize = () => {
		setIsMinimized(!isMinimized)
	}

	const handleUserInteraction = () => {
		const el = remoteAudioRef.current
		if (el && remoteStream) {
			el.muted = false
			el.volume = 1
			el.play().catch(() => {})
		}
	}

	// Drag start handler
	const handleDragStart = (e: React.MouseEvent) => {
		if (isFullscreen || isResizing) return
		e.preventDefault()
		e.stopPropagation()
		setIsDragging(true)
		const rect = callWindowRef.current?.getBoundingClientRect()
		if (rect) {
			setDragOffset({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			})
		}
	}

	// Resize start handler
	const handleResizeStart = (e: React.MouseEvent, direction: string) => {
		if (isFullscreen) return
		e.preventDefault()
		e.stopPropagation()
		setIsResizing(true)
		setResizeDirection(direction)
		setResizeStart({
			x: e.clientX,
			y: e.clientY,
			width: windowSize.width,
			height: windowSize.height,
		})
	}

	// Toggle fullscreen
	const toggleFullscreen = async () => {
		if (!callWindowRef.current) return

		if (!isFullscreen) {
			try {
				await callWindowRef.current.requestFullscreen()
				setIsFullscreen(true)
			} catch (err) {
				console.error('[ActiveCall] Could not enter fullscreen:', err)
			}
		} else {
			try {
				await document.exitFullscreen()
				setIsFullscreen(false)
			} catch (err) {
				console.error('[ActiveCall] Could not exit fullscreen:', err)
			}
		}
	}

	const hasScreenVideo =
		!!screenStream?.getVideoTracks().length ||
		!!remoteStream?.getVideoTracks().length ||
		!!videoStream?.getVideoTracks().length
	const statusLabel =
		callInfo.status === 'connected'
			? 'В сети'
			: callInfo.status === 'calling'
				? 'Звонок...'
				: callInfo.status === 'ringing'
					? 'Ожидание...'
					: 'Звонок'
	const avatarUrl = callInfo.avatarUrl
		? getAttachmentUrl(callInfo.avatarUrl)
		: ''

	// Minimized view
	if (isMinimized) {
		return (
			<div
				ref={callWindowRef}
				className='fixed z-50 w-72 bg-[#2b2d31] rounded-xl shadow-2xl border border-[#1e1f22] overflow-hidden cursor-grab active:cursor-grabbing select-none'
				style={{ left: `${position.x}px`, top: `${position.y}px` }}
				onMouseDown={handleDragStart}
			>
				<div className='flex items-center justify-between p-3'>
					<button
						onClick={e => {
							e.stopPropagation()
							toggleMinimize()
						}}
						className='flex items-center gap-3 text-left flex-1 min-w-0'
					>
						<div className='w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0'>
							{avatarUrl ? (
								<img
									src={avatarUrl}
									alt=''
									className='w-full h-full object-cover rounded-full'
								/>
							) : (
								<span>
									{(callInfo.userName || 'В').slice(0, 1).toUpperCase()}
								</span>
							)}
						</div>
						<div className='flex flex-col min-w-0'>
							<p className='text-xs font-semibold text-white truncate'>
								{callInfo.userName || 'Звонок'}
							</p>
							<p className='text-[10px] text-green-400 flex items-center gap-1'>
								<span className='w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse' />
								{formatDuration(duration)}
							</p>
						</div>
					</button>
					<div className='flex items-center gap-1'>
						<button
							onClick={e => {
								e.stopPropagation()
								toggleFullscreen()
							}}
							className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
							title='Во весь экран'
						>
							<Maximize2 className='w-4 h-4' />
						</button>
						<button
							onClick={e => {
								e.stopPropagation()
								handleMuteToggle()
							}}
							className={`p-2 rounded-lg transition-colors ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'}`}
							title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
						>
							{isMuted ? (
								<MicOff className='w-4 h-4' />
							) : (
								<Mic className='w-4 h-4' />
							)}
						</button>
						<button
							onClick={e => {
								e.stopPropagation()
								handleEndCall()
							}}
							className='p-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors'
							title='Завершить звонок'
						>
							<PhoneOff className='w-4 h-4' />
						</button>
					</div>
				</div>
			</div>
		)
	}

	// Full view
	return (
		<>
			<div
				ref={callWindowRef}
				className={`fixed z-50 bg-[#2b2d31] rounded-xl shadow-2xl border border-[#1e1f22] overflow-hidden transition-all duration-300 ${isFullscreen ? 'inset-0 w-full h-full' : ''}`}
				style={
					!isFullscreen
						? {
								left: `${position.x}px`,
								top: `${position.y}px`,
								width: `${windowSize.width}px`,
								height: `${windowSize.height}px`,
							}
						: {}
				}
				onClick={handleUserInteraction}
			>
				
				{!isFullscreen && (
					<>
						<div
							className='absolute top-0 left-0 w-3 h-3 cursor-nw-resize z-50'
							onMouseDown={e => handleResizeStart(e, 'nw')}
						/>
						<div
							className='absolute top-0 right-0 w-3 h-3 cursor-ne-resize z-50'
							onMouseDown={e => handleResizeStart(e, 'ne')}
						/>
						<div
							className='absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize z-50'
							onMouseDown={e => handleResizeStart(e, 'sw')}
						/>
						<div
							className='absolute bottom-0 right-0 w-3 h-3 cursor-se-resize z-50'
							onMouseDown={e => handleResizeStart(e, 'se')}
						/>
						<div
							className='absolute top-0 left-3 right-3 h-1 cursor-n-resize z-40'
							onMouseDown={e => handleResizeStart(e, 'n')}
						/>
						<div
							className='absolute bottom-0 left-3 right-3 h-1 cursor-s-resize z-40'
							onMouseDown={e => handleResizeStart(e, 's')}
						/>
						<div
							className='absolute left-0 top-3 bottom-3 w-1 cursor-w-resize z-40'
							onMouseDown={e => handleResizeStart(e, 'w')}
						/>
						<div
							className='absolute right-0 top-3 bottom-3 w-1 cursor-e-resize z-40'
							onMouseDown={e => handleResizeStart(e, 'e')}
						/>
					</>
				)}

				
				<div
					className='p-4 border-b border-[#1e1f22] cursor-grab active:cursor-grabbing select-none'
					onMouseDown={handleDragStart}
				>
					<div
						className='flex items-start justify-between gap-3'
						onClick={e => e.stopPropagation()}
					>
						<div className='flex items-center gap-3 min-w-0'>
							<div className='w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-bold text-base flex-shrink-0'>
								{avatarUrl ? (
									<img
										src={avatarUrl}
										alt=''
										className='w-full h-full object-cover rounded-full'
									/>
								) : (
									<span>
										{(callInfo.userName || 'В').slice(0, 1).toUpperCase()}
									</span>
								)}
							</div>
							<div className='min-w-0'>
								<p className='text-sm font-semibold truncate text-white'>
									{callInfo.userName || 'Звонок'}
								</p>
								<div className='mt-1 flex items-center gap-2 text-xs text-gray-400'>
									<span className='rounded-full bg-green-500/20 text-green-400 px-2 py-0.5'>
										{statusLabel}
									</span>
									<span className='text-gray-500'>
										{formatDuration(duration)}
									</span>
								</div>
								{pingMs > 0 && (
									<p className='mt-1 text-[10px] text-gray-500'>
										Пинг: {pingMs} мс
									</p>
								)}
							</div>
						</div>
						<div className='flex items-center gap-1'>
							<div className='relative group'>
								<button
									onMouseEnter={() => setShowHeaderHelpTooltip(true)}
									onMouseLeave={() => setShowHeaderHelpTooltip(false)}
									className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
									title='Информация о подключении'
								>
									<HelpCircle className='w-4 h-4' />
								</button>
								<div className={`absolute right-0 top-full mt-2 w-64 bg-[#1e1f22] border border-[#35373c] rounded-lg shadow-2xl z-50 p-3 transition-opacity duration-200 ${showHeaderHelpTooltip ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
									<h4 className='text-xs font-semibold text-white mb-2'>Информация о подключении</h4>
									<div className='space-y-2 text-xs'>
										<div className='flex justify-between'>
											<span className='text-gray-400'>Статус:</span>
											<span className='text-green-400 font-medium'>{statusLabel}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-gray-400'>Пинг:</span>
											<span className='text-white font-medium'>{pingMs > 0 ? `${pingMs} мс` : 'N/A'}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-gray-400'>Соединение:</span>
											<span className='text-white font-medium'>{connState || 'N/A'}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-gray-400'>ICE:</span>
											<span className='text-white font-medium'>{iceConnState || 'N/A'}</span>
										</div>
										<div className='flex justify-between'>
											<span className='text-gray-400'>Длительность:</span>
											<span className='text-white font-medium'>{formatDuration(duration)}</span>
										</div>
									</div>
								</div>
							</div>
							<div className='relative group'>
								<button
									onMouseEnter={() => setShowHeaderSettingsPanel(true)}
									onMouseLeave={() => setShowHeaderSettingsPanel(false)}
									className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
									title='Настройки звука'
								>
									<Settings2 className='w-4 h-4' />
								</button>
								<div className={`absolute right-0 top-full mt-2 w-72 bg-[#1e1f22] border border-[#35373c] rounded-lg shadow-2xl z-50 p-3 transition-opacity duration-200 ${showHeaderSettingsPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
									<h4 className='text-xs font-semibold text-white mb-2'>Громкость участников</h4>
									<div className='space-y-2'>
										<div className='text-xs'>
											<div className='flex items-center justify-between text-xs mb-1'>
												<span className='text-gray-400'>{callInfo.userName || 'Собеседник'}</span>
												<span className='text-white font-medium'>
													{Math.round(remoteVolume * 100)}%
												</span>
											</div>
											<input
												type='range'
												min='0'
												max='100'
												value={Math.round(remoteVolume * 100)}
												onChange={e => {
													const value = Number(e.target.value) / 100
													setRemoteVolume(value)
													if (remoteAudioRef.current) {
														remoteAudioRef.current.volume = value
													}
												}}
												onClick={e => e.stopPropagation()}
												className='w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500'
											/>
										</div>
									</div>
									<p className='text-[10px] text-gray-500 mt-2'>
										Громкость микрофона настраивается в системных настройках
									</p>
								</div>
							</div>
							{!isFullscreen && (
								<button
									onClick={e => {
										e.stopPropagation()
										toggleFullscreen()
									}}
									className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
									title='Во весь экран'
								>
									<Maximize2 className='w-4 h-4' />
								</button>
							)}
							{isFullscreen && (
								<button
									onClick={e => {
										e.stopPropagation()
										toggleFullscreen()
									}}
									className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
									title='Выйти из полноэкранного режима'
								>
									<Minimize2 className='w-4 h-4' />
								</button>
							)}
							<button
								onClick={e => {
									e.stopPropagation()
									toggleMinimize()
								}}
								className='p-2 text-gray-400 hover:text-white hover:bg-[#35373c] rounded-lg transition-colors'
								title='Свернуть'
							>
								<Minimize2 className='w-4 h-4' />
							</button>
						</div>
					</div>
				</div>

				
				{(hasScreenVideo || videoStream?.getVideoTracks().length) && (
					<div
						className='p-4 space-y-3'
						style={{ maxHeight: 'calc(100% - 280px)', overflowY: 'auto' }}
					>
						{screenStream?.getVideoTracks().length && (
							<div
								className={`relative rounded-lg overflow-hidden bg-[#1e1f22] ${expandedVideo === 'screen' ? 'h-64' : 'h-32'} transition-all duration-300 group`}
								onMouseEnter={() => setHoverVideo('screen')}
								onMouseLeave={() => setHoverVideo(null)}
							>
								<video
									ref={localScreenRef}
									autoPlay
									playsInline
									muted
									className='w-full h-full object-cover'
								/>
								<span className='absolute bottom-2 left-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded'>
									Ваш экран
								</span>

								{isFullscreenSupported && (
									<div
										className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${hoverVideo === 'screen' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
									>
										<button
											onClick={e => {
												e.stopPropagation()
												setExpandedVideo(
													expandedVideo === 'screen' ? null : 'screen',
												)
											}}
											className='p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110'
											title={
												expandedVideo === 'screen'
													? 'Выход из полноэкранного режима'
													: 'Во весь экран'
											}
											aria-label={
												expandedVideo === 'screen'
													? 'Выход из полноэкранного режима'
													: 'Во весь экран'
											}
											onKeyDown={e => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault()
													setExpandedVideo(
														expandedVideo === 'screen' ? null : 'screen',
													)
												}
											}}
										>
											{expandedVideo === 'screen' ? (
												<Minimize2 className='w-6 h-6' />
											) : (
												<Maximize2 className='w-6 h-6' />
											)}
										</button>
									</div>
								)}
							</div>
						)}
						{videoStream?.getVideoTracks().length && (
							<div
								className={`relative rounded-lg overflow-hidden bg-[#1e1f22] ${expandedVideo === 'local' ? 'h-64' : 'h-32'} transition-all duration-300 group`}
								onMouseEnter={() => setHoverVideo('local')}
								onMouseLeave={() => setHoverVideo(null)}
							>
								<video
									ref={localVideoRef}
									autoPlay
									playsInline
									muted
									className='w-full h-full object-cover'
								/>
								<span className='absolute bottom-2 left-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded'>
									Ваше видео
								</span>

								{isFullscreenSupported && (
									<div
										className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${hoverVideo === 'local' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
									>
										<button
											onClick={e => {
												e.stopPropagation()
												setExpandedVideo(
													expandedVideo === 'local' ? null : 'local',
												)
											}}
											className='p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110'
											title={
												expandedVideo === 'local'
													? 'Выход из полноэкранного режима'
													: 'Во весь экран'
											}
											aria-label={
												expandedVideo === 'local'
													? 'Выход из полноэкранного режима'
													: 'Во весь экран'
											}
											onKeyDown={e => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault()
													setExpandedVideo(
														expandedVideo === 'local' ? null : 'local',
													)
												}
											}}
										>
											{expandedVideo === 'local' ? (
												<Minimize2 className='w-6 h-6' />
											) : (
												<Maximize2 className='w-6 h-6' />
											)}
										</button>
									</div>
								)}
							</div>
						)}
						{remoteStream?.getVideoTracks().length && (
							<div
								className={`relative rounded-lg overflow-hidden bg-[#1e1f22] ${expandedVideo === 'remote' ? 'h-64' : 'h-32'} transition-all duration-300 group`}
								onMouseEnter={() => setHoverVideo('remote')}
								onMouseLeave={() => setHoverVideo(null)}
							>
								<video
									ref={remoteVideoRef}
									autoPlay
									playsInline
									muted
									className='w-full h-full object-cover'
								/>
								<span className='absolute bottom-2 left-2 text-xs text-white bg-black/60 px-2 py-0.5 rounded'>
									{callInfo.userName || 'Видео'}
								</span>

								{isFullscreenSupported && (
									<div
										className={`absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${hoverVideo === 'remote' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
									>
										<button
											onClick={e => {
												e.stopPropagation()
												setExpandedVideo(
													expandedVideo === 'remote' ? null : 'remote',
												)
											}}
											className='p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full text-white transition-all transform hover:scale-110'
											title={
												expandedVideo === 'remote'
													? 'Выход из полноэкранного режима'
													: 'Во весь экран'
											}
											aria-label={
												expandedVideo === 'remote'
													? 'Выход из полноэкранного режима'
													: 'Во весь экран'
											}
											onKeyDown={e => {
												if (e.key === 'Enter' || e.key === ' ') {
													e.preventDefault()
													setExpandedVideo(
														expandedVideo === 'remote' ? null : 'remote',
													)
												}
											}}
										>
											{expandedVideo === 'remote' ? (
												<Minimize2 className='w-6 h-6' />
											) : (
												<Maximize2 className='w-6 h-6' />
											)}
										</button>
									</div>
								)}
							</div>
						)}
					</div>
				)}

				
				<div className='absolute bottom-0 left-0 right-0 p-4 bg-[#2b2d31] border-t border-[#1e1f22]'>
					<div className='flex items-center justify-center gap-2 flex-wrap'>
						<button
							onClick={e => {
								e.stopPropagation()
								handleMuteToggle()
							}}
							className={`flex items-center justify-center p-3 rounded-lg transition-colors min-w-[60px] ${isMuted ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'}`}
							title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
						>
							{isMuted ? (
								<MicOff className='w-5 h-5' />
							) : (
								<Mic className='w-5 h-5' />
							)}
						</button>

						<button
							onClick={e => {
								e.stopPropagation()
								onVideoToggle()
							}}
							className={`flex items-center justify-center p-3 rounded-lg transition-colors min-w-[60px] ${!isVideoEnabled ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30' : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'}`}
							title={!isVideoEnabled ? 'Включить камеру' : 'Выключить камеру'}
						>
							{!isVideoEnabled ? (
								<VideoOff className='w-5 h-5' />
							) : (
								<Video className='w-5 h-5' />
							)}
						</button>

						{isScreenShareSupported && (
							<button
								onClick={e => {
									e.stopPropagation()
									onScreenShareToggle()
								}}
								className={`flex items-center justify-center p-3 rounded-lg transition-colors min-w-[60px] ${isScreenSharing ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'}`}
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

						<div className='relative group'>
							<button
								onMouseEnter={() => setShowHelpTooltip(true)}
								onMouseLeave={() => setShowHelpTooltip(false)}
								className={`flex items-center justify-center p-3 rounded-lg transition-colors min-w-[60px] ${showHelpTooltip ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'}`}
								title='Информация о подключении'
							>
								<HelpCircle className='w-5 h-5' />
							</button>
							<div
								className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-[#1e1f22] border border-[#35373c] rounded-lg shadow-2xl z-50 p-3 transition-opacity duration-200 ${showHelpTooltip ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
								onMouseEnter={() => setShowHelpTooltip(true)}
								onMouseLeave={() => setShowHelpTooltip(false)}
							>
								<h4 className='text-xs font-semibold text-white mb-2'>Информация о подключении</h4>
								<div className='space-y-2 text-xs'>
									<div className='flex justify-between'>
										<span className='text-gray-400'>Статус:</span>
										<span className='text-green-400 font-medium'>{statusLabel}</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-gray-400'>Пинг:</span>
										<span className='text-white font-medium'>{pingMs > 0 ? `${pingMs} мс` : 'N/A'}</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-gray-400'>Соединение:</span>
										<span className='text-white font-medium'>{connState || 'N/A'}</span>
									</div>
									<div className='flex justify-between'>
										<span className='text-gray-400'>ICE:</span>
										<span className='text-white font-medium'>{iceConnState || 'N/A'}</span>
									</div>
								</div>
							</div>
						</div>

						<div className='relative group'>
							<button
								onMouseEnter={() => setShowSettingsPanel(true)}
								onMouseLeave={() => setShowSettingsPanel(false)}
								className={`flex items-center justify-center p-3 rounded-lg transition-colors min-w-[60px] ${showSettingsPanel ? 'bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/30' : 'bg-[#1e1f22] text-gray-300 hover:bg-[#35373c]'}`}
								title='Настройки звука'
							>
								<Settings2 className='w-5 h-5' />
							</button>
							<div
								className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 bg-[#1e1f22] border border-[#35373c] rounded-lg shadow-2xl z-50 p-3 transition-opacity duration-200 ${showSettingsPanel ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
								onMouseEnter={() => setShowSettingsPanel(true)}
								onMouseLeave={() => setShowSettingsPanel(false)}
							>
								<h4 className='text-xs font-semibold text-white mb-2'>Громкость участников</h4>
								<div className='space-y-2'>
									<div className='text-xs'>
										<div className='flex items-center justify-between text-xs mb-1'>
											<span className='text-gray-400'>{callInfo.userName || 'Собеседник'}</span>
											<span className='text-white font-medium'>
												{Math.round(remoteVolume * 100)}%
											</span>
										</div>
										<input
											type='range'
											min='0'
											max='100'
											value={Math.round(remoteVolume * 100)}
											onChange={e => {
												const value = Number(e.target.value) / 100
												setRemoteVolume(value)
												if (remoteAudioRef.current) {
													remoteAudioRef.current.volume = value
												}
											}}
											onClick={e => e.stopPropagation()}
											className='w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500'
										/>
									</div>
								</div>
								<p className='text-[10px] text-gray-500 mt-2'>
									Громкость микрофона настраивается в системных настройках
								</p>
							</div>
						</div>

						<button
							onClick={e => {
								e.stopPropagation()
								handleEndCall()
							}}
							className='flex-1 flex items-center justify-center gap-2 p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors'
							title='Завершить звонок'
						>
							<PhoneOff className='w-5 h-5' />
						</button>
					</div>

					{isExpanded && (
						<div className='mt-3 pt-3 border-t border-[#1e1f22]'>
							<div className='grid grid-cols-2 gap-2 text-xs'>
								<div className='bg-[#1e1f22] rounded-lg p-2'>
									<p className='text-gray-500 mb-1'>Соединение</p>
									<p className='text-white font-medium'>{connState || 'N/A'}</p>
								</div>
								<div className='bg-[#1e1f22] rounded-lg p-2'>
									<p className='text-gray-500 mb-1'>ICE</p>
									<p className='text-white font-medium'>
										{iceConnState || 'N/A'}
									</p>
								</div>
								<div className='bg-[#1e1f22] rounded-lg p-2'>
									<p className='text-gray-500 mb-1'>Пинг</p>
									<p className='text-white font-medium'>
										{pingMs > 0 ? `${pingMs} мс` : 'N/A'}
									</p>
								</div>
								<div className='bg-[#1e1f22] rounded-lg p-2'>
									<p className='text-gray-500 mb-1'>Статус</p>
									<p className='text-green-400 font-medium'>{statusLabel}</p>
								</div>
							</div>
						</div>
					)}

					<div className='mt-3 flex justify-center'>
						<button
							onClick={e => {
								e.stopPropagation()
								setIsExpanded(!isExpanded)
							}}
							className='flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#1e1f22] hover:bg-[#35373c] text-gray-400 hover:text-white text-xs transition'
							title={isExpanded ? 'Свернуть' : 'Расширить'}
						>
							{isExpanded ? (
								<ChevronUp className='w-3 h-3' />
							) : (
								<ChevronDown className='w-3 h-3' />
							)}
							<span>{isExpanded ? 'Свернуть' : 'Расширить'}</span>
						</button>
					</div>
				</div>

				<audio ref={remoteAudioRef} autoPlay playsInline />
				<audio ref={localAudioRef} autoPlay playsInline muted />
			</div>

			
			{expandedVideo && (
				<div className='fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-4'>
					<div className='relative w-full max-w-6xl aspect-video'>
						<video
							ref={
								expandedVideo === 'local'
									? localVideoRef
									: expandedVideo === 'remote'
										? remoteVideoRef
										: localScreenRef
							}
							autoPlay
							playsInline
							muted
							className='w-full h-full object-contain'
						/>
						<div className='absolute top-4 left-4 text-sm text-white bg-black/60 px-3 py-1.5 rounded-lg'>
							{expandedVideo === 'local'
								? 'Ваше видео'
								: expandedVideo === 'remote'
									? callInfo.userName || 'Видео'
									: 'Ваш экран'}
						</div>
						<button
							onClick={() => setExpandedVideo(null)}
							className='absolute top-4 right-4 p-2 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors'
							title='Закрыть'
						>
							<X className='w-6 h-6' />
						</button>
					</div>
				</div>
			)}
		</>
	)
}

export default ActiveCall
