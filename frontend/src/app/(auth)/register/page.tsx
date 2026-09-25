'use client'

import SmartCaptcha from '@/components/auth/SmartCaptcha'
import EmailInput from '@/components/ui/EmailInput'
import PasswordInput from '@/components/ui/PasswordInput'
import { useAuth } from '@/lib/AuthContext'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { LuKey } from 'react-icons/lu'
import { registerWithPasskey } from '@/lib/passkey'

export default function RegisterPage() {
	const [email, setEmail] = useState('')
	const [username, setUsername] = useState('')
	const [password, setPassword] = useState('')
	const [captchaToken, setCaptchaToken] = useState('')
	const [captchaKey, setCaptchaKey] = useState(0)
	const [emailHint, setEmailHint] = useState<string | null>(null)
	const [emailOk, setEmailOk] = useState<boolean | null>(null)
	const captchaSiteKey =
		process.env.NEXT_PUBLIC_YANDEX_SMARTCAPTCHA_SITE_KEY || ''
	const { register, isLoading } = useAuth()

	useEffect(() => {
		const norm = email.trim().toLowerCase()
		if (!norm || !norm.includes('@')) {
			setEmailHint(null)
			setEmailOk(null)
			return
		}
		const t = setTimeout(async () => {
			try {
				const res = await fetch('/api/auth/check-email', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: norm }),
				})
				const data = await res.json()
				if (!data.valid) {
					setEmailOk(false)
					setEmailHint(data.error || 'Некорректный email')
					return
				}
				if (!data.available) {
					setEmailOk(false)
					setEmailHint('Этот email уже зарегистрирован')
					return
				}
				setEmailOk(true)
				setEmailHint('Email свободен')
			} catch {
				setEmailOk(null)
				setEmailHint(null)
			}
		}, 500)
		return () => clearTimeout(t)
	}, [email])

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault()
		if (emailOk === false) return
		try {
			await register(
				email.trim().toLowerCase(),
				username.trim(),
				password,
				captchaToken,
			)
		} catch {
			setCaptchaKey(k => k + 1)
			setCaptchaToken('')
		}
	}

	const [passkeyLoading, setPasskeyLoading] = useState(false)
	const [passkeyError, setPasskeyError] = useState<string | null>(null)

	const handlePasskeyRegister = async () => {
		setPasskeyError(null)
		if (!email.trim() || !username.trim()) {
			setPasskeyError('Сначала укажите email и имя пользователя')
			return
		}
		if (emailOk === false) return
		setPasskeyLoading(true)
		try {
			await registerWithPasskey({
				email: email.trim().toLowerCase(),
				username: username.trim(),
				password: password.trim() || undefined,
			})
			window.location.assign('/feed')
		} catch (err: any) {
			setPasskeyError(err.message || 'Ошибка регистрации с помощью Passkey')
		} finally {
			setPasskeyLoading(false)
		}
	}

	return (
		<div className='flex min-h-screen items-center justify-center bg-[#0e1117] p-4 text-[#e6edf3] selection:bg-[#0077FF] selection:text-white relative'>
			<motion.div
				initial={{ opacity: 0, y: 14 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.35, ease: 'easeOut' }}
				className='w-full max-w-[420px] space-y-6 rounded-2xl bg-[#161b22] border border-[#30363d] p-7 shadow-xl relative z-10'
			>
				<div className='flex flex-col items-center justify-center gap-2.5'>
					<div className='relative flex items-center justify-center w-14 h-14 rounded-2xl bg-[#0d1117] border border-[#30363d] shadow-lg shadow-black/40 overflow-hidden p-1.5 group'>
						<img
							src='/logo.png'
							alt='Вондик'
							className='w-full h-full object-contain drop-shadow transition-transform duration-300 group-hover:scale-105'
						/>
					</div>
					<h1 className='text-2xl font-bold text-white tracking-tight mt-1'>
						Регистрация в Вондик
					</h1>
					<p className='text-xs text-[#8b949e] text-center'>
						Присоединяйтесь к Вондику для общения и работы
					</p>
				</div>

				<form className='mt-6 space-y-4' onSubmit={handleSubmit}>
					<div className='space-y-3'>
						<div>
							<label htmlFor='email-address' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
								Электронная почта
							</label>
							<EmailInput
								id='email-address'
								value={email}
								onChange={setEmail}
								required
								listId='register-email-suggestions'
								className='relative block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
							/>
							{emailHint ? (
								<p
									className={`mt-1.5 text-xs ${
										emailOk ? 'text-emerald-400' : 'text-red-400'
									}`}
								>
									{emailHint}
								</p>
							) : null}
						</div>
						<div>
							<label htmlFor='username' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
								Имя пользователя
							</label>
							<input
								id='username'
								name='username'
								type='text'
								autoComplete='username'
								required
								className='relative block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
								placeholder='username'
								value={username}
								onChange={e => setUsername(e.target.value)}
							/>
						</div>
						<div>
							<label htmlFor='password' className='block text-xs font-medium text-[#8b949e] mb-1.5'>
								Пароль
							</label>
							<PasswordInput
								id='password'
								name='password'
								autoComplete='new-password'
								required
								wrapperClassName='w-full'
								className='relative block w-full rounded-lg border border-[#30363d] bg-[#0d1117] py-2.5 px-3.5 text-sm text-white placeholder:text-[#8b949e]/50 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] transition-all outline-none'
								placeholder='Минимум 6 символов'
								value={password}
								onChange={e => setPassword(e.target.value)}
							/>
						</div>
					</div>
					<SmartCaptcha key={`register-${captchaKey}`} onTokenChange={setCaptchaToken} />

					<div className='space-y-3 pt-2'>
						<button
							type='submit'
							disabled={
								isLoading ||
								emailOk === false ||
								(!!captchaSiteKey && !captchaToken.trim())
							}
							className='w-full rounded-lg bg-[#0077FF] hover:bg-[#0066dd] px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm'
						>
							{isLoading ? 'Создание...' : 'Зарегистрироваться'}
						</button>

						<div className='relative flex items-center justify-center my-2'>
							<div className='absolute inset-0 flex items-center'>
								<div className='w-full border-t border-[#30363d]' />
							</div>
							<span className='relative bg-[#161b22] px-2 text-xs text-[#8b949e]'>
								или
							</span>
						</div>

						<button
							type='button'
							onClick={handlePasskeyRegister}
							disabled={passkeyLoading || emailOk === false}
							className='w-full flex items-center justify-center gap-2 rounded-lg border border-[#30363d] bg-[#21262d] hover:bg-[#30363d] px-4 py-2.5 text-sm font-medium text-[#c9d1d9] transition-all disabled:opacity-50 disabled:cursor-not-allowed'
						>
							<LuKey className='h-4 w-4 text-[#58a6ff]' />
							{passkeyLoading ? 'Создание Passkey...' : 'Регистрация с Passkey'}
						</button>
						{passkeyError && (
							<p className='text-center text-xs text-red-400 mt-1'>{passkeyError}</p>
						)}
					</div>
					<p className='mt-3 text-center text-[11px] text-[#8b949e] leading-relaxed'>
						Регистрируясь, вы соглашаетесь с{' '}
						<a
							href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/privacy_policy.rtf`}
							target='_blank'
							rel='noopener noreferrer'
							className='text-[#58a6ff] hover:underline transition-colors'
						>
							политикой конфиденциальности
						</a>
						{' '}
						и{' '}
						<a
							href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/consent_to_processing_personal_data.rtf`}
							target='_blank'
							rel='noopener noreferrer'
							className='text-[#58a6ff] hover:underline transition-colors'
						>
							согласием на обработку данных
						</a>
						.
					</p>
				</form>

				<p className='mt-4 text-center text-xs text-[#8b949e]'>
					Уже есть аккаунт?{' '}
					<Link
						href='/login'
						className='font-medium text-[#58a6ff] hover:underline transition-colors'
					>
						Войти
					</Link>
				</p>
			</motion.div>
		</div>
	)
}
