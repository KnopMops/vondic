import React, { useEffect, useRef, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'

interface ActiveCallProps {
	callInfo: CallState
	onEndCall: (socketId: string) => void
	onMuteToggle: () => void
	isMuted: boolean
	localStream: MediaStream | null
	remoteStream: MediaStream | null
}

const ActiveCall: React.FC<ActiveCallProps> = ({
	callInfo,
	onEndCall,
	onMuteToggle,
	isMuted,
	localStream,
	remoteStream,
}) => {
	const remoteAudioRef = useRef<HTMLAudioElement>(null)
	const localAudioRef = useRef<HTMLAudioElement>(null)
	const [duration, setDuration] = useState(0)
	const [isMinimized, setIsMinimized] = useState(false)

	// Обновление длительности звонка
	useEffect(() => {
		if (callInfo.status === 'connected' && callInfo.startTime) {
			const interval = setInterval(() => {
				const elapsed = Math.floor((Date.now() - callInfo.startTime!.getTime()) / 1000)
				setDuration(elapsed)
			}, 1000)

			return () => clearInterval(interval)
		}
	}, [callInfo.status, callInfo.startTime])

	// Настройка аудио элементов
	useEffect(() => {
		if (remoteAudioRef.current && remoteStream) {
			remoteAudioRef.current.srcObject = remoteStream
		}
	}, [remoteStream])

	useEffect(() => {
		if (localAudioRef.current && localStream) {
			localAudioRef.current.srcObject = localStream
		}
	}, [localStream])

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
	}

	const toggleMinimize = () => {
		setIsMinimized(!isMinimized)
	}

	if (isMinimized) {
		return (
			<div className="active-call minimized">
				<div className="minimized-call-info" onClick={toggleMinimize}>
					<span className="call-icon">📞</span>
					<span className="call-duration">{formatDuration(duration)}</span>
					<span className="call-status">{callInfo.status}</span>
				</div>
				<div className="minimized-controls">
					<button
						onClick={handleMuteToggle}
						className={`mute-button ${isMuted ? 'muted' : ''}`}
						title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
					>
						{isMuted ? '🔇' : '🎤'}
					</button>
					<button
						onClick={handleEndCall}
						className="end-call-button"
						title="Завершить звонок"
					>
						📞
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className="active-call">
			<div className="call-header">
				<div className="call-info">
					<h3 className="call-title">
						{callInfo.status === 'connected' ? 'Звонок с' : 'Звоним'} {callInfo.userName || 'Неизвестный пользователь'}
					</h3>
					<div className="call-meta">
						<span className="call-duration">{formatDuration(duration)}</span>
						<span className={`call-status status-${callInfo.status}`}>
							{callInfo.status === 'calling' && 'Вызов...'}
							{callInfo.status === 'ringing' && 'Гудит...'}
							{callInfo.status === 'connected' && 'Соединение установлено'}
							{callInfo.status === 'ended' && 'Завершено'}
							{callInfo.status === 'rejected' && 'Отклонено'}
							{callInfo.status === 'failed' && 'Ошибка'}
						</span>
					</div>
				</div>
				<button
					onClick={toggleMinimize}
					className="minimize-button"
					title="Свернуть"
				>
					➖
				</button>
			</div>
			
			<div className="call-content">
				<div className="audio-visualization">
					<div className="local-audio-indicator">
						<div className={`audio-level ${isMuted ? 'muted' : 'active'}`}>
							<span className="audio-icon">{isMuted ? '🔇' : '🎤'}</span>
							<span className="audio-label">Вы</span>
						</div>
					</div>
					
					<div className="remote-audio-indicator">
						<div className={`audio-level ${remoteStream ? 'active' : 'inactive'}`}>
							<span className="audio-icon">🔊</span>
							<span className="audio-label">{callInfo.userName || 'Собеседник'}</span>
						</div>
					</div>
				</div>
			</div>
			
			<div className="call-controls">
				<button
					onClick={handleMuteToggle}
					className={`mute-button ${isMuted ? 'muted' : ''}`}
					title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
				>
					<span className="button-icon">{isMuted ? '🔇' : '🎤'}</span>
					<span className="button-text">{isMuted ? 'Включить' : 'Выключить'}</span>
				</button>
				
				<button
					onClick={handleEndCall}
					className="end-call-button"
					title="Завершить звонок"
				>
					<span className="button-icon">📞</span>
					<span className="button-text">Завершить</span>
				</button>
			</div>
			
			{/* Скрытые аудио элементы */}
			<audio
				ref={remoteAudioRef}
				autoPlay
				playsInline
			/>
			<audio
				ref={localAudioRef}
				autoPlay
				playsInline
				muted
			/>
		</div>
	)
}

export default ActiveCall
