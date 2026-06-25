'use client'

import { saveAccount } from '@/lib/savedAccounts'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import {
	LuArrowLeft as ArrowLeft,
	LuLoader as Loader2,
	LuRefreshCw as Refresh,
	LuCheck as Check,
	LuX as X,
} from 'react-icons/lu'

export default function QRLoginPage() {
	const router = useRouter()
	const [qrToken, setQrToken] = useState<string | null>(null)
	const [qrDataUrl, setQrDataUrl] = useState<string>('')
	const [status, setStatus] = useState<'loading' | 'pending' | 'confirmed' | 'expired' | 'error'>('loading')
	const [error, setError] = useState('')
	const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

	const generateQR = useCallback(async () => {
		setStatus('loading')
		setError('')
		try {
			const res = await fetch('/api/auth/qr/generate', { method: 'POST' })
			const data = await res.json()
			if (!res.ok || !data.qr_token) {
				setStatus('error')
				setError(data.error || 'Ошибка генерации QR')
				return
			}
			setQrToken(data.qr_token)
			const dataUrl = await QRCode.toDataURL(data.qr_token, {
				width: 256,
				margin: 2,
				color: { dark: '#ffffff', light: '#00000000' },
			})
			setQrDataUrl(dataUrl)
			setStatus('pending')
		} catch {
			setStatus('error')
			setError('Ошибка сети')
		}
	}, [])

	useEffect(() => {
		generateQR()
		return () => {
			if (pollRef.current) clearInterval(pollRef.current)
		}
	}, [generateQR])

	useEffect(() => {
		if (status !== 'pending' || !qrToken) return
		pollRef.current = setInterval(async () => {
			try {
				const res = await fetch(`/api/auth/qr/status?qr_token=${encodeURIComponent(qrToken)}`)
				const data = await res.json()
				if (data.status === 'confirmed') {
					setStatus('confirmed')
					if (pollRef.current) clearInterval(pollRef.current)
					if (data.access_token && data.refresh_token && data.user) {
						localStorage.setItem('user', JSON.stringify(data.user))
						saveAccount({
							id: data.user.id,
							email: data.user.email,
							username: data.user.username,
							access_token: data.access_token,
							refresh_token: data.refresh_token,
						})
						await fetch('/api/auth/restore', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ refresh_token: data.refresh_token }),
						})
					}
					window.location.href = '/feed'
				} else if (data.status === 'expired' || data.status === 'cancelled') {
					setStatus('expired')
					if (pollRef.current) clearInterval(pollRef.current)
				}
			} catch {}
		}, 2000)
		return () => {
			if (pollRef.current) clearInterval(pollRef.current)
		}
	}, [status, qrToken, router])

	return (
		<div className='min-h-screen bg-black text-white flex items-center justify-center px-4'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[30%] -left-[15%] w-[60%] h-[60%] rounded-full bg-indigo-600/15 blur-[150px]' />
				<div className='absolute top-[30%] -right-[10%] w-[50%] h-[50%] rounded-full bg-purple-600/15 blur-[150px]' />
			</div>

			<div className='relative z-10 w-full max-w-sm'>
				<Link
					href='/login'
					className='inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors mb-8'
				>
					<ArrowLeft className='w-4 h-4' />
					Назад к входу
				</Link>

				<div className='rounded-2xl bg-gray-900/50 border border-white/[0.06] p-8 text-center'>
					<h1 className='text-xl font-bold mb-2'>Войти по QR-коду</h1>
					<p className='text-sm text-gray-400 mb-8'>
						Откройте Вондик на телефоне и отсканируйте код
					</p>

					<div className='flex justify-center mb-6'>
						<div className='w-56 h-56 rounded-2xl bg-white/5 border border-white/[0.06] flex items-center justify-center overflow-hidden'>
							<AnimatePresence mode='wait'>
								{status === 'loading' && (
									<motion.div
										key='loading'
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
									>
										<Loader2 className='w-8 h-8 text-gray-500 animate-spin' />
									</motion.div>
								)}
								{status === 'pending' && qrDataUrl && (
									<motion.img
										key='qr'
										src={qrDataUrl}
										alt='QR Code'
										className='w-48 h-48'
										initial={{ opacity: 0, scale: 0.9 }}
										animate={{ opacity: 1, scale: 1 }}
										exit={{ opacity: 0 }}
									/>
								)}
								{status === 'confirmed' && (
									<motion.div
										key='confirmed'
										initial={{ opacity: 0, scale: 0.8 }}
										animate={{ opacity: 1, scale: 1 }}
										className='flex flex-col items-center gap-2'
									>
										<div className='w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center'>
											<Check className='w-8 h-8 text-emerald-400' />
										</div>
										<span className='text-sm text-emerald-400 font-medium'>Вход выполнен</span>
									</motion.div>
								)}
								{(status === 'expired' || status === 'error') && (
									<motion.div
										key='error'
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										className='flex flex-col items-center gap-2'
									>
										<div className='w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center'>
											<X className='w-8 h-8 text-red-400' />
										</div>
										<span className='text-sm text-red-400'>
											{error || 'QR код истёк'}
										</span>
									</motion.div>
								)}
							</AnimatePresence>
						</div>
					</div>

					{(status === 'expired' || status === 'error') && (
						<button
							onClick={generateQR}
							className='inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.06] text-sm text-gray-300 hover:text-white transition-all'
						>
							<Refresh className='w-4 h-4' />
							Обновить QR
						</button>
					)}

					{status === 'pending' && (
						<p className='text-xs text-gray-500 mt-4'>
							Ожидание сканирования...
						</p>
					)}
				</div>
			</div>
		</div>
	)
}
