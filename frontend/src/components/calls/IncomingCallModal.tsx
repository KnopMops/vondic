'use client'

import React, { useEffect, useRef } from 'react'
import { CallState } from '../../lib/services/WebRTCService'
import { getAttachmentUrl } from '@/lib/utils'

interface IncomingCallModalProps {
	callerInfo: CallState | null
	onAccept: (callerSocketId: string) => void
	onReject: (callerSocketId: string) => void
	isVisible: boolean
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
	callerInfo,
	onAccept,
	onReject,
	isVisible,
}) => {
	if (!isVisible || !callerInfo) return null

	const ringtoneRef = useRef<HTMLAudioElement | null>(null)
	useEffect(() => {
		if (isVisible) {
			if (!ringtoneRef.current) {
				const src = getAttachmentUrl('/static/rington.wav')
				const el = new Audio(src)
				el.loop = true
				el.volume = 1
				ringtoneRef.current = el
			}
			const el = ringtoneRef.current!
			el.currentTime = 0
			el.play().catch(() => {})
		} else {
			const el = ringtoneRef.current
			if (el) {
				try {
					el.pause()
					el.currentTime = 0
				} catch {}
			}
		}
		return () => {
			const el = ringtoneRef.current
			if (el) {
				try {
					el.pause()
					el.currentTime = 0
				} catch {}
			}
		}
	}, [isVisible, callerInfo?.socketId])

	const handleAccept = () => {
		const el = ringtoneRef.current
		if (el) {
			try {
				el.pause()
				el.currentTime = 0
			} catch {}
		}
		onAccept(callerInfo.socketId)
	}

	const handleReject = () => {
		const el = ringtoneRef.current
		if (el) {
			try {
				el.pause()
				el.currentTime = 0
			} catch {}
		}
		onReject(callerInfo.socketId)
	}

	return (
		<div className='modal-overlay'>
			<div className='incoming-call-modal'>
				<div className='modal-header'>
					<h2>Входящий звонок</h2>
				</div>

				<div className='caller-info'>
					<div className='caller-avatar'>
						{callerInfo.avatarUrl ? (
							<img
								src={callerInfo.avatarUrl}
								alt={callerInfo.userName || 'Caller'}
								className='avatar-placeholder'
								style={{ objectFit: 'cover' }}
							/>
						) : (
							<div className='avatar-placeholder'>
								{callerInfo.isGroupCall ? '👥' : '👤'}
							</div>
						)}
					</div>
					<div className='caller-details'>
						<h3 className='caller-name'>
							{callerInfo.userName || 'Неизвестный пользователь'}
						</h3>
						<p className='call-status'>
							{callerInfo.isGroupCall ? 'Групповой звонок...' : 'Звонит вам...'}
						</p>
					</div>
				</div>

				<div className='call-animation'>
					<div className='pulse-ring'></div>
					<div className='pulse-ring'></div>
					<div className='pulse-ring'></div>
				</div>

				<div className='call-controls'>
					<button
						onClick={handleReject}
						className='reject-button'
						title='Отклонить звонок'
					>
						<span className='button-icon'>❌</span>
						<span className='button-text'>Отклонить</span>
					</button>
					<button
						onClick={handleAccept}
						className='accept-button'
						title='Принять звонок'
					>
						<span className='button-icon'>✅</span>
						<span className='button-text'>Принять</span>
					</button>
				</div>
			</div>
		</div>
	)
}

export default IncomingCallModal
