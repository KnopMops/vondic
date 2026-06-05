'use client'

import { useAuth } from '@/lib/AuthContext'
import {
	getSavedAccounts,
	removeSavedAccount,
	type SavedAccount,
} from '@/lib/savedAccounts'
import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { LuX as X } from 'react-icons/lu'

interface LoginModalProps {
	isOpen: boolean
	onClose: () => void
}

export default function LoginModal({ isOpen, onClose }: LoginModalProps) {
	const { loginWithVondic } = useAuth()
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [accounts, setAccounts] = useState<SavedAccount[]>([])
	const [showAll, setShowAll] = useState(false)

	useEffect(() => {
		if (isOpen) {
			setAccounts(getSavedAccounts())
		}
	}, [isOpen])

	if (!isOpen) return null

	const handleLogin = async () => {
		setLoading(true)
		setError(null)
		try {
			await loginWithVondic()
			onClose()
		} catch (err: any) {
			setError(err.message || 'Ошибка входа')
		} finally {
			setLoading(false)
		}
	}

	const handleAccountLogin = async (account: SavedAccount) => {
		setLoading(true)
		setError(null)
		try {
			await loginWithVondic({ loginHint: account.email })
			onClose()
		} catch (err: any) {
			setError(err.message || 'Ошибка входа')
		} finally {
			setLoading(false)
		}
	}

	const handleRemove = (e: React.MouseEvent, accountId: string) => {
		e.stopPropagation()
		removeSavedAccount(accountId)
		setAccounts(prev => prev.filter(a => a.id !== accountId))
	}

	const THREE_DAYS = 3 * 24 * 60 * 60 * 1000
	const isStale = (account: SavedAccount) =>
		Date.now() - account.last_login_at > THREE_DAYS

	const showAccountList = accounts.length > 0 && !showAll

	return (
		<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200'>
			<div className='absolute inset-0' onClick={onClose} />

			<div className='relative w-full max-w-md space-y-6 rounded-2xl bg-gray-900 p-8 shadow-2xl border border-gray-800 animate-in zoom-in-95 duration-200'>
				<button
					onClick={onClose}
					className='absolute top-4 right-4 text-gray-500 hover:text-white transition-colors'
					aria-label='Закрыть'
				>
					<X className='w-6 h-6' />
				</button>

				<div className='flex flex-col items-center justify-center gap-3'>
					<div className='w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center font-bold text-white text-lg'>
						В
					</div>
					<h2 className='text-2xl font-bold text-white'>
						{showAccountList ? 'Продолжить как' : 'Вход в Вондик'}
					</h2>
					{!showAccountList && (
						<p className='text-sm text-gray-400 text-center'>
							Войдите через Vondic OAuth, используя любой аккаунт
						</p>
					)}
				</div>

				<div className='space-y-4'>
					<AnimatePresence mode='wait'>
						{showAccountList ? (
							<motion.div
								key='accounts'
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className='space-y-3'
							>
								{accounts.map((account, idx) => (
									<motion.button
										key={account.id}
										initial={{ opacity: 0, x: -10 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: idx * 0.05 }}
										type='button'
										onClick={() => handleAccountLogin(account)}
										disabled={loading}
										className='group relative flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition-all disabled:opacity-50'
									>
										<div className='relative w-12 h-12 rounded-full overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shrink-0'>
											{account.avatar_url ? (
												<img
													src={account.avatar_url}
													alt={account.username}
													className='w-full h-full object-cover'
												/>
											) : (
												account.username.charAt(0).toUpperCase()
											)}
										</div>
										<div className='flex-1 min-w-0'>
											<p className='text-white font-medium truncate'>
												{account.username}
											</p>
												<p className="text-sm text-gray-400 truncate">
													{account.email}
												</p>
												{isStale(account) && (
													<p className="text-xs text-amber-400 mt-0.5">
														Требуется повторная авторизация
													</p>
												)}
										</div>
										<span className='text-sm font-semibold text-indigo-400 group-hover:text-indigo-300'>
											Войти
										</span>

										<button
											type='button'
											onClick={e => handleRemove(e, account.id)}
											className='absolute top-2 right-2 p-1 rounded-full text-gray-500 hover:text-red-400 hover:bg-white/5 opacity-0 group-hover:opacity-100 transition-all'
											title='Удалить аккаунт'
										>
											<svg
												xmlns='http://www.w3.org/2000/svg'
												width='14'
												height='14'
												viewBox='0 0 24 24'
												fill='none'
												stroke='currentColor'
												strokeWidth='2'
												strokeLinecap='round'
												strokeLinejoin='round'
											>
												<line x1='18' y1='6' x2='6' y2='18' />
												<line x1='6' y1='6' x2='18' y2='18' />
											</svg>
										</button>
									</motion.button>
								))}

								<button
									type='button'
									onClick={() => loginWithVondic({ forceLogin: true })}
									className='group relative flex w-full items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-left hover:bg-white/10 transition-all'
								>
									<div className='w-12 h-12 rounded-full bg-white/10 flex items-center justify-center shrink-0'>
										<svg
											xmlns='http://www.w3.org/2000/svg'
											width='20'
											height='20'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='2'
											strokeLinecap='round'
											strokeLinejoin='round'
											className='text-gray-400'
										>
											<line x1='12' y1='5' x2='12' y2='19' />
											<line x1='5' y1='12' x2='19' y2='12' />
										</svg>
									</div>
									<div>
										<p className='text-white font-medium'>
											Войти в другой аккаунт
										</p>
									</div>
								</button>
							</motion.div>
						) : (
							<motion.div
								key='login'
								initial={{ opacity: 0 }}
								animate={{ opacity: 1 }}
								exit={{ opacity: 0 }}
								className='space-y-4'
							>
								<button
									type='button'
									onClick={handleLogin}
									disabled={loading}
									className='group relative flex w-full justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3.5 text-sm font-bold text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed'
								>
									{loading ? 'Открытие окна...' : 'Войти через Вондик'}
								</button>
								{accounts.length > 0 && (
									<button
										type='button'
										onClick={() => setShowAll(false)}
										className='w-full text-center text-xs text-indigo-400 hover:text-indigo-300 transition-colors'
									>
										← Назад к сохранённым аккаунтам
									</button>
								)}
							</motion.div>
						)}
					</AnimatePresence>

					{error && (
						<p className='text-center text-sm text-red-400'>{error}</p>
					)}
				</div>

				<div className='flex items-center justify-center gap-4 text-xs'>
					<a
						href={`${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://vondic.knopusmedia.ru'}/register`}
						target='_blank'
						rel='noopener noreferrer'
						className='text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						Регистрация
					</a>
					<span className='text-gray-600'>|</span>
					<a
						href={`${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://vondic.knopusmedia.ru'}/forgot-password`}
						target='_blank'
						rel='noopener noreferrer'
						className='text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						Забыли пароль?
					</a>
				</div>

				<p className='text-center text-xs text-gray-500'>
					Входя, вы соглашаетесь с{' '}
					<a
						href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/privacy_policy.rtf`}
						target='_blank'
						rel='noopener noreferrer'
						className='text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						политикой конфиденциальности
					</a>{' '}
					и{' '}
					<a
						href={`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'}/static/docs/consent_to_processing_personal_data.rtf`}
						target='_blank'
						rel='noopener noreferrer'
						className='text-indigo-400 hover:text-indigo-300 transition-colors'
					>
						согласием на обработку данных
					</a>
					.
				</p>
			</div>
		</div>
	)
}
