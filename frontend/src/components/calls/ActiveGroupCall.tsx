'use client'

import React, { useEffect, useRef, useState } from 'react'
import {
	LuMic as Mic,
	LuMicOff as MicOff,
	LuMinus as Minus,
	LuPhoneOff as PhoneOff,
	LuUser as User,
	LuUsers as Users,
} from 'react-icons/lu'
import { CallState } from '../../lib/services/WebRTCService'


interface GroupParticipantAudioProps {
	status: string
	stream?: MediaStream
}

const GroupParticipantAudio: React.FC<GroupParticipantAudioProps> = ({
	status,
	stream,
}) => {
	const audioRef = useRef<HTMLAudioElement>(null)
	const trackCount = stream?.getTracks().length || 0

	useEffect(() => {
		const ref = audioRef.current
		if (!ref) return
		if (status === 'connected' && stream) {
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
	}, [stream, trackCount, status])

	return <audio ref={audioRef} autoPlay playsInline />
}

interface GroupParticipantVideoProps {
	stream?: MediaStream
	isScreenZoomed: boolean
	onVideoRef?: (ref: HTMLVideoElement | null) => void
}

const GroupParticipantVideo: React.FC<GroupParticipantVideoProps> = ({
	stream,
	isScreenZoomed,
	onVideoRef,
}) => {
	const videoRef = useRef<HTMLVideoElement>(null)
	const videoTrackCount = stream?.getVideoTracks().length || 0

	useEffect(() => {
		const ref = videoRef.current
		if (!ref) return
		if (onVideoRef) {
			onVideoRef(ref)
		}
		if (stream && videoTrackCount > 0) {
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
	}, [stream, videoTrackCount, onVideoRef])

	if (videoTrackCount === 0) {
		return (
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
		)
	}

	return (
		<video
			ref={videoRef}
			autoPlay
			playsInline
			muted
			className={`mt-2 h-32 w-full rounded-xl bg-black object-cover ${
				isScreenZoomed ? 'scale-105' : ''
			}`}
		/>
	)
}


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

	
	
	
	
	const [watchedStreamIds, setWatchedStreamIds] = useState<Set<string>>(new Set())
	const [fullscreenStreamId, setFullscreenStreamId] = useState<string | null>(null)

	const toggleWatchStream = (id: string) => {
		setWatchedStreamIds(prev => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const availableStreams: Array<{ id: string; title: string; stream: MediaStream; isLocal?: boolean }> = []

	if (screenStream?.getVideoTracks().length) {
		availableStreams.push({ id: 'local-screen', title: 'Ваш экран', stream: screenStream, isLocal: true })
	}
	if (videoStream?.getVideoTracks().length) {
		availableStreams.push({ id: 'local-webcam', title: 'Ваша камера', stream: videoStream, isLocal: true })
	}
	participants.forEach(p => {
		const remoteStream = remoteStreams.get(p.socketId)
		if (remoteStream && remoteStream.getVideoTracks().length > 0) {
			availableStreams.push({
				id: `remote-${p.socketId}`,
				title: p.userName || 'Участник',
				stream: remoteStream,
			})
		}
	})

	const activeWatchedStreams = availableStreams.filter(
		s => watchedStreamIds.has(s.id) || (watchedStreamIds.size === 0 && availableStreams.length > 0)
	)

	return (
		<div className='fixed left-1/2 top-4 z-40 w-[min(94vw,1000px)] -translate-x-1/2 rounded-3xl border border-white/10 bg-gradient-to-br from-black/95 via-black/90 to-zinc-900/90 p-4 text-white shadow-2xl backdrop-blur-xl transition-all'>
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

			{/* Participant Avatars / Webcams List */}
			<div className='mt-3 max-h-36 overflow-y-auto'>
				<div className='grid grid-cols-4 sm:grid-cols-6 gap-2'>
					{/* Local User Card */}
					<div className='text-center group relative bg-white/5 p-2 rounded-xl border border-white/10'>
						<div className='mx-auto mb-1 h-10 w-10 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-semibold overflow-hidden relative'>
							{videoStream?.getVideoTracks().length ? (
								<video
									autoPlay
									playsInline
									muted
									ref={ref => {
										if (ref) ref.srcObject = videoStream
									}}
									className='h-full w-full object-cover'
								/>
							) : (
								localStream ? <Mic className='h-4 w-4' /> : <MicOff className='h-4 w-4' />
							)}
						</div>
						<p className='text-[10px] font-medium truncate'>Вы</p>
						{videoStream?.getVideoTracks().length ? (
							<button
								onClick={() => toggleWatchStream('local-webcam')}
								className='mt-1 text-[9px] px-1.5 py-0.5 rounded bg-violet-600/60 hover:bg-violet-600 text-white w-full truncate'
							>
								{watchedStreamIds.has('local-webcam') ? 'Открепить' : 'Смотреть'}
							</button>
						) : null}
					</div>

					{/* Remote Participants */}
					{participants.map(participant => {
						const remoteStream = remoteStreams.get(participant.socketId)
						const hasVideo = !!remoteStream?.getVideoTracks().length
						const streamId = `remote-${participant.socketId}`
						const isWatched = watchedStreamIds.has(streamId)

						return (
							<div
								key={participant.socketId}
								className='text-center bg-white/5 p-2 rounded-xl border border-white/10 relative'
							>
								<div className='mx-auto mb-1 h-10 w-10 rounded-full bg-gray-700 flex items-center justify-center text-xs font-semibold overflow-hidden relative'>
									{hasVideo ? (
										<video
											autoPlay
											playsInline
											muted
											ref={ref => {
												if (ref && remoteStream) ref.srcObject = remoteStream
											}}
											className='h-full w-full object-cover'
										/>
									) : participant.avatarUrl ? (
										<img
											src={participant.avatarUrl}
											alt={participant.userName || 'Участник'}
											className='h-full w-full object-cover'
										/>
									) : (
										<span>{participant.userName?.charAt(0) || '?'}</span>
									)}
								</div>
								<p className='text-[10px] font-medium truncate'>
									{participant.userName || 'Unknown'}
								</p>

								{hasVideo && (
									<button
										onClick={() => toggleWatchStream(streamId)}
										className={`mt-1 text-[9px] px-1.5 py-0.5 rounded text-white w-full truncate transition-colors ${
											isWatched
												? 'bg-amber-600 hover:bg-amber-500'
												: 'bg-violet-600 hover:bg-violet-500'
										}`}
									>
										{isWatched ? 'Открепить' : 'Смотреть трансляцию'}
									</button>
								)}

								<GroupParticipantAudio
									status={participant.status}
									stream={remoteStream}
								/>
							</div>
						)
					})}
				</div>
			</div>

			{/* Main Video Viewport (Split Grid & Fullscreen) */}
			{availableStreams.length > 0 && (
				<div className='mt-3 space-y-2'>
					<div className='flex items-center justify-between px-1 text-xs text-gray-400'>
						<span className='font-semibold text-white/90'>
							{fullscreenStreamId
								? 'Полноэкранный режим'
								: activeWatchedStreams.length > 1
								? `Разделенный экран (${activeWatchedStreams.length} трансляций)`
								: 'Трансляция'}
						</span>
						{fullscreenStreamId && (
							<button
								onClick={() => setFullscreenStreamId(null)}
								className='px-2.5 py-1 text-[11px] bg-white/10 hover:bg-white/20 rounded-lg text-white font-medium transition-colors'
							>
								Выйти в разделенный режим
							</button>
						)}
					</div>

					{/* Streams Grid */}
					<div
						className={`grid gap-2 sm:gap-3 ${
							fullscreenStreamId
								? 'grid-cols-1'
								: activeWatchedStreams.length > 1
								? 'grid-cols-2'
								: 'grid-cols-1'
						}`}
					>
						{(fullscreenStreamId
							? availableStreams.filter(s => s.id === fullscreenStreamId)
							: activeWatchedStreams
						).map(item => (
							<div
								key={item.id}
								className={`relative rounded-2xl border border-white/15 bg-black/60 overflow-hidden shadow-lg group ${
									fullscreenStreamId ? 'h-72 sm:h-96' : 'h-36 sm:h-64'
								}`}
							>
								<video
									autoPlay
									playsInline
									muted={item.isLocal}
									ref={ref => {
										if (ref && item.stream) {
											ref.srcObject = item.stream
											const p = ref.play()
											if (p && typeof p.catch === 'function') p.catch(() => {})
										}
									}}
									className='h-full w-full object-contain bg-black'
								/>

								<div className='absolute bottom-2 left-2 right-2 flex items-center justify-between px-3 py-1.5 bg-black/70 backdrop-blur-md rounded-xl text-xs text-white'>
									<span className='font-semibold truncate max-w-[60%]'>{item.title}</span>
									<div className='flex items-center gap-2'>
										<button
											onClick={() =>
												setFullscreenStreamId(fullscreenStreamId === item.id ? null : item.id)
											}
											className='px-2 py-0.5 bg-white/15 hover:bg-white/25 rounded text-[11px] font-medium transition-colors'
											title={fullscreenStreamId === item.id ? 'Свернуть' : 'На весь экран'}
										>
											{fullscreenStreamId === item.id ? 'Свернуть' : 'Во весь экран'}
										</button>
										{!fullscreenStreamId && activeWatchedStreams.length > 1 && (
											<button
												onClick={() => toggleWatchStream(item.id)}
												className='px-2 py-0.5 bg-red-600/60 hover:bg-red-600 rounded text-[11px] font-medium transition-colors'
											>
												Закрыть
											</button>
										)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Audio Local Container */}
			<div className='hidden'>
				<audio
					ref={ref => {
						if (ref && localStream) {
							ref.srcObject = localStream
						}
					}}
					autoPlay
					playsInline
					muted
				/>
			</div>

			{/* Controls Toolbar */}
			<div className='mt-4 flex flex-wrap items-center justify-center gap-3 border-t border-white/10 pt-3'>
				<button
					onClick={onMuteToggle}
					className={`rounded-2xl border px-4 py-2 text-white font-medium text-xs transition ${
						isMuted
							? 'border-rose-500/40 bg-rose-500/20 text-rose-200 hover:bg-rose-500/30'
							: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					{isMuted ? <MicOff className='h-4 w-4 inline mr-1.5' /> : <Mic className='h-4 w-4 inline mr-1.5' />}
					{isMuted ? 'Выкл. микр.' : 'Микрофон'}
				</button>

				<button
					onClick={onVideoToggle}
					className={`rounded-2xl border px-4 py-2 text-white font-medium text-xs transition ${
						isVideoEnabled
							? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
							: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={isVideoEnabled ? 'Выключить камеру' : 'Включить камеру'}
				>
					{isVideoEnabled ? '📹 Камера вкл.' : '📷 Вкл. камеру'}
				</button>

				<button
					onClick={onScreenShareToggle}
					disabled={screenShareDisabled}
					className={`rounded-2xl border px-4 py-2 text-white font-medium text-xs transition ${
						screenShareDisabled
							? 'border-white/10 bg-white/5 opacity-60'
							: isScreenSharing
								? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30'
								: 'border-white/10 bg-white/5 hover:bg-white/10'
					}`}
					title={
						screenShareDisabled
							? 'Демонстрация недоступна'
							: isScreenSharing
								? 'Остановить демонстрацию'
								: 'Демонстрация экрана'
					}
				>
					🖥️ {isScreenSharing ? 'Стоп демка' : 'Демка экрана'}
				</button>

				<button
					onClick={() => onEndCall(callId)}
					className='rounded-2xl border border-rose-500/40 bg-rose-500/20 px-4 py-2 text-rose-200 font-medium text-xs transition hover:bg-rose-500/30'
					title='Покинуть звонок'
				>
					<PhoneOff className='h-4 w-4 inline mr-1.5' /> Выйти
				</button>
			</div>
		</div>
	)
}

export default ActiveGroupCall
