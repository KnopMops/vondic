'use client'

import React, { useEffect, useState } from 'react'
import {
	FiAlertTriangle as AlertTriangleIcon,
	FiCheck as CheckIcon,
	FiRefreshCw as RefreshCwIcon,
	FiWifi as WifiIcon,
} from 'react-icons/fi'
import { LuLoader as Loader2Icon } from 'react-icons/lu'

export const WEBRTC_CACHE_KEY = 'vondic_webrtc_cached'

interface ConnectingModalProps {
	isVisible: boolean
	isConnected?: boolean
	onDismiss?: () => void
	onRetry?: () => void
	timeoutSeconds?: number
}

export const ConnectingModal: React.FC<ConnectingModalProps> = ({
	isVisible,
	isConnected = false,
	onDismiss,
	onRetry,
	timeoutSeconds = 7,
}) => {
	const [timedOut, setTimedOut] = useState(false)
	const [activeStep, setActiveStep] = useState(0)

	useEffect(() => {
		if (!isVisible) {
			setTimedOut(false)
			setActiveStep(0)
			return
		}

		if (isConnected) {
			try {
				sessionStorage.setItem(WEBRTC_CACHE_KEY, 'connected')
			} catch {}
			setTimedOut(false)
			return
		}

		// Step advancement interval
		const stepInterval = setInterval(() => {
			setActiveStep(prev => (prev < 3 ? prev + 1 : prev))
		}, 1600)

		// Timeout timer (default 7 seconds)
		const timer = setTimeout(() => {
			setTimedOut(true)
			try {
				sessionStorage.setItem(WEBRTC_CACHE_KEY, 'failed')
			} catch {}
		}, timeoutSeconds * 1000)

		return () => {
			clearInterval(stepInterval)
			clearTimeout(timer)
		}
	}, [isVisible, isConnected, timeoutSeconds])

	if (!isVisible || isConnected) return null

	const handleReload = () => {
		try {
			sessionStorage.removeItem(WEBRTC_CACHE_KEY)
		} catch {}
		if (onRetry) {
			onRetry()
		} else {
			window.location.reload()
		}
	}

	const handleContinue = () => {
		try {
			sessionStorage.setItem(WEBRTC_CACHE_KEY, 'failed')
		} catch {}
		if (onDismiss) {
			onDismiss()
		}
	}

	return (
		<div className='fixed inset-0 bg-black/60 backdrop-blur-md z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-300'>
			<div className='bg-[#0d131f]/95 border border-white/10 rounded-3xl w-full max-w-md p-7 shadow-2xl animate-in zoom-in-95 duration-300 relative overflow-hidden'>
				{/* Top ambient glow */}
				<div
					className={`absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-32 blur-3xl pointer-events-none rounded-full transition-colors duration-700 ${
						timedOut ? 'bg-amber-500/20' : 'bg-emerald-500/20'
					}`}
				/>

				<div className='flex flex-col items-center text-center space-y-6 relative z-10'>
					{/* Icon circle */}
					<div className='relative'>
						<div
							className={`w-20 h-20 rounded-full flex items-center justify-center transition-colors duration-500 ${
								timedOut
									? 'bg-amber-500/15 border border-amber-500/30 text-amber-400'
									: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400'
							}`}
						>
							{timedOut ? (
								<AlertTriangleIcon className='w-10 h-10 animate-bounce' />
							) : (
								<WifiIcon className='w-10 h-10 animate-pulse' />
							)}
						</div>

						{!timedOut && (
							<>
								<div className='absolute inset-0 rounded-full border border-emerald-500/30 animate-ping' />
								<div className='absolute inset-0 rounded-full border border-cyan-500/20 animate-ping animation-delay-500' />
							</>
						)}
					</div>

					{/* Header Titles */}
					<div className='space-y-2'>
						<h3 className='text-xl font-bold text-white'>
							{timedOut
								? 'Сервер связи недоступен'
								: 'Подключение к серверам связи'}
						</h3>
						<p className='text-gray-400 text-sm leading-relaxed'>
							{timedOut
								? 'Не удалось установить соединение с сервером WebRTC. Все страницы и текстовые чаты работают без него.'
								: 'Устанавливается защищённое соединение с сервером WebRTC и уведомлений...'}
						</p>
					</div>

					{/* Loading Steps or Timeout Advice */}
					{!timedOut ? (
						<div className='w-full space-y-2 pt-2'>
							<div className='flex items-center gap-3 text-sm'>
								<div
									className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
										activeStep >= 0
											? 'bg-emerald-500/20 text-emerald-400'
											: 'bg-gray-800 text-gray-500'
									}`}
								>
									{activeStep > 0 ? (
										<CheckIcon className='w-3 h-3' />
									) : (
										<div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
									)}
								</div>
								<span
									className={
										activeStep >= 0 ? 'text-gray-200' : 'text-gray-500'
									}
								>
									Инициализация WebRTC
								</span>
							</div>

							<div className='flex items-center gap-3 text-sm'>
								<div
									className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
										activeStep >= 1
											? 'bg-emerald-500/20 text-emerald-400'
											: 'bg-gray-800 text-gray-500'
									}`}
								>
									{activeStep > 1 ? (
										<CheckIcon className='w-3 h-3' />
									) : activeStep === 1 ? (
										<div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
									) : (
										<div className='w-2 h-2 rounded-full bg-gray-600' />
									)}
								</div>
								<span
									className={
										activeStep >= 1 ? 'text-gray-200' : 'text-gray-500'
									}
								>
									Подключение к сигнальному серверу
								</span>
							</div>

							<div className='flex items-center gap-3 text-sm'>
								<div
									className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
										activeStep >= 2
											? 'bg-emerald-500/20 text-emerald-400'
											: 'bg-gray-800 text-gray-500'
									}`}
								>
									{activeStep > 2 ? (
										<CheckIcon className='w-3 h-3' />
									) : activeStep === 2 ? (
										<div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
									) : (
										<div className='w-2 h-2 rounded-full bg-gray-600' />
									)}
								</div>
								<span
									className={
										activeStep >= 2 ? 'text-gray-200' : 'text-gray-500'
									}
								>
									Обмен медиа-ключами
								</span>
							</div>

							<div className='flex items-center gap-3 text-sm'>
								<div
									className={`w-5 h-5 rounded-full flex items-center justify-center transition-colors ${
										activeStep >= 3
											? 'bg-emerald-500/20 text-emerald-400'
											: 'bg-gray-800 text-gray-500'
									}`}
								>
									{activeStep === 3 ? (
										<div className='w-2 h-2 rounded-full bg-emerald-500 animate-pulse' />
									) : (
										<div className='w-2 h-2 rounded-full bg-gray-600' />
									)}
								</div>
								<span
									className={
										activeStep >= 3 ? 'text-gray-200' : 'text-gray-500'
									}
								>
									Установка соединения
								</span>
							</div>

							<div className='pt-3 px-4 py-2.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-center gap-2'>
								<Loader2Icon className='w-4 h-4 text-emerald-400 animate-spin' />
								<p className='text-xs text-gray-400'>
									Пожалуйста, подождите (до {timeoutSeconds} сек)...
								</p>
							</div>
						</div>
					) : (
						<div className='w-full space-y-4 pt-1'>
							<div className='p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-left'>
								<p className='text-xs text-amber-200/90 leading-relaxed'>
									Для совершения аудио/видеозвонков и голосовых каналов
									необходимо подключение к серверам связи. Вы можете перезагрузить
									страницу для повторной попытки.
								</p>
							</div>

							<div className='flex flex-col sm:flex-row gap-2.5 w-full'>
								<button
									onClick={handleContinue}
									className='flex-1 py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-sm font-medium transition-all'
								>
									Продолжить без звонков
								</button>
								<button
									onClick={handleReload}
									className='flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20'
								>
									<RefreshCwIcon className='w-4 h-4' />
									Перезагрузить страницу
								</button>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}

