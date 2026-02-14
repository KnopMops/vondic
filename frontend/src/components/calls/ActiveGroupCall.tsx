'use client'

import React, { useEffect, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'

interface ActiveGroupCallProps {
	callId: string
	participants: CallState[]
	localStream: MediaStream | null
	remoteStreams: Map<string, MediaStream>
	onEndCall: (callId: string) => void
	onMuteToggle: () => void
	isMuted: boolean
}

const ActiveGroupCall: React.FC<ActiveGroupCallProps> = ({
	callId,
	participants,
	localStream,
	remoteStreams,
	onEndCall,
	onMuteToggle,
	isMuted,
}) => {
	const [duration, setDuration] = useState(0)
	const [isMinimized, setIsMinimized] = useState(false)

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

			<div className='call-content group-grid'>
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
					</div>
				))}
			</div>

			<div className='call-controls'>
				<button
					onClick={onMuteToggle}
					className={`mute-button ${isMuted ? 'muted' : ''}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					<span className='button-icon'>{isMuted ? '🔇' : '🎤'}</span>
					<span className='button-text'>
						{isMuted ? 'Включить' : 'Выключить'}
					</span>
				</button>

				<button
					onClick={() => onEndCall(callId)}
					className='end-call-button'
					title='Покинуть звонок'
				>
					<span className='button-icon'>📞</span>
					<span className='button-text'>Покинуть</span>
				</button>
			</div>
		</div>
	)
}

export default ActiveGroupCall
