'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'
import {
	LuMinus as Minus,
	LuMic as Mic,
	LuMicOff as MicOff,
	LuPhoneOff as PhoneOff,
	LuUser as User,
	LuUsers as Users,
} from 'react-icons/lu'

interface ActiveGroupCallProps {
	callId: string
	participants: CallState[]
	localStream: MediaStream | null
	videoStream: MediaStream | null
	screenStream: MediaStream | null
	remoteStreams: Map<string, MediaStream>
	onEndCall: (callId: string) => void
	onMuteToggle: () => void
	onVideoToggle: () => void
	onScreenShareToggle: () => void
	isMuted: boolean
	isVideoEnabled: boolean
	isScreenSharing: boolean
	isScreenShareSupported: boolean
}

const ActiveGroupCall: React.FC<ActiveGroupCallProps> = ({
	callId,
	participants,
	localStream,
	videoStream,
	screenStream,
	remoteStreams,
	onEndCall,
	onMuteToggle,
	onVideoToggle,
	onScreenShareToggle,
	isMuted,
	isVideoEnabled,
	isScreenSharing,
	isScreenShareSupported,
}) => {
	const [duration, setDuration] = useState(0)
	const [isMinimized, setIsMinimized] = useState(false)
	const [isScreenPip, setIsScreenPip] = useState(false)
	const [isScreenFullscreen, setIsScreenFullscreen] = useState(false)
	const [isScreenZoomed, setIsScreenZoomed] = useState(false)
	const screenShareVideoRef = useRef<HTMLVideoElement | null>(null)
	const primaryVideoRef = useRef<HTMLVideoElement | null>(null)

	
	
	
	
	useEffect(() => {
		const startTime = Date.now()
		const interval = setInterval(() => {
			setDuration(Math.floor((Date.now() - startTime) / 1000))
		}, 1000)
		return () => clearInterval(interval)
	}, [])

	const formatDuration = (seconds: number): string => {
		const mins = Math.floor(seconds / 60)
		const secs = seconds % 60
		return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
	}

	const toggleMinimize = () => {
		setIsMinimized(!isMinimized)
	}
	const hasScreenVideo =
		!!screenStream?.getVideoTracks().length ||
		!!videoStream?.getVideoTracks().length ||
		Array.from(remoteStreams.values()).some(
			stream => stream.getVideoTracks().length > 0,
		)
	const screenShareDisabled = !isScreenShareSupported

	const getPrimaryVideo = () => {
		if (screenShareVideoRef.current) return screenShareVideoRef.current
		if (primaryVideoRef.current) return primaryVideoRef.current
		return null
	}

	const togglePictureInPicture = async () => {
		const video = getPrimaryVideo()
		if (!video) return
		if (
			'pictureInPictureEnabled' in document &&
			document.pictureInPictureEnabled
		) {
			if (document.pictureInPictureElement) {
				await document.exitPictureInPicture()
				setIsScreenPip(false)
				return
			}
			try {
				await (video as any).requestPictureInPicture()
				setIsScreenPip(true)
			} catch {}
		}
	}

	const toggleFullscreen = async () => {
		const root = document.documentElement
		if (document.fullscreenElement) {
			await document.exitFullscreen()
			return
		}
		try {
			await root.requestFullscreen()
		} catch {}
	}
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsScreenFullscreen(!!document.fullscreenElement)
		}
		document.addEventListener('fullscreenchange', handleFullscreenChange)
		return () => {
			document.removeEventListener('fullscreenchange', handleFullscreenChange)
		}
	}, [])

	if (isMinimized) {
		return (
			<div className='fixed left-1/2 top-4 z-40 w-[min(92vw,760px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-gradient-to-br from-black/90 via-black/80 to-zinc-900/80 px-4 py-3 text-white shadow-2xl backdrop-blur'>
				<div className='flex items-center justify-between gap-3'>
					<button
						onClick={toggleMinimize}
						className='flex items-center gap-3 text-left'
						aria-label='Развернуть'
					>
						<div className='h-9 w-9 overflow-hidden rounded-2xl bg-white/10 flex items-center justify-center text-sm font-semibold'>
							<Users className='h-5 w-5 text-white/80' />
						</div>
						<div>
							<p className='text-xs font-semibold text-white truncate'>
								Групповой звонок
							</p>
							<p className='text-[10px] text-white/60'>
								{formatDuration(duration)} · {participants.length + 1} уч.
							</p>
						</div>
					</button>
					<div className='flex items-center gap-2'>
						<button
							onClick={onMuteToggle}
							className={`rounded-xl border px-2 py-1 text-white transition ${
								isMuted
									? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
						>
							{isMuted ? <MicOff className='h-4 w-4' /> : <Mic className='h-4 w-4' />}
						</button>
						<button
							onClick={() => onEndCall(callId)}
							className='rounded-xl border border-rose-500/40 bg-rose-500/10 px-2 py-1 text-rose-200 transition hover:bg-rose-500/20'
							title='Покинуть группу'
						>
							<PhoneOff className='h-4 w-4' />
						</button>
					</div>
				</div>
			</div>
		)
	}

	return (
		<div className='fixed left-1/2 top-4 z-40 w-[min(92vw,900px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-gradient-to-br from-black/90 via-black/80 to-zinc-900/80 p-4 text-white shadow-2xl backdrop-blur'>
			<div className='flex items-start justify-between gap-3'>
				<div className='flex items-center gap-3 min-w-0'>
					<div className='h-10 w-10 overflow-hidden rounded-2xl bg-white/10 flex items-center justify-center text-sm font-semibold'>
						<Users className='h-5 w-5 text-white/80' />
					</div>
					<div className='min-w-0'>
						<p className='text-sm font-semibold truncate'>Групповой звонок</p>
						<div className='mt-1 flex items-center gap-2 text-[10px] text-white/60'>
							<span className='rounded-full bg-white/10 px-2 py-0.5 text-white/70'>
								{participants.length + 1} участников
							</span>
							<span>{formatDuration(duration)}</span>
						</div>
					</div>
				</div>
				<button
					onClick={toggleMinimize}
					className='rounded-xl border border-white/10 bg-white/5 px-2 py-1 text-white hover:bg-white/10'
					title='Свернуть'
				>
					<Minus className='h-4 w-4' />
				</button>
			</div>

			
			<div className='mt-3 max-h-32 overflow-y-auto'>
				<div className='grid grid-cols-6 gap-2'>
					
					<div className='text-center'>
						<div className='mx-auto mb-1 h-8 w-8 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold'>
							{localStream ? <Mic className='h-4 w-4' /> : <MicOff className='h-4 w-4' />}
						</div>
						<p className='text-[8px] truncate'>Вы</p>
					</div>
					
					{participants.map(participant => (
						<div key={participant.socketId} className='text-center'>
							<div className='mx-auto mb-1 h-8 w-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold'>
								{participant.avatarUrl ? (
									<img
										src={participant.avatarUrl}
										alt={participant.userName || 'Участник'}
										className='h-full w-full rounded-full object-cover'
									/>
								) : (
									<span>{participant.userName?.charAt(0) || '?'}</span>
								)}
							</div>
							<p className='text-[8px] truncate'>
								{participant.userName || 'Unknown'}
							</p>
						</div>
					))}
				</div>
			</div>

			<div className={`mt-3 grid gap-3 ${isScreenZoomed ? 'zoomed' : ''}`}>
				{screenStream?.getVideoTracks().length ? (
					<div className='rounded-2xl border border-white/10 bg-white/5 p-2'>
						<video
							ref={ref => {
								if (ref && screenStream) {
									ref.srcObject = screenStream
									ref.muted = true
									const p = ref.play()
									if (p && typeof p.catch === 'function') p.catch(() => {})
								}
								if (ref) {
									screenShareVideoRef.current = ref
									primaryVideoRef.current = ref
								}
							}}
							autoPlay
							playsInline
							muted
							className={`h-44 w-full rounded-xl bg-black object-cover ${
								isScreenZoomed ? 'scale-105' : ''
							}`}
						/>
						<span className='mt-2 block text-xs text-white/70'>Ваш экран</span>
					</div>
				) : null}
				{videoStream?.getVideoTracks().length ? (
					<div className='rounded-2xl border border-white/10 bg-white/5 p-2'>
						<video
							autoPlay
							playsInline
							muted
							ref={ref => {
								if (ref) {
									ref.srcObject = videoStream
									const p = ref.play()
									if (p && typeof p.catch === 'function') p.catch(() => {})
								}
							}}
							className='h-44 w-full rounded-xl bg-black object-cover'
						/>
						<span className='mt-2 block text-xs text-white/70'>Ваше видео</span>
					</div>
				) : null}
				<div className='rounded-2xl border border-white/10 bg-white/5 p-4 text-center'>
					<p className='text-xs text-white/60'>
						Вы {isMuted ? <MicOff className='inline h-4 w-4' /> : <Mic className='inline h-4 w-4' />}
					</p>
					<audio
						ref={ref => {
							if (ref && localStream) {
								ref.srcObject = localStream
								// Apply audio quality settings
								const audioTracks = localStream.getAudioTracks()
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
										console.log('[GroupCall] Could not apply local audio constraints:', e)
									}
								})
							}
							if (ref) {
								ref.muted = true
								const p = ref.play()
								if (p && typeof p.catch === 'function') p.catch(() => {})
							}
						}}
						autoPlay
						playsInline
						muted // Always mute local audio to prevent echo
					/>
				</div>

				{participants.map(participant => (
					<div
						key={participant.socketId}
						className='rounded-2xl border border-white/10 bg-white/5 p-3 text-center'
					>
						<div className='mx-auto mb-2 h-10 w-10 overflow-hidden rounded-2xl bg-white/10 flex items-center justify-center text-sm font-semibold'>
							{participant.avatarUrl ? (
								<img
									src={participant.avatarUrl}
									alt={participant.userName || 'Участник'}
									className='h-full w-full object-cover'
								/>
							) : (
								<span>{participant.userName?.charAt(0) || '?'}</span>
							)}
						</div>
						<p className='text-xs text-white/80'>
							{participant.userName || 'Unknown'}{' '}
							{participant.status === 'connected' ? '🔊' : '...'}
						</p>
						<audio
							ref={ref => {
								const stream = remoteStreams.get(participant.socketId)
								if (!ref) return
								if (participant.status === 'connected' && stream) {
									ref.srcObject = stream
									// Apply audio quality settings for remote audio
									const audioTracks = stream.getAudioTracks()
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
											console.log('[GroupCall] Could not apply remote audio constraints:', e)
										}
									})
									ref.muted = false
									ref.volume = 1
									const p = ref.play()
									if (p && typeof p.catch === 'function') p.catch(() => {})
								} else {
									try {
										ref.pause()
									} catch {}
									ref.srcObject = null
								}
							}}
							autoPlay
							playsInline
						/>
						{remoteStreams.get(participant.socketId)?.getVideoTracks()
							.length ? (
							<video
								ref={ref => {
									const stream = remoteStreams.get(participant.socketId)
									if (!ref) return
									if (stream) {
										ref.srcObject = stream
										ref.muted = true
										const p = ref.play()
										if (p && typeof p.catch === 'function') p.catch(() => {})
									} else {
										try {
											ref.pause()
										} catch {}
										ref.srcObject = null
									}
									if (!screenStream && !primaryVideoRef.current) {
										primaryVideoRef.current = ref
									}
								}}
								autoPlay
								playsInline
								muted
								className={`mt-2 h-32 w-full rounded-xl bg-black object-cover ${
									isScreenZoomed ? 'scale-105' : ''
								}`}
							/>
						) : (
							<div className='mt-2 flex items-center justify-center'>
								<div className='text-center'>
									<div className='mx-auto h-12 w-12 rounded-full bg-gray-700 flex items-center justify-center'>
										<User className='h-4 w-4 text-white/70' />
									</div>
									<p className='text-[10px] text-white/50 mt-1'>
										Камера выключена
									</p>
								</div>
							</div>
						)}
					</div>
				))}
			</div>

			<div className='mt-3 flex flex-wrap items-center justify-center gap-2'>
				<button
					onClick={onMuteToggle}
					className={`rounded-2xl border px-4 py-2 text-white transition ${
						isMuted
							? 'border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
							: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					{isMuted ? <MicOff className='h-4 w-4' /> : <Mic className='h-4 w-4' />}
				</button>
				{hasScreenVideo && (
					<>
						<button
							onClick={togglePictureInPicture}
							className={`rounded-2xl border px-4 py-2 text-white transition ${
								isScreenPip
									? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={isScreenPip ? 'Скрыть окно' : 'Вынести в окно'}
						>
							🗔
						</button>
						<button
							onClick={toggleFullscreen}
							className={`rounded-2xl border px-4 py-2 text-white transition ${
								isScreenFullscreen
									? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={
								isScreenFullscreen ? 'Выйти из полноэкранного' : 'Во весь экран'
							}
						>
							⛶
						</button>
						<button
							onClick={() => setIsScreenZoomed(prev => !prev)}
							className={`rounded-2xl border px-4 py-2 text-white transition ${
								isScreenZoomed
									? 'border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20'
									: 'border-white/10 bg-white/5 hover:bg-white/10'
							}`}
							title={isScreenZoomed ? 'Обычный размер' : 'Увеличить'}
						>
							🔍
						</button>
					</>
				)}

				<button
					onClick={onVideoToggle}
					className={`rounded-2xl border px-4 py-2 text-white transition ${
						isVideoEnabled
							? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
							: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
				>
					{isVideoEnabled ? '📹' : '📷'}
				</button>
				<button
					onClick={onScreenShareToggle}
					disabled={screenShareDisabled}
					className={`rounded-2xl border px-4 py-2 text-white transition ${
						screenShareDisabled
							? 'border-white/10 bg-white/5 opacity-60'
							: isScreenSharing
								? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20'
								: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={
						screenShareDisabled
							? 'Демонстрация экрана недоступна на этом устройстве'
							: isScreenSharing
								? 'Остановить демонстрацию'
								: 'Демонстрация экрана'
					}
				>
					🖥️
				</button>

				<button
					onClick={() => onEndCall(callId)}
					className='rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-rose-200 transition hover:bg-rose-500/20'
					title='Покинуть звонок'
				>
					<PhoneOff className='h-4 w-4' />
				</button>
			</div>
		</div>
	)
}

export default ActiveGroupCall
