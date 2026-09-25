'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { completePasskeyMigration, isPasskeySupported } from '@/lib/passkey'
import { LuKey, LuCheck, LuCircleAlert, LuLoader } from 'react-icons/lu'

function PasskeyMigrateContent() {
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
		<div className='flex min-h-screen items-center justify-center bg-[#0e1117] text-[#e6edf3] p-4 relative'>
			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, ease: 'easeOut' }}
				className='w-full max-w-[420px] rounded-2xl bg-[#161b22] border border-[#30363d] p-7 shadow-xl relative z-10 text-center space-y-6'
			>
				<div className='mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#0077FF]/10 border border-[#0077FF]/30 text-[#0077FF]'>
					<LuKey className='h-6 w-6' />
				</div>

				<div>
					<h1 className='text-xl font-bold tracking-tight text-white'>Миграция Passkey</h1>
					<p className='text-xs text-[#8b949e] mt-1'>
						Привязка ключа доступа к этому устройству
					</p>
				</div>

				{loading ? (
					<div className='flex flex-col items-center gap-3 py-6 text-[#8b949e]'>
						<LuLoader className='h-6 w-6 animate-spin text-[#0077FF]' />
						<p className='text-xs'>Проверка сессии QR-кода...</p>
					</div>
				) : error ? (
					<div className='space-y-4 py-2'>
						<div className='mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#f85149]/10 text-[#f85149]'>
							<LuCircleAlert className='h-5 w-5' />
						</div>
						<p className='text-xs text-[#f85149] bg-[#f85149]/10 border border-[#f85149]/30 rounded-lg p-2.5'>{error}</p>
						<button
							onClick={() => router.push('/login')}
							className='w-full rounded-lg border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] px-4 py-2.5 text-xs font-semibold text-white transition-all'
						>
							Перейти ко входу
						</button>
					</div>
				) : success ? (
					<div className='space-y-3 py-2'>
						<div className='mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#2ea043]/10 text-[#3fb950]'>
							<LuCheck className='h-5 w-5' />
						</div>
						<p className='text-sm font-semibold text-[#3fb950]'>
							Passkey успешно сохранён на этом устройстве!
						</p>
						<p className='text-xs text-[#8b949e]'>Перенаправляем в приложение...</p>
					</div>
				) : (
					<div className='space-y-5'>
						<div className='rounded-lg border border-[#30363d] bg-[#0d1117] p-3 text-left space-y-1'>
							<div className='text-[11px] text-[#8b949e]'>Аккаунт для миграции:</div>
							<div className='text-sm font-semibold text-white'>
								{info?.user?.username || 'Пользователь'}
							</div>
							<div className='text-xs text-[#8b949e] font-mono'>{info?.user?.email}</div>
						</div>

						<p className='text-xs text-[#8b949e] leading-relaxed'>
							Нажмите кнопку ниже и подтвердите Touch ID, Face ID или пин-код устройства.
							Ключ запишется в чип безопасности вашего смартфона для быстрого входа без пароля.
						</p>

						<button
							onClick={handleMigrate}
							disabled={migrating}
							className='w-full flex items-center justify-center gap-2 rounded-lg bg-[#0077FF] hover:bg-[#0066dd] py-2.5 text-sm font-medium text-white transition-all shadow-sm active:scale-[0.99] disabled:opacity-50'
						>
							{migrating ? (
								<>
									<LuLoader className='h-4 w-4 animate-spin' />
									<span>Ожидание биометрии...</span>
								</>
							) : (
								<>
									<LuKey className='h-4 w-4' />
									<span>Подтвердить биометрией</span>
								</>
							)}
						</button>
					</div>
				)}
			</motion.div>
		</div>
	)
}

export default function PasskeyMigratePage() {
	return (
		<Suspense
			fallback={
				<div className='flex min-h-screen items-center justify-center bg-[#0e1117] text-white'>
					<LuLoader className='h-8 w-8 animate-spin text-[#0077FF]' />
				</div>
			}
		>
			<PasskeyMigrateContent />
		</Suspense>
	)
}
