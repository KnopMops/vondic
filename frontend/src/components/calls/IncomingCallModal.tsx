'use client'

import { getAttachmentUrl } from '@/lib/utils'
import React, { useEffect, useRef, useState } from 'react'
import { CallState } from '../../lib/services/WebRTCService'

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
	const [position, setPosition] = useState({ x: 0, y: 0 })
	const [isDragging, setIsDragging] = useState(false)
	const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
	const modalRef = useRef<HTMLDivElement>(null)

	if (!isVisible || !callerInfo) return null

	const ringtoneRef = useRef<HTMLAudioElement | null>(null)

	// Initialize position to center
	useEffect(() => {
		if (isVisible && modalRef.current) {
			const rect = modalRef.current.getBoundingClientRect()
			setPosition({
				x: (window.innerWidth - rect.width) / 2,
				y: (window.innerHeight - rect.height) / 2,
			})
		}
	}, [isVisible])

	// Dragging logic
	useEffect(() => {
		const handleMouseMove = (e: MouseEvent) => {
			if (isDragging && modalRef.current) {
				const rect = modalRef.current.getBoundingClientRect()
				let newX = e.clientX - dragOffset.x
				let newY = e.clientY - dragOffset.y

				// Runtime boundary calculation
				const maxX = window.innerWidth - rect.width
				const maxY = window.innerHeight - rect.height

				newX = Math.max(0, Math.min(newX, maxX))
				newY = Math.max(0, Math.min(newY, maxY))

				setPosition({ x: newX, y: newY })
			}
		}

		const handleMouseUp = () => {
			setIsDragging(false)
			document.body.style.cursor = 'default'
		}

		if (isDragging) {
			window.addEventListener('mousemove', handleMouseMove)
			window.addEventListener('mouseup', handleMouseUp)
		}

		return () => {
			window.removeEventListener('mousemove', handleMouseMove)
			window.removeEventListener('mouseup', handleMouseUp)
		}
	}, [isDragging, dragOffset])

	const handleMouseDown = (e: React.MouseEvent) => {
		if (modalRef.current) {
			setIsDragging(true)
			const rect = modalRef.current.getBoundingClientRect()
			setDragOffset({
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			})
			document.body.style.cursor = 'move'
		}
	}

	// Handle window resize and orientation change
	useEffect(() => {
		const handleResize = () => {
			if (modalRef.current) {
				const rect = modalRef.current.getBoundingClientRect()
				setPosition(prev => {
					const maxX = window.innerWidth - rect.width
					const maxY = window.innerHeight - rect.height
					return {
						x: Math.max(0, Math.min(prev.x, maxX)),
						y: Math.max(0, Math.min(prev.y, maxY)),
					}
				})
			}
		}

		window.addEventListener('resize', handleResize)
		window.addEventListener('orientationchange', handleResize)
		return () => {
			window.removeEventListener('resize', handleResize)
			window.removeEventListener('orientationchange', handleResize)
		}
	}, [])

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
			<div
				ref={modalRef}
				className='incoming-call-modal draggable'
				style={{
					position: 'fixed',
					left: `${position.x}px`,
					top: `${position.y}px`,
					margin: 0, // Reset margin since we use absolute positioning
					cursor: isDragging ? 'grabbing' : 'move',
				}}
				onMouseDown={handleMouseDown}
			>
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
