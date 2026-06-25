'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'

export default function ResetVerifyPage() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const token = searchParams.get('token')
	const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'ip_block'>('loading')
	const [message, setMessage] = useState('')
	const [resetToken, setResetToken] = useState('')

	useEffect(() => {
		if (!token) {
			setStatus('error')
			setMessage('Токен не найден')
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
				}, 2000)
			} else {
				if (res.status === 403) {
					setStatus('ip_block')
				} else {
					setStatus('error')
				}
				setMessage(data.error || 'Ошибка')
			}
		} catch {
			setStatus('error')
			setMessage('Ошибка сети')
		}
	}

	return (
		<div className='min-h-screen bg-gray-950 flex items-center justify-center p-4'>
			<div className='w-full max-w-md text-center'>
				{status === 'loading' && (
					<div>
						<div className='animate-spin rounded-full h-8 w-8 border-t-2 border-indigo-500 mx-auto mb-4'></div>
						<p className='text-gray-400'>Подтверждение личности...</p>
					</div>
				)}
				{status === 'success' && (
					<div>
						<div className='rounded-full bg-green-500/10 h-16 w-16 flex items-center justify-center mx-auto mb-4'>
							<svg className='h-8 w-8 text-green-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M5 13l4 4L19 7' />
							</svg>
						</div>
						<h1 className='text-lg font-semibold text-white mb-2'>Личность подтверждена</h1>
						<p className='text-sm text-gray-400'>Перенаправление на восстановление пароля...</p>
					</div>
				)}
				{status === 'ip_block' && (
					<div>
						<div className='rounded-full bg-red-500/10 h-16 w-16 flex items-center justify-center mx-auto mb-4'>
							<svg className='h-8 w-8 text-red-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M6 18L18 6M6 6l12 12' />
							</svg>
						</div>
						<h1 className='text-lg font-semibold text-white mb-2'>Доступ запрещён</h1>
						<p className='text-sm text-gray-400 mb-4'>{message}</p>
						<p className='text-xs text-gray-500'>Восстановление пароля доступно только с IP-адреса, с которого был зарегистрирован аккаунт.</p>
					</div>
				)}
				{status === 'error' && (
					<div>
						<div className='rounded-full bg-red-500/10 h-16 w-16 flex items-center justify-center mx-auto mb-4'>
							<svg className='h-8 w-8 text-red-500' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z' />
							</svg>
						</div>
						<h1 className='text-lg font-semibold text-white mb-2'>Ошибка</h1>
						<p className='text-sm text-gray-400 mb-4'>{message}</p>
						<button
							onClick={() => router.push('/feed')}
							className='rounded-xl bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors'
						>
							На главную
						</button>
					</div>
				)}
			</div>
		</div>
	)
}
