'use client'

import React from 'react'
import { useCallStore } from '../../lib/stores/callStore'
import { PhoneOffIcon, MicIcon, MicOffIcon, MessageSquareIcon } from 'lucide-react'

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

	return (
		<div className='fixed bottom-6 right-6 z-[9999] animate-in slide-in-from-bottom-4 duration-300'>
			<div className='bg-gray-900/95 backdrop-blur-xl border border-gray-800 rounded-2xl shadow-2xl p-4 min-w-[280px]'>
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
							onClick={onReturnToCall}
							className='p-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors'
							title='Вернуться к чату'
						>
							<MessageSquareIcon className='w-4 h-4' />
						</button>

						
						<button
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
