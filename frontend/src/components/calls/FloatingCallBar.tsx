'use client'

import React from 'react'
import { useEffect, useRef, useState } from 'react'
import { useCallStore } from '../../lib/stores/callStore'
import {
	FiMessageSquare as MessageSquareIcon,
	FiMic as MicIcon,
	FiMicOff as MicOffIcon,
	FiPhoneOff as PhoneOffIcon,
} from 'react-icons/fi'

interface FloatingCallBarProps {
	onReturnToCall: () => void
}

export const FloatingCallBar: React.FC<FloatingCallBarProps> = ({ onReturnToCall }) => {
	const {
		isMuted,
		activeCalls,
		endCall,
		toggleMute,
	} = useCallStore()

	const barRef = useRef<HTMLDivElement | null>(null)
	const rafRef = useRef<number | null>(null)
	const dragOffsetRef = useRef({ x: 0, y: 0 })
	const pendingPosRef = useRef({ x: 24, y: 24 })
	const [isDragging, setIsDragging] = useState(false)
	const [position, setPosition] = useState<{ x: number; y: number } | null>(null)

	const call = Array.from(activeCalls.values()).find(c => !c.isGroupCall)
	if (!call) return null

	const duration = Math.floor((Date.now() - call.startTime!.getTime()) / 1000)
	const mins = Math.floor(duration / 60)
	const secs = duration % 60
	const formattedDuration = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`

	const handleEndCall = () => {
		if (call) {
			endCall(call.socketId)
		}
	}

	const applyTransform = (x: number, y: number) => {
		if (!barRef.current) return
		barRef.current.style.transform = `translate3d(${x}px, ${y}px, 0)`
	}

	const scheduleTransform = () => {
		if (rafRef.current) return
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null
			applyTransform(pendingPosRef.current.x, pendingPosRef.current.y)
		})
	}

	useEffect(() => {
		if (!barRef.current || position) return
		const rect = barRef.current.getBoundingClientRect()
		const nextX = Math.max(8, window.innerWidth - rect.width - 24)
		const nextY = Math.max(8, window.innerHeight - rect.height - 24)
		pendingPosRef.current = { x: nextX, y: nextY }
		setPosition({ x: nextX, y: nextY })
		applyTransform(nextX, nextY)
	}, [position])

	useEffect(() => {
		const onPointerMove = (e: PointerEvent) => {
			if (!isDragging || !barRef.current) return
			const rect = barRef.current.getBoundingClientRect()
			const maxX = window.innerWidth - rect.width - 8
			const maxY = window.innerHeight - rect.height - 8
			const nextX = Math.max(8, Math.min(e.clientX - dragOffsetRef.current.x, maxX))
			const nextY = Math.max(8, Math.min(e.clientY - dragOffsetRef.current.y, maxY))
			pendingPosRef.current = { x: nextX, y: nextY }
			scheduleTransform()
		}

		const onPointerUp = () => {
			if (!isDragging) return
			setIsDragging(false)
			setPosition({ ...pendingPosRef.current })
			document.body.style.userSelect = ''
			document.body.style.cursor = ''
		}

		window.addEventListener('pointermove', onPointerMove, { passive: true })
		window.addEventListener('pointerup', onPointerUp)
		return () => {
			window.removeEventListener('pointermove', onPointerMove)
			window.removeEventListener('pointerup', onPointerUp)
		}
	}, [isDragging])

	useEffect(() => {
		const onResize = () => {
			if (!barRef.current) return
			const rect = barRef.current.getBoundingClientRect()
			const maxX = window.innerWidth - rect.width - 8
			const maxY = window.innerHeight - rect.height - 8
			const nextX = Math.max(8, Math.min(pendingPosRef.current.x, maxX))
			const nextY = Math.max(8, Math.min(pendingPosRef.current.y, maxY))
			pendingPosRef.current = { x: nextX, y: nextY }
			applyTransform(nextX, nextY)
			setPosition({ x: nextX, y: nextY })
		}
		window.addEventListener('resize', onResize)
		return () => window.removeEventListener('resize', onResize)
	}, [])

	useEffect(() => {
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current)
		}
	}, [])

	const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
		if (!barRef.current) return
		if ((e.target as HTMLElement).closest('[data-no-drag="true"]')) return
		const rect = barRef.current.getBoundingClientRect()
		dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
		setIsDragging(true)
		document.body.style.userSelect = 'none'
		document.body.style.cursor = 'grabbing'
	}

	return (
		<div
			ref={barRef}
			onPointerDown={onDragStart}
			className='fixed left-0 top-0 z-[9999] animate-in slide-in-from-bottom-4 duration-300 touch-none'
			style={{ willChange: 'transform', cursor: isDragging ? 'grabbing' : 'grab' }}
		>
			<div className='bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-4 min-w-[280px]'>
				<div className='flex items-center justify-between gap-3'>
					
					<div className='flex items-center gap-3 flex-1 min-w-0' onClick={onReturnToCall}>
						<div className='w-10 h-10 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0 cursor-pointer'>
							{call.userName.charAt(0).toUpperCase()}
						</div>
						<div className='flex flex-col min-w-0 cursor-pointer'>
							<span className='text-white font-semibold text-sm truncate'>
								{call.userName}
							</span>
							<div className='flex items-center gap-2'>
								<span className='text-xs text-emerald-400 flex items-center gap-1.5'>
									<span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
									{formattedDuration}
								</span>
								{isMuted && (
									<span className='text-xs text-rose-400 flex items-center gap-1'>
										<MicOffIcon className='w-3 h-3' />
									</span>
								)}
							</div>
						</div>
					</div>

					
					<div className='flex items-center gap-2'>
						
						<button
							data-no-drag='true'
							onClick={(e) => {
								e.stopPropagation()
								toggleMute()
							}}
							className={`p-2 rounded-lg transition-colors ${
								isMuted
									? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'
									: 'bg-gray-800 text-gray-300 hover:bg-gray-700'
							}`}
							title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
						>
							{isMuted ? (
								<MicOffIcon className='w-4 h-4' />
							) : (
								<MicIcon className='w-4 h-4' />
							)}
						</button>

						
						<button
							data-no-drag='true'
							onClick={onReturnToCall}
							className='p-2 bg-white/10 hover:bg-white/20 text-gray-200 rounded-lg transition-colors'
							title='Вернуться к чату'
						>
							<MessageSquareIcon className='w-4 h-4' />
						</button>

						
						<button
							data-no-drag='true'
							onClick={handleEndCall}
							className='p-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors'
							title='Завершить звонок'
						>
							<PhoneOffIcon className='w-4 h-4' />
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
