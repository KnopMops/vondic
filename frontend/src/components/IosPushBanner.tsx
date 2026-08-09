'use client'

import { useEffect, useState } from 'react'
import { LuX as Close, LuSmartphone as Phone, LuShare2 as Share, LuBell as Bell } from 'react-icons/lu'

function isIOS(): boolean {
	if (typeof navigator === 'undefined') return false
	return /iPhone|iPad|iPod/.test(navigator.userAgent)
}

function isStandalone(): boolean {
	if (typeof window === 'undefined') return false
	return (window as any).navigator?.standalone === true ||
		window.matchMedia('(display-mode: standalone)').matches
}

export default function IosPushBanner() {
	const [mode, setMode] = useState<'install' | 'permission' | null>(null)

	useEffect(() => {
		if (typeof window === 'undefined') return
		const ios = isIOS()
		const standalone = isStandalone()

		if (ios && !standalone) {
			const dismissed = localStorage.getItem('ios_push_banner_dismissed')
			if (!dismissed) setMode('install')
		} else if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
			setMode('permission')
		}
	}, [])

	const handleRequestPermission = async () => {
		try {
			if (typeof Notification !== 'undefined') {
				const perm = await Notification.requestPermission()
				if (perm === 'granted') {
					window.location.reload()
				}
			}
		} catch (e) {
			console.warn('Push permission error:', e)
		} finally {
			setMode(null)
		}
	}

	const dismiss = () => {
		setMode(null)
		if (mode === 'install') {
			localStorage.setItem('ios_push_banner_dismissed', '1')
		}
	}

	if (!mode) return null

	if (mode === 'install') {
		return (
			<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'>
				<div className='w-full max-w-sm rounded-3xl border border-indigo-500/30 bg-gradient-to-b from-indigo-950 to-gray-950 p-8 shadow-2xl text-center relative'>
					<button
						onClick={dismiss}
						className='absolute right-4 top-4 rounded-full p-2 text-gray-400 hover:text-white hover:bg-white/10 transition-colors'
					>
						<Close className='h-5 w-5' />
					</button>

					<div className='flex justify-center mb-5'>
						<div className='flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20'>
							<Phone className='h-8 w-8 text-indigo-400' />
						</div>
					</div>

					<h2 className='text-xl font-bold text-white mb-2'>
						Установите приложение
					</h2>
					<p className='text-sm text-gray-300 mb-6'>
						Добавьте Вондик на домашний экран, чтобы получать уведомления о сообщениях и звонках.
					</p>

					<div className='bg-white/5 rounded-2xl p-5 mb-6 text-left space-y-4'>
						<div className='flex items-start gap-3'>
							<div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-sm'>1</div>
							<p className='text-sm text-gray-200 pt-1'>
								Нажмите кнопку <Share className='inline h-4 w-4 text-indigo-400 mx-1 align-middle' /> внизу Safari
							</p>
						</div>
						<div className='flex items-start gap-3'>
							<div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-sm'>2</div>
							<p className='text-sm text-gray-200 pt-1'>
								Выберите <span className='text-indigo-300 font-semibold'>«На экран Домой»</span>
							</p>
						</div>
						<div className='flex items-start gap-3'>
							<div className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 font-bold text-sm'>3</div>
							<p className='text-sm text-gray-200 pt-1'>
								Нажмите <span className='text-indigo-300 font-semibold'>«Добавить»</span> в правом верхнем углу
							</p>
						</div>
					</div>

					<button
						onClick={dismiss}
						className='w-full rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white hover:bg-indigo-500 active:scale-95 transition-all'
					>
						Понятно
					</button>
				</div>
			</div>
		)
	}

	return (
		<div className='fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 sm:w-96 z-[99999] bg-indigo-950/95 border border-indigo-500/40 backdrop-blur-2xl rounded-2xl p-5 shadow-2xl flex items-center justify-between gap-4 text-white animate-in slide-in-from-bottom duration-300'>
			<div className='flex items-center gap-3'>
				<div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500/30 text-indigo-300'>
					<Bell className='h-5 w-5 animate-pulse' />
				</div>
				<div>
					<div className='text-sm font-bold'>Включить уведомления</div>
					<div className='text-xs text-gray-300'>Получайте сообщения и звонки в PWA</div>
				</div>
			</div>
			<div className='flex items-center gap-2'>
				<button
					onClick={handleRequestPermission}
					className='rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold hover:bg-indigo-500 active:scale-95 transition-all whitespace-nowrap'
				>
					Включить
				</button>
				<button
					onClick={dismiss}
					className='p-2 text-gray-400 hover:text-white transition-colors'
				>
					<Close className='h-4 w-4' />
				</button>
			</div>
		</div>
	)
}
