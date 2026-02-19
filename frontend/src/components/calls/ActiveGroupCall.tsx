'use client'

import React, { useEffect, useRef, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'

interface ActiveGroupCallProps {
	callId: string
	participants: CallState[]
	localStream: MediaStream | null
	screenStream: MediaStream | null
	remoteStreams: Map<string, MediaStream>
	onEndCall: (callId: string) => void
	onMuteToggle: () => void
	onScreenShareToggle: () => void
	isMuted: boolean
	isScreenSharing: boolean
	isScreenShareSupported: boolean
}

const ActiveGroupCall: React.FC<ActiveGroupCallProps> = ({
	callId,
	participants,
	localStream,
	screenStream,
	remoteStreams,
	onEndCall,
	onMuteToggle,
	onScreenShareToggle,
	isMuted,
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

	// Calculate duration based on the earliest start time or just a local timer since mount
	// Since group calls are dynamic, maybe just show how long *I* have been in the call?
	// Or we can track the start time of the group call session if we had it.
	// For now, let's track duration since this component mounted (joined call).
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
			<div className='active-call group-call minimized'>
				<div className='minimized-call-info' onClick={toggleMinimize}>
					<span className='call-icon'>👥</span>
					<span className='call-duration'>{formatDuration(duration)}</span>
					<span className='call-status'>{participants.length + 1} уч.</span>
				</div>
				<div className='minimized-controls'>
					<button
						onClick={onMuteToggle}
						className={`mute-button ${isMuted ? 'muted' : ''}`}
						title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
					>
						{isMuted ? '🔇' : '🎤'}
					</button>
					<button
						onClick={() => onEndCall(callId)}
						className='end-call-button'
						title='Покинуть группу'
					>
						📞
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className='active-call group-call'>
			<div className='call-header'>
				<div className='call-info'>
					<h3 className='call-title'>Групповой звонок</h3>
					<div className='call-meta'>
						<span className='call-duration'>{formatDuration(duration)}</span>
						<span className='call-status connected'>
							{participants.length + 1} участников
						</span>
					</div>
				</div>
				<button
					onClick={toggleMinimize}
					className='minimize-button'
					title='Свернуть'
				>
					➖
				</button>
			</div>

			<div
				className={`call-content group-grid ${isScreenZoomed ? 'zoomed' : ''}`}
			>
				{screenStream?.getVideoTracks().length ? (
					<div className='participant-card local screen-share'>
						<div className='participant-avatar'>
							<div className='avatar-placeholder'>Экран</div>
						</div>
						<div className='participant-info'>
							<span className='participant-name'>Ваш экран</span>
						</div>
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
							className={`participant-video ${isScreenZoomed ? 'zoomed' : ''}`}
						/>
					</div>
				) : null}
				{/* Local Participant */}
				<div className='participant-card local'>
					<div className='participant-avatar'>
						<div className='avatar-placeholder'>Вы</div>
					</div>
					<div className='participant-info'>
						<span className='participant-name'>Вы</span>
						<span className='participant-status'>{isMuted ? '🔇' : '🎤'}</span>
					</div>
					<audio
						ref={ref => {
							if (ref && localStream) ref.srcObject = localStream
							if (ref) {
								const p = ref.play()
								if (p && typeof p.catch === 'function') p.catch(() => {})
							}
						}}
						autoPlay
						playsInline
						muted // Always mute local audio to prevent echo
					/>
				</div>

				{/* Remote Participants */}
				{participants.map(participant => (
					<div key={participant.socketId} className='participant-card remote'>
						<div className='participant-avatar'>
							{participant.avatarUrl ? (
								<img src={participant.avatarUrl} alt={participant.userName} />
							) : (
								<div className='avatar-placeholder'>
									{participant.userName?.charAt(0) || '?'}
								</div>
							)}
						</div>
						<div className='participant-info'>
							<span className='participant-name'>
								{participant.userName || 'Unknown'}
							</span>
							<span className='participant-status'>
								{participant.status === 'connected' ? '🔊' : '...'}
							</span>
						</div>
						<audio
							ref={ref => {
								const stream = remoteStreams.get(participant.socketId)
								if (!ref) return
								if (participant.status === 'connected' && stream) {
									ref.srcObject = stream
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
								className={`participant-video ${isScreenZoomed ? 'zoomed' : ''}`}
							/>
						) : null}
					</div>
				))}
			</div>

			<div className='call-controls'>
				<button
					onClick={onMuteToggle}
					className={`mute-button icon-only ${isMuted ? 'muted' : ''}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					<span className='button-icon'>{isMuted ? '🔇' : '🎤'}</span>
				</button>
				{hasScreenVideo && (
					<>
						<button
							onClick={togglePictureInPicture}
							className={`screen-tool-button icon-only ${
								isScreenPip ? 'active' : ''
							}`}
							title={isScreenPip ? 'Скрыть окно' : 'Вынести в окно'}
						>
							<span className='button-icon'>🗔</span>
						</button>
						<button
							onClick={toggleFullscreen}
							className={`screen-tool-button icon-only ${
								isScreenFullscreen ? 'active' : ''
							}`}
							title={
								isScreenFullscreen ? 'Выйти из полноэкранного' : 'Во весь экран'
							}
						>
							<span className='button-icon'>⛶</span>
						</button>
						<button
							onClick={() => setIsScreenZoomed(prev => !prev)}
							className={`screen-tool-button icon-only ${
								isScreenZoomed ? 'active' : ''
							}`}
							title={isScreenZoomed ? 'Обычный размер' : 'Увеличить'}
						>
							<span className='button-icon'>🔍</span>
						</button>
					</>
				)}

				<button
					onClick={onScreenShareToggle}
					disabled={screenShareDisabled}
					className={`screen-share-button icon-only ${
						isScreenSharing ? 'active' : ''
					}`}
					title={
						screenShareDisabled
							? 'Демонстрация экрана недоступна на этом устройстве'
							: isScreenSharing
								? 'Остановить демонстрацию'
								: 'Демонстрация экрана'
					}
				>
					<span className='button-icon'>🖥️</span>
				</button>

				<button
					onClick={() => onEndCall(callId)}
					className='end-call-button icon-only'
					title='Покинуть звонок'
				>
					<span className='button-icon'>📞</span>
				</button>
			</div>
		</div>
	)
}

export default ActiveGroupCall
