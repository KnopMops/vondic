'use client'

import React from 'react'
import { WifiIcon, Loader2Icon } from 'lucide-react'

interface ConnectingModalProps {
	isVisible: boolean
}

export const ConnectingModal: React.FC<ConnectingModalProps> = ({ isVisible }) => {
	if (!isVisible) return null

	return (
		<div className='fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300'>
			<div className='bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-md p-8 shadow-2xl animate-in zoom-in-95 duration-300'>
				<div className='flex flex-col items-center text-center space-y-6'>
					
					<div className='relative'>
						<div className='w-24 h-24 rounded-full bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center'>
							<WifiIcon className='w-12 h-12 text-emerald-400 animate-pulse' />
						</div>
						
						<div className='absolute inset-0 rounded-full border-2 border-emerald-500/30 animate-ping' />
						<div className='absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping animation-delay-500' />
					</div>

					
					<div className='relative'>
						<Loader2Icon className='w-8 h-8 text-emerald-400 animate-spin' />
					</div>

					
					<div className='space-y-2'>
						<h3 className='text-2xl font-bold text-white'>
							Подключение к серверам связи
						</h3>
						<p className='text-gray-400 text-sm'>
							Устанавливается соединение с сервером уведомлений...
						</p>
					</div>

					
					<div className='w-full space-y-2 pt-4'>
						<div className='flex items-center gap-3 text-sm'>
							<div className='w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center'>
								<div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
							</div>
							<span className='text-gray-300'>Инициализация WebRTC</span>
						</div>
						<div className='flex items-center gap-3 text-sm'>
							<div className='w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center'>
								<div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
							</div>
							<span className='text-gray-300'>Подключение к сигнальному серверу</span>
						</div>
						<div className='flex items-center gap-3 text-sm'>
							<div className='w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center'>
								<div className='w-2 h-2 rounded-full bg-gray-600' />
							</div>
							<span className='text-gray-500'>Обмен медиа-ключами</span>
						</div>
						<div className='flex items-center gap-3 text-sm'>
							<div className='w-5 h-5 rounded-full bg-gray-800 flex items-center justify-center'>
								<div className='w-2 h-2 rounded-full bg-gray-600' />
							</div>
							<span className='text-gray-500'>Установка соединения</span>
						</div>
					</div>

					
					<div className='pt-4 px-4 py-3 bg-gray-800/50 rounded-xl border border-gray-800'>
						<p className='text-xs text-gray-400 flex items-center gap-2'>
							<span className='w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse' />
							Пожалуйста, подождите...
						</p>
					</div>
				</div>
			</div>
		</div>
	)
}
