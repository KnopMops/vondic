'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { LuCheck, LuX, LuShieldAlert } from 'react-icons/lu'

function ResetVerifyContent() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const token = searchParams.get('token')
	const [status, setStatus] = useState<
		'loading' | 'success' | 'error' | 'ip_block'
	>('loading')
	const [message, setMessage] = useState('')
	const [resetToken, setResetToken] = useState('')

	useEffect(() => {
		if (!token) {
			setStatus('error')
			setMessage('Токен не найден или устарел')
			return
		}
		verifyToken()
	}, [token])

	const verifyToken = async () => {
		try {
			const res = await fetch('/api/v1/auth/verify-reset', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ token }),
			})
			const data = await res.json()
			if (data.ok && data.reset_token) {
				setStatus('success')
				setResetToken(data.reset_token)
				setTimeout(() => {
					router.push(`/reset-password?token=${data.reset_token}`)
				}, 1800)
			} else {
				if (res.status === 403) {
					setStatus('ip_block')
				} else {
					setStatus('error')
				}
				setMessage(data.error || 'Ошибка проверки токена')
			}
		} catch {
			setStatus('error')
			setMessage('Ошибка сети при проверке токена')
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-[#0e1117] p-4 text-[#e6edf3] selection:bg-[#0077FF] selection:text-white relative'>
			<div className='w-full max-w-[420px] space-y-6 rounded-2xl bg-[#161b22] border border-[#30363d] p-7 shadow-xl relative z-10 text-center'>
				<div className='flex flex-col items-center justify-center gap-2.5'>
					<div className='relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0d1117] border border-[#30363d] shadow-lg shadow-black/40 overflow-hidden p-1.5'>
						<img
							src='/logo.png'
							alt='Вондик'
							className='w-full h-full object-contain drop-shadow'
						/>
					</div>
					<h1 className='text-2xl font-bold text-white tracking-tight mt-1'>
						Безопасность Вондик
					</h1>
				</div>

				{status === 'loading' && (
					<div className='space-y-3 py-4'>
						<div className='h-8 w-8 animate-spin rounded-full border-2 border-[#0077FF] border-t-transparent mx-auto' />
						<p className='text-xs text-[#8b949e]'>Подтверждение личности...</p>
					</div>
				)}

				{status === 'success' && (
					<div className='space-y-3 py-4'>
						<div className='w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto'>
							<LuCheck className='w-6 h-6' />
						</div>
						<h2 className='text-base font-semibold text-white'>
							Личность подтверждена
						</h2>
						<p className='text-xs text-[#8b949e]'>
							Перенаправление на восстановление пароля...
						</p>
					</div>
				)}

				{status === 'ip_block' && (
					<div className='space-y-3 py-4'>
						<div className='w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto'>
							<LuShieldAlert className='w-6 h-6' />
						</div>
						<h2 className='text-base font-semibold text-white'>
							Доступ заблокирован
						</h2>
						<p className='text-xs text-[#8b949e] leading-relaxed'>{message}</p>
						<p className='text-[11px] text-[#8b949e]/70'>
							Восстановление пароля доступно только с доверенного IP-адреса аккаунта.
						</p>
					</div>
				)}

				{status === 'error' && (
					<div className='space-y-3 py-4'>
						<div className='w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 mx-auto'>
							<LuX className='w-6 h-6' />
						</div>
						<h2 className='text-base font-semibold text-white'>Ошибка</h2>
						<p className='text-xs text-[#8b949e]'>{message}</p>
						<div className='pt-2'>
							<Link
								href='/login'
								className='inline-block w-full rounded-lg bg-[#0077FF] hover:bg-[#0066dd] py-2.5 px-4 text-center text-sm font-semibold text-white transition-colors'
							>
								Вернуться к авторизации
							</Link>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}

export default function ResetVerifyPage() {
	return (
		<Suspense fallback={<div className='min-h-screen bg-[#0e1117]' />}>
			<ResetVerifyContent />
		</Suspense>
	)
}
