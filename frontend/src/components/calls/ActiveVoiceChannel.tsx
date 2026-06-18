'use client'

import React from 'react'
import { LuMic, LuMicOff, LuPhoneOff, LuUsers } from 'react-icons/lu'

interface VoiceParticipant {
	userId: string
	username: string
	avatarUrl?: string
	socketId: string
}

interface ActiveVoiceChannelProps {
	channelId: string
	channelName?: string
	participants: VoiceParticipant[]
	isMuted: boolean
	onMuteToggle: () => void
	onLeave: () => void
}

const ActiveVoiceChannel: React.FC<ActiveVoiceChannelProps> = ({
	channelId,
	channelName = 'Голосовой канал',
	participants,
	isMuted,
	onMuteToggle,
	onLeave,
}) => {
	return (
		<div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2'>
			<div className='bg-gray-900/95 border border-gray-700 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-sm min-w-[280px] max-w-[90vw]'>
				<div className='flex items-center justify-between mb-3'>
					<div className='flex items-center gap-2'>
						<LuUsers className='w-4 h-4 text-green-400' />
						<span className='text-sm font-semibold text-white truncate max-w-[180px]'>
							{channelName}
						</span>
						<span className='text-xs text-gray-400'>
							{participants.length + 1}
						</span>
					</div>
				</div>

				<div className='flex items-center gap-2 mb-3 overflow-x-auto pb-1'>
					{/* Local user */}
					<div className='flex flex-col items-center gap-1 shrink-0'>
						<div className='w-10 h-10 rounded-full bg-green-600 flex items-center justify-center text-white text-xs font-bold ring-2 ring-green-400'>
							Вы
						</div>
						<span className='text-[10px] text-gray-300 truncate max-w-[48px]'>Вы</span>
					</div>
					{/* Remote participants */}
					{participants.map(p => (
						<div key={p.socketId} className='flex flex-col items-center gap-1 shrink-0'>
							{p.avatarUrl ? (
								<img
									src={p.avatarUrl}
									alt={p.username}
									className='w-10 h-10 rounded-full object-cover ring-2 ring-gray-600'
								/>
							) : (
								<div className='w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white text-xs font-bold ring-2 ring-gray-600'>
									{p.username?.[0]?.toUpperCase() || '?'}
								</div>
							)}
							<span className='text-[10px] text-gray-300 truncate max-w-[48px]'>
								{p.username}
							</span>
						</div>
					))}
				</div>

				<div className='flex items-center justify-center gap-3'>
					<button
						onClick={onMuteToggle}
						className={`p-2.5 rounded-full transition-colors ${
							isMuted
								? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
								: 'bg-gray-700 text-white hover:bg-gray-600'
						}`}
						title={isMuted ? 'Включить микрофон' : 'Выключить микрофон'}
					>
						{isMuted ? <LuMicOff className='w-4 h-4' /> : <LuMic className='w-4 h-4' />}
					</button>
					<button
						onClick={onLeave}
						className='p-2.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors'
						title='Отключиться'
					>
						<LuPhoneOff className='w-4 h-4' />
					</button>
				</div>
			</div>
		</div>
	)
}

export default ActiveVoiceChannel
