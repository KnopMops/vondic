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
	const [status, setStatus] = useState<
		'loading' | 'pending' | 'confirmed' | 'expired' | 'error'
	>('loading')
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
				const res = await fetch(
					`/api/auth/qr/status?qr_token=${encodeURIComponent(qrToken)}`,
				)
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
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white flex items-center justify-center p-4 relative'>
			<div className='relative z-10 w-full max-w-[420px] space-y-4'>
				<Link
					href='/login'
					className='inline-flex items-center gap-2 text-xs font-medium text-[#8b949e] hover:text-white transition-colors'
				>
					<ArrowLeft className='w-4 h-4' />
					Назад к входу
				</Link>

				<div className='rounded-2xl bg-[#161b22] border border-[#30363d] p-7 shadow-xl text-center space-y-5'>
					<div className='flex flex-col items-center justify-center gap-2.5'>
						<div className='relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0d1117] border border-[#30363d] shadow-lg shadow-black/40 overflow-hidden p-1.5'>
							<img
								src='/logo.png'
								alt='Вондик'
								className='w-full h-full object-contain drop-shadow'
							/>
						</div>
						<h1 className='text-2xl font-bold text-white tracking-tight mt-1'>
							Войти по QR-коду
						</h1>
						<p className='text-xs text-[#8b949e]'>
							Отсканируйте код через приложение Вондик на телефоне
						</p>
					</div>

					<div className='flex justify-center'>
						<div className='w-56 h-56 rounded-2xl bg-[#0d1117] border border-[#30363d] flex items-center justify-center overflow-hidden p-3'>
							<AnimatePresence mode='wait'>
								{status === 'loading' && (
									<motion.div
										key='loading'
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										exit={{ opacity: 0 }}
									>
										<Loader2 className='w-8 h-8 text-[#8b949e] animate-spin' />
									</motion.div>
								)}
								{status === 'pending' && qrDataUrl && (
									<motion.img
										key='qr'
										src={qrDataUrl}
										alt='QR Code'
										className='w-48 h-48 rounded-lg'
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
										<div className='w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400'>
											<Check className='w-7 h-7' />
										</div>
										<span className='text-sm text-emerald-400 font-medium'>
											Вход выполнен
										</span>
									</motion.div>
								)}
								{(status === 'expired' || status === 'error') && (
									<motion.div
										key='error'
										initial={{ opacity: 0 }}
										animate={{ opacity: 1 }}
										className='flex flex-col items-center gap-2'
									>
										<div className='w-14 h-14 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400'>
											<X className='w-7 h-7' />
										</div>
										<span className='text-xs text-red-400 font-medium'>
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
							className='inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#21262d] hover:bg-[#30363d] border border-[#30363d] text-xs font-semibold text-white transition-all'
						>
							<Refresh className='w-3.5 h-3.5' />
							Обновить QR-код
						</button>
					)}

					{status === 'pending' && (
						<p className='text-xs text-[#8b949e]'>
							Ожидание сканирования...
						</p>
					)}
				</div>
			</div>
		</div>
	)
}
