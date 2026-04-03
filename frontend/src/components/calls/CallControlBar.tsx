'use client'

import React, { useRef, useEffect, useState } from 'react'
import { useCallStore } from '../../lib/stores/callStore'
import { PhoneOffIcon, MicIcon, MicOffIcon, VideoIcon, VideoOffIcon, MonitorIcon, MonitorOffIcon, UsersIcon, MaximizeIcon, MinimizeIcon, WifiIcon, WifiOffIcon, ActivityIcon, ClockIcon, Volume2Icon, VolumeXIcon, HelpCircleIcon } from 'lucide-react'

interface CallControlBarProps {
	participantName: string
	isGroupCall?: boolean
}

export const CallControlBar: React.FC<CallControlBarProps> = ({
	participantName,
	isGroupCall = false,
}) => {
	const {
		isMuted,
		isVideoEnabled,
		isScreenSharing,
		isScreenShareSupported,
		endCall,
		toggleMute,
		toggleVideo,
		toggleScreenShare,
		activeCalls,
		remoteStreams,
		localStream,
		screenStream,
	} = useCallStore()

	const [duration, setDuration] = useState(0)
	const [isVideoExpanded, setIsVideoExpanded] = useState(false)
	const [showConnectionInfo, setShowConnectionInfo] = useState(false)
	const [fullscreenElement, setFullscreenElement] = useState<'remote' | 'local' | 'screen' | null>(null)
	const remoteVideoRef = useRef<HTMLVideoElement>(null)
	const localVideoRef = useRef<HTMLVideoElement>(null)
	const screenVideoRef = useRef<HTMLVideoElement>(null)
	const remoteAudioRef = useRef<HTMLAudioElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)

	const handleEndCall = () => {
		const { activeGroupCallId } = useCallStore.getState()

		
		if (isGroupCall && activeGroupCallId) {
			const { leaveGroupCall } = useCallStore.getState()
			leaveGroupCall(activeGroupCallId)
		} else {
			
			const calls = Array.from(activeCalls.values())
			calls.forEach(call => {
				endCall(call.socketId)
			})
		}
	}

	
	const enterFullscreen = (element: 'remote' | 'local' | 'screen') => {
		setFullscreenElement(element)
	}

	const exitFullscreen = () => {
		setFullscreenElement(null)
	}

	const toggleFullscreen = (element: 'remote' | 'local' | 'screen') => {
		if (fullscreenElement === element) {
			exitFullscreen()
		} else {
			enterFullscreen(element)
		}
	}

	const participantCount = activeCalls.size
	const showParticipantCount = isGroupCall && participantCount > 1

	
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

	// Setup remote video and audio
	useEffect(() => {
		// For group calls, get all remote streams
		// For direct calls, get the single remote stream
		const streamsToProcess: Map<string, MediaStream> = new Map()

		if (isGroupCall) {
			// Get all remote streams for group calls
			remoteStreams.forEach((stream, socketId) => {
				streamsToProcess.set(socketId, stream)
			})
		} else {
			// Get single remote stream for direct calls
			const call = Array.from(activeCalls.values()).find(c => !c.isGroupCall)
			if (call) {
				const remoteStream = remoteStreams.get(call.socketId)
				if (remoteStream) {
					streamsToProcess.set(call.socketId, remoteStream)
				}
			}
		}

		// Process all streams
		streamsToProcess.forEach((remoteStream, socketId) => {
			if (remoteStream) {
				// Setup audio first with enhanced processing
				if (remoteAudioRef.current) {
					remoteAudioRef.current.srcObject = remoteStream
					remoteAudioRef.current.muted = false
					remoteAudioRef.current.volume = 1.0

					// Enhanced audio playback settings for better quality
					const audio: any = remoteAudioRef.current
					
					// Disable pitch preservation for natural voice reproduction
					if ('mozPreservesPitch' in audio) {
						audio.mozPreservesPitch = false
					}
					if ('webkitPreservesPitch' in audio) {
						audio.webkitPreservesPitch = false
					}
					if ('preservesPitch' in audio) {
						audio.preservesPitch = false
					}
					
					// Set high-quality playback
					audio.preload = 'auto'
					
					// Force play with error handling and retry logic
					const playAudio = async () => {
						try {
							await remoteAudioRef.current!.play()
							console.log('[CallControlBar] Remote audio playing successfully')
						} catch (err) {
							console.error('Failed to play remote audio:', err)
							// Try again on user interaction
							const handleInteraction = () => {
								remoteAudioRef.current?.play().catch(() => {})
								document.removeEventListener('click', handleInteraction)
								document.removeEventListener('keydown', handleInteraction)
							}
							document.addEventListener('click', handleInteraction, { once: true })
							document.addEventListener('keydown', handleInteraction, { once: true })
						}
					}
					playAudio()
				}

				// Setup video only if it has video tracks
				const hasVideoTracks = remoteStream.getVideoTracks().length > 0
				if (remoteVideoRef.current && hasVideoTracks) {
					remoteVideoRef.current.srcObject = remoteStream
					remoteVideoRef.current.play().catch(() => {})
				} else if (remoteVideoRef.current && !hasVideoTracks) {
					// Clear video if no video tracks
					remoteVideoRef.current.srcObject = null
				}
			}
		})

		// No remote stream - clear everything
		if (streamsToProcess.size === 0) {
			if (remoteAudioRef.current) {
				remoteAudioRef.current.srcObject = null
			}
			if (remoteVideoRef.current) {
				remoteVideoRef.current.srcObject = null
			}
		}
	}, [remoteStreams, activeCalls, isGroupCall])

	// Setup local video
	useEffect(() => {
		if (localVideoRef.current && localStream && isVideoEnabled()) {
			localVideoRef.current.srcObject = localStream
			localVideoRef.current.play().catch(() => {})
		} else if (localVideoRef.current && !isVideoEnabled()) {
			// Clear local video when camera is off
			localVideoRef.current.srcObject = null
		}
	}, [localStream, isVideoEnabled])

	// Setup screen share video
	useEffect(() => {
		if (screenVideoRef.current && screenStream) {
			screenVideoRef.current.srcObject = screenStream
			screenVideoRef.current.muted = true
			screenVideoRef.current.play().catch(() => {})
		} else if (screenVideoRef.current && !screenStream) {
			// Clear screen share video when stopped
			screenVideoRef.current.srcObject = null
		}
	}, [screenStream])

	const hasRemoteVideo = Array.from(remoteStreams.values()).some(stream => {
		const videoTracks = stream.getVideoTracks()
		return videoTracks.length > 0 && videoTracks[0].enabled
	})
	const hasLocalVideo = (localStream?.getVideoTracks().length ?? 0) > 0 && isVideoEnabled()
	const hasScreenShare = screenStream !== null
	const hasAudio = Array.from(remoteStreams.values()).some(stream => stream.getAudioTracks().length > 0)

	// Mock connection info (in real implementation, get from WebRTC stats)
	const connectionInfo = {
		status: 'connected' as const,
		ping: 45,
		localTracks: localStream?.getTracks().length ?? 0,
		remoteTracks: Array.from(remoteStreams.values()).reduce((acc, stream) => acc + stream.getTracks().length, 0),
		iceConnectionState: 'connected' as const,
		signalingState: 'stable' as const,
	}

	return (
		<div className={`w-full bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-xl animate-in fade-in duration-300 ${isVideoExpanded ? 'p-6' : 'p-4'}`} ref={containerRef}>
			
			{(hasRemoteVideo || hasLocalVideo || hasScreenShare) && (
				<div className='mb-4 relative'>
					<div className={`grid gap-3 ${
						isVideoExpanded
							? 'grid-cols-2'
							: hasScreenShare
								? 'grid-cols-1'
								: 'grid-cols-1'
					}`}>
						
						{hasScreenShare && screenStream && (
							<div className='relative bg-gray-800 rounded-lg overflow-hidden aspect-video'>
								<video
									ref={screenVideoRef}
									autoPlay
									playsInline
									muted
									className='w-full h-full object-contain'
								/>
								<div className='absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white flex items-center gap-1.5'>
									<MonitorIcon className='w-3 h-3 text-emerald-400' />
									Демонстрация экрана
								</div>
								
								<div className='absolute top-2 right-2 px-2 py-1 bg-emerald-600 rounded-full text-xs text-white font-medium flex items-center gap-1 animate-pulse'>
									<span className='w-1.5 h-1.5 rounded-full bg-white' />
									LIVE
								</div>
								
								<button
									onClick={() => toggleFullscreen('screen')}
									className='absolute top-2 right-2 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-white transition-colors'
									title={fullscreenElement === 'screen' ? 'Выйти из полноэкранного режима' : 'Во весь экран'}
								>
									{fullscreenElement === 'screen' ? (
										<MinimizeIcon className='w-4 h-4' />
									) : (
										<MaximizeIcon className='w-4 h-4' />
									)}
								</button>
							</div>
						)}

						
						{hasRemoteVideo && remoteStreams.size > 0 && !hasScreenShare && (
							<div className='relative bg-gray-800 rounded-lg overflow-hidden aspect-video'>
								<video
									ref={remoteVideoRef}
									autoPlay
									playsInline
									className='w-full h-full object-cover'
								/>
								<div className='absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white'>
									{participantName}
								</div>
								
								<button
									onClick={() => toggleFullscreen('remote')}
									className='absolute top-2 right-2 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-white transition-colors'
									title={fullscreenElement === 'remote' ? 'Выйти из полноэкранного режима' : 'Во весь экран'}
								>
									{fullscreenElement === 'remote' ? (
										<MinimizeIcon className='w-4 h-4' />
									) : (
										<MaximizeIcon className='w-4 h-4' />
									)}
								</button>
							</div>
						)}

						
						{hasLocalVideo && localStream && !hasScreenShare && (
							<div className='relative bg-gray-800 rounded-lg overflow-hidden aspect-video'>
								<video
									ref={localVideoRef}
									autoPlay
									playsInline
									muted
									className='w-full h-full object-cover transform scale-x-[-1]'
								/>
								<div className='absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white'>
									Вы
								</div>
								
								<button
									onClick={() => toggleFullscreen('local')}
									className='absolute top-2 right-2 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-white transition-colors'
									title={fullscreenElement === 'local' ? 'Выйти из полноэкранного режима' : 'Во весь экран'}
								>
									{fullscreenElement === 'local' ? (
										<MinimizeIcon className='w-4 h-4' />
									) : (
										<MaximizeIcon className='w-4 h-4' />
									)}
								</button>
							</div>
						)}
					</div>

					
					<button
						onClick={() => setIsVideoExpanded(!isVideoExpanded)}
						className='absolute top-2 right-2 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-lg text-white transition-colors'
						title={isVideoExpanded ? 'Свернуть' : 'Развернуть'}
					>
						{isVideoExpanded ? (
							<MinimizeIcon className='w-4 h-4' />
						) : (
							<MaximizeIcon className='w-4 h-4' />
						)}
					</button>
				</div>
			)}

			
			{fullscreenElement && (
				<div className='fixed inset-0 bg-black/95 z-[100] flex items-center justify-center'>
					
					<button
						onClick={exitFullscreen}
						className='absolute top-4 right-4 p-3 bg-gray-800/80 hover:bg-gray-700 rounded-full text-white transition-colors z-[101]'
						title='Выйти из полноэкранного режима'
					>
						<MinimizeIcon className='w-6 h-6' />
					</button>

					
					<div className='w-full h-full flex items-center justify-center p-4'>
						{fullscreenElement === 'screen' && screenStream && (
							<video
								ref={el => {
									if (el && screenVideoRef.current) {
										el.srcObject = screenVideoRef.current.srcObject
										el.play().catch(() => {})
									}
								}}
								autoPlay
								playsInline
								muted
								className='max-w-full max-h-full object-contain'
							/>
						)}
						{fullscreenElement === 'remote' && remoteStreams.size > 0 && (
							<video
								ref={el => {
									if (el && remoteVideoRef.current) {
										el.srcObject = remoteVideoRef.current.srcObject
										el.play().catch(() => {})
									}
								}}
								autoPlay
								playsInline
								className='max-w-full max-h-full object-contain'
							/>
						)}
						{fullscreenElement === 'local' && localStream && (
							<video
								ref={el => {
									if (el && localVideoRef.current) {
										el.srcObject = localVideoRef.current.srcObject
										el.play().catch(() => {})
									}
								}}
								autoPlay
								playsInline
								muted
								className='max-w-full max-h-full object-contain transform scale-x-[-1]'
							/>
						)}
					</div>

					
					<div className='absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black/60 rounded-full text-white text-sm font-medium'>
						{fullscreenElement === 'screen' && 'Демонстрация экрана'}
						{fullscreenElement === 'remote' && participantName}
						{fullscreenElement === 'local' && 'Вы (камера)'}
					</div>
				</div>
			)}

			
			<audio
				ref={remoteAudioRef}
				autoPlay
				playsInline
				muted={false}
				style={{ display: 'none' }}
			/>

			
			<div className='flex items-center justify-between mb-4'>
				<div className='flex items-center gap-4'>
					<div className='w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-emerald-500/20'>
						{isGroupCall ? <UsersIcon className='w-6 h-6' /> : participantName.charAt(0).toUpperCase()}
					</div>
					<div className='flex flex-col'>
						<span className='text-white font-bold text-base'>
							{isGroupCall ? 'Групповой звонок' : participantName}
						</span>
						<span className='text-xs text-emerald-400 flex items-center gap-1.5'>
							<span className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
							{isMuted ? 'Микрофон выключен' : isVideoEnabled() ? 'Видео включено' : 'В звонке'}
							{showParticipantCount && (
								<span className='ml-2 px-2 py-0.5 bg-gray-800 rounded-full text-[10px]'>
									{participantCount} участников
								</span>
							)}
						</span>
					</div>
				</div>

				<div className='flex items-center gap-2'>
					
					<div className='relative'>
						<button
							onMouseEnter={() => setShowConnectionInfo(true)}
							onMouseLeave={() => setShowConnectionInfo(false)}
							className='p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors'
							title='Информация о подключении'
						>
							<HelpCircleIcon className='w-4 h-4' />
						</button>

						{showConnectionInfo && (
							<div className='absolute right-0 top-full mt-2 w-64 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-200'>
								<h4 className='text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3'>
									Информация о подключении
								</h4>
								<div className='space-y-2 text-xs'>
									<div className='flex items-center justify-between'>
										<span className='text-gray-500 flex items-center gap-2'>
											<ActivityIcon className='w-3 h-3' />
											Статус
										</span>
										<span className='text-emerald-400 font-medium flex items-center gap-1.5'>
											<span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
											Подключено
										</span>
									</div>
									<div className='flex items-center justify-between'>
										<span className='text-gray-500 flex items-center gap-2'>
											<WifiIcon className='w-3 h-3' />
											Пинг
										</span>
										<span className='text-white font-mono'>{connectionInfo.ping} мс</span>
									</div>
									<div className='flex items-center justify-between'>
										<span className='text-gray-500 flex items-center gap-2'>
											<Volume2Icon className='w-3 h-3' />
											Локальные треки
										</span>
										<span className='text-white font-mono'>{connectionInfo.localTracks}</span>
									</div>
									<div className='flex items-center justify-between'>
										<span className='text-gray-500 flex items-center gap-2'>
											<VolumeXIcon className='w-3 h-3' />
											Удалённые треки
										</span>
										<span className='text-white font-mono'>{connectionInfo.remoteTracks}</span>
									</div>
									{hasAudio && (
										<div className='flex items-center justify-between'>
											<span className='text-gray-500 flex items-center gap-2'>
												<Volume2Icon className='w-3 h-3' />
												Аудио
											</span>
											<span className='text-emerald-400 font-medium'>Включено</span>
										</div>
									)}
								</div>
							</div>
						)}
					</div>

					
					<div className='flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg'>
						<ClockIcon className='w-3 h-3 text-emerald-500' />
						<span className='text-xs text-gray-400 font-mono'>{formatDuration(duration)}</span>
					</div>
				</div>
			</div>

			
			<div className='h-px bg-gray-800 mb-4' />

			
			<div className='flex items-center justify-center gap-3'>
				
				<button
					onClick={toggleMute}
					className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
						isMuted
							? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
							: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
					}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					{isMuted ? (
						<MicOffIcon className='w-5 h-5' />
					) : (
						<MicIcon className='w-5 h-5' />
					)}
					<span className='text-xs font-medium hidden sm:inline'>
						{isMuted ? 'Включить' : 'Выключить'}
					</span>
				</button>

				
				<button
					onClick={toggleVideo}
					className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
						!isVideoEnabled()
							? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
							: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
					}`}
					title={!isVideoEnabled() ? 'Включить камеру' : 'Выключить камеру'}
				>
					{!isVideoEnabled() ? (
						<VideoOffIcon className='w-5 h-5' />
					) : (
						<VideoIcon className='w-5 h-5' />
					)}
					<span className='text-xs font-medium hidden sm:inline'>
						{!isVideoEnabled() ? 'Включить' : 'Выключить'}
					</span>
				</button>

				
				{isScreenShareSupported && (
					<button
						onClick={toggleScreenShare}
						className={`flex items-center gap-2 px-4 py-3 rounded-xl transition-all ${
							isScreenSharing
								? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
								: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
						}`}
						title={isScreenSharing ? 'Остановить демонстрацию' : 'Демонстрация экрана'}
					>
						{isScreenSharing ? (
							<MonitorOffIcon className='w-5 h-5' />
						) : (
							<MonitorIcon className='w-5 h-5' />
						)}
						<span className='text-xs font-medium hidden sm:inline'>
							{isScreenSharing ? 'Стоп' : 'Экран'}
						</span>
					</button>
				)}

				
				<button
					onClick={handleEndCall}
					className='flex items-center gap-2 px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl transition-all hover:scale-105 shadow-lg shadow-rose-600/20'
					title='Завершить звонок'
				>
					<PhoneOffIcon className='w-5 h-5' />
					<span className='text-xs font-medium hidden sm:inline'>
						Завершить
					</span>
				</button>
			</div>
		</div>
	)
}
