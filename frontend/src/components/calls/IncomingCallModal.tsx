'use client'

import { getAttachmentUrl } from '@/lib/utils'
import { FiHelpCircle as HelpCircle } from 'react-icons/fi'
import { LuSettings2 as Settings2 } from 'react-icons/lu'
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
	const dragOffsetRef = useRef({ x: 0, y: 0 })
	const pendingPosRef = useRef({ x: 0, y: 0 })
	const rafRef = useRef<number | null>(null)
	const modalRef = useRef<HTMLDivElement>(null)

	if (!isVisible || !callerInfo) return null

	const ringtoneRef = useRef<HTMLAudioElement | null>(null)

	useEffect(() => {
		if (isVisible && modalRef.current) {
			const rect = modalRef.current.getBoundingClientRect()
			setPosition({
				x: (window.innerWidth - rect.width) / 2,
				y: (window.innerHeight - rect.height) / 2,
			})
		}
	}, [isVisible])

	useEffect(() => {
		const apply = (x: number, y: number) => {
			if (!modalRef.current) return
			modalRef.current.style.left = `${x}px`
			modalRef.current.style.top = `${y}px`
		}

		const scheduleApply = () => {
			if (rafRef.current) return
			rafRef.current = requestAnimationFrame(() => {
				rafRef.current = null
				apply(pendingPosRef.current.x, pendingPosRef.current.y)
			})
		}

		const handlePointerMove = (e: PointerEvent) => {
			if (!isDragging || !modalRef.current) return
			const rect = modalRef.current.getBoundingClientRect()
			const maxX = window.innerWidth - rect.width
			const maxY = window.innerHeight - rect.height
			const newX = Math.max(
				0,
				Math.min(e.clientX - dragOffsetRef.current.x, maxX),
			)
			const newY = Math.max(
				0,
				Math.min(e.clientY - dragOffsetRef.current.y, maxY),
			)
			pendingPosRef.current = { x: newX, y: newY }
			scheduleApply()
		}

		const handlePointerUp = () => {
			if (!isDragging) return
			setIsDragging(false)
			setPosition({ ...pendingPosRef.current })
			document.body.style.cursor = 'default'
			document.body.style.userSelect = ''
		}

		window.addEventListener('pointermove', handlePointerMove, { passive: true })
		window.addEventListener('pointerup', handlePointerUp)
		return () => {
			window.removeEventListener('pointermove', handlePointerMove)
			window.removeEventListener('pointerup', handlePointerUp)
			if (rafRef.current) cancelAnimationFrame(rafRef.current)
		}
	}, [isDragging])

	const handleMouseDown = (e: React.PointerEvent) => {
		if (modalRef.current) {
			setIsDragging(true)
			const rect = modalRef.current.getBoundingClientRect()
			dragOffsetRef.current = {
				x: e.clientX - rect.left,
				y: e.clientY - rect.top,
			}
			pendingPosRef.current = { ...position }
			document.body.style.cursor = 'move'
			document.body.style.userSelect = 'none'
		}
	}

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
				onPointerDown={handleMouseDown}
			>
				<div
					className='modal-header'
					style={{
						display: 'flex',
						justifyContent: 'between',
						alignItems: 'center',
					}}
				>
					<h2>Входящий звонок</h2>
					<div className='header-icons' style={{ display: 'flex', gap: '8px' }}>
						<button className='icon-button' title='Помощь'>
							<HelpCircle size={18} color='gray' />
						</button>
						<button className='icon-button' title='Настройки'>
							<Settings2 size={18} color='gray' />
						</button>
					</div>
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
