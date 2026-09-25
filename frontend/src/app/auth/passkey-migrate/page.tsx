'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { completePasskeyMigration, isPasskeySupported } from '@/lib/passkey'
import { LuKey, LuCheck, LuAlertCircle, LuLoader } from 'react-icons/lu'

export default function PasskeyMigratePage() {
	const searchParams = useSearchParams()
	const router = useRouter()
	const token = searchParams.get('token')

	const [info, setInfo] = useState<any>(null)
	const [loading, setLoading] = useState(true)
	const [migrating, setMigrating] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [success, setSuccess] = useState(false)

	useEffect(() => {
		if (!token) {
			setError('Отсутствует токен миграции в ссылке')
			setLoading(false)
			return
		}

		const fetchInfo = async () => {
			try {
				const res = await fetch(`/api/auth/passkey/migrate/info?token=${encodeURIComponent(token)}`)
				const data = await res.json()
				if (!res.ok) {
					setError(data.error || 'QR-код устарел или уже был использован')
					setLoading(false)
					return
				}
				setInfo(data)
			} catch (err: any) {
				setError('Ошибка подключения к серверу')
			} finally {
				setLoading(false)
			}
		}

		fetchInfo()
	}, [token])

	const handleMigrate = async () => {
		if (!token) return
		setError(null)
		setMigrating(true)

		try {
			if (!isPasskeySupported()) {
				throw new Error('Ваш браузер или устройство не поддерживает Passkey (WebAuthn)')
			}

			const result = await completePasskeyMigration(token)
			setSuccess(true)

			setTimeout(() => {
				window.location.assign('/feed')
			}, 1500)
		} catch (err: any) {
			setError(err.message || 'Ошибка миграции Passkey')
			setMigrating(false)
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-black text-white p-4 relative overflow-hidden'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
			</div>

			<motion.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				className='w-full max-w-md rounded-3xl bg-white/5 border border-white/10 p-8 shadow-2xl backdrop-blur-xl relative z-10 text-center space-y-6'
			>
				<div className='mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400'>
					<LuKey className='h-8 w-8' />
				</div>

				<h1 className='text-2xl font-bold'>Миграция Passkey</h1>

				{loading ? (
					<div className='flex flex-col items-center gap-3 py-6 text-gray-400'>
						<LuLoader className='h-8 w-8 animate-spin text-indigo-500' />
						<p className='text-sm'>Проверка QR-кода...</p>
					</div>
				) : error ? (
					<div className='space-y-4 py-4'>
						<div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400'>
							<LuAlertCircle className='h-6 w-6' />
						</div>
						<p className='text-sm text-red-400'>{error}</p>
						<button
							onClick={() => router.push('/login')}
							className='w-full rounded-full bg-white/10 px-4 py-2.5 text-sm font-semibold hover:bg-white/20 transition-all'
						>
							Перейти ко входу
						</button>
					</div>
				) : success ? (
					<div className='space-y-4 py-4'>
						<div className='mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400'>
							<LuCheck className='h-6 w-6' />
						</div>
						<p className='text-base font-semibold text-emerald-400'>
							Passkey успешно сохранён на этом устройстве!
						</p>
						<p className='text-xs text-gray-400'>Перенаправляем в ленту...</p>
					</div>
				) : (
					<div className='space-y-6'>
						<div className='rounded-2xl border border-white/10 bg-white/5 p-4 text-left space-y-1'>
							<div className='text-xs text-gray-400'>Аккаунт для миграции:</div>
							<div className='text-base font-semibold text-white'>
								{info?.user?.username || 'Пользователь'}
							</div>
							<div className='text-xs text-gray-400'>{info?.user?.email}</div>
						</div>

						<p className='text-xs text-gray-400 leading-relaxed'>
							Нажмите кнопку ниже и подтвердите TouchID, FaceID или пин-код устройства.
							Passkey запишется в чип безопасности вашего телефона для мгновенного входа в будущем.
						</p>

						<button
							onClick={handleMigrate}
							disabled={migrating}
							className='group relative flex w-full items-center justify-center gap-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50'
						>
							{migrating ? (
								<>
									<LuLoader className='h-5 w-5 animate-spin' />
									Ожидание биометрии...
								</>
							) : (
								<>
									<LuKey className='h-5 w-5' />
									Подтвердить перенос биометрией
								</>
							)}
						</button>
					</div>
				)}
			</motion.div>
		</div>
	)
}
