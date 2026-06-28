'use client'

import { useAuth } from '@/lib/AuthContext'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
    LuCrown as Crown,
    LuGift as Gift,
    LuSparkles as Sparkles,
    LuX as X,
    LuZap as Zap,
} from 'react-icons/lu'

type Props = {
	isOpen: boolean
	onClose: () => void
}

type Tab = 'premium' | 'gift-premium'

const PREMIUM_PRICE = 50

export default function PremiumModal({ isOpen, onClose }: Props) {
	const { user } = useAuth()
	const router = useRouter()
	const [tab, setTab] = useState<Tab>('premium')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [note, setNote] = useState<string | null>(null)
	const [search, setSearch] = useState('')
	const [hits, setHits] = useState<{ id: string; username: string }[]>([])
	const [searchLoading, setSearchLoading] = useState(false)
	const [recipientId, setRecipientId] = useState<string | null>(null)
	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

	useEffect(() => {
		if (!isOpen) {
			setTab('premium')
			setError(null)
			setNote(null)
			setSearch('')
			setHits([])
			setRecipientId(null)
		}
	}, [isOpen])

	useEffect(() => {
		if (!isOpen || tab === 'premium') return
		if (!search.trim()) {
			setHits([])
			return
		}
		const q = search.trim()
		const t = setTimeout(async () => {
			setSearchLoading(true)
			try {
				const meRes = await fetch('/api/auth/me')
				if (!meRes.ok) return
				const meData = await meRes.json()
				const token = meData?.user?.access_token || meData?.access_token
				if (!token) return
				const res = await fetch(`${backendUrl}/api/v1/users/search`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ access_token: token, query: q }),
				})
				if (!res.ok) return
				const data = await res.json()
				setHits(Array.isArray(data) ? data : [])
			} catch {
				setHits([])
			} finally {
				setSearchLoading(false)
			}
		}, 400)
		return () => clearTimeout(t)
	}, [search, isOpen, tab, backendUrl])

	const getToken = async () => {
		const meRes = await fetch('/api/auth/me')
		if (!meRes.ok) throw new Error('Требуется авторизация')
		const meData = await meRes.json()
		const token = meData?.user?.access_token || meData?.access_token
		if (!token) throw new Error('Требуется авторизация')
		return token
	}

	const buyPremium = async () => {
		setLoading(true)
		setError(null)
		setNote(null)
		try {
			const token = await getToken()
			const res = await fetch(`${backendUrl}/api/v1/users/buy-premium-coins`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error || 'Не удалось купить Premium')
			setNote('Premium на 30 дней активирован!')
			router.refresh()
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Ошибка')
		} finally {
			setLoading(false)
		}
	}

	const giftPremium = async () => {
		if (!recipientId) {
			setError('Выберите получателя')
			return
		}
		setLoading(true)
		setError(null)
		try {
			const token = await getToken()
			const res = await fetch(`${backendUrl}/api/v1/users/gift-premium-coins`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					access_token: token,
					target_user_id: recipientId,
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error || 'Не удалось подарить Premium')
			setNote('Premium подарен на 30 дней!')
			setRecipientId(null)
			setSearch('')
			router.refresh()
		} catch (e: unknown) {
			setError(e instanceof Error ? e.message : 'Ошибка')
		} finally {
			setLoading(false)
		}
	}

	const tabs: { id: Tab; label: string; icon: typeof Crown }[] = [
		{ id: 'premium', label: 'Premium', icon: Crown },
		{ id: 'gift-premium', label: 'Подарить Premium', icon: Gift },
	]

	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
					onClick={onClose}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.95, y: 12 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.95, y: 12 }}
						transition={{ duration: 0.25 }}
						className='w-full max-w-lg rounded-3xl border border-white/10 bg-gradient-to-br from-[#0b1220] to-[#1a1035] shadow-2xl overflow-hidden'
						onClick={e => e.stopPropagation()}
					>
						<div className='relative p-6 pb-4 border-b border-white/10'>
							<div className='absolute -top-16 -right-16 w-48 h-48 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none' />
							<button
								type='button'
								onClick={onClose}
								className='absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors'
							>
								<X className='w-5 h-5' />
							</button>
							<div className='flex items-center gap-3'>
								<div className='p-3 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30'>
									<Zap className='w-6 h-6 text-white fill-current' />
								</div>
								<div>
									<h2 className='text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500'>
										Вондик Premium
									</h2>
									<p className='text-xs text-gray-400 mt-0.5'>
										Баланс:{' '}
										<span className='text-amber-300 font-semibold'>
											{user?.balance ?? 0}
										</span>{' '}
										коинов
									</p>
								</div>
							</div>
						</div>

						<div className='flex gap-1 p-2 border-b border-white/10 bg-black/20'>
							{tabs.map(t => {
								const Icon = t.icon
								return (
									<button
										key={t.id}
										type='button'
										onClick={() => {
											setTab(t.id)
											setError(null)
											setNote(null)
										}}
										className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-[11px] sm:text-xs font-medium transition-all ${
											tab === t.id
												? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
												: 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
										}`}
									>
										<Icon className='w-3.5 h-3.5 shrink-0' />
										<span className='truncate'>{t.label}</span>
									</button>
								)
							})}
						</div>

						<div className='p-6 space-y-4'>
							{tab === 'premium' && (
								<>
									<ul className='space-y-2 text-sm text-gray-300'>
										<li className='flex items-center gap-2'>
											<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
											2 ГБ хранилища и файлы до 100 МБ
										</li>
										<li className='flex items-center gap-2'>
											<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
											GIF-аватарки и фон профиля
										</li>
										<li className='flex items-center gap-2'>
											<Sparkles className='w-4 h-4 text-amber-400 shrink-0' />
											Без рекламы в видеоплеере
										</li>
									</ul>
									<p className='text-sm text-gray-400'>
										Подписка на 30 дней за{' '}
										<span className='text-amber-300 font-semibold'>
											{PREMIUM_PRICE}
										</span>{' '}
										коинов
									</p>
									<button
										type='button'
										disabled={loading || !!user?.premium}
										onClick={buyPremium}
										className='w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-95 transition-opacity'
									>
										{loading
											? 'Оформление…'
											: user?.premium
												? 'Premium уже активен'
												: `Купить за ${PREMIUM_PRICE} коинов`}
									</button>
									<p className='text-center text-xs text-gray-500'>
										Подарки и передача коинов — в{' '}
										<a href='/shop' className='text-indigo-400 hover:underline'>
											магазине
										</a>
									</p>
								</>
							)}

							{tab === 'gift-premium' && (
								<>
									<input
										value={search}
										onChange={e => {
											setSearch(e.target.value)
											setRecipientId(null)
										}}
										placeholder='Поиск по нику…'
										className='w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 outline-none'
									/>
									{searchLoading && (
										<p className='text-xs text-gray-500'>Поиск…</p>
									)}
									{hits.length > 0 && (
										<div className='max-h-36 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5'>
											{hits.map(u => (
												<button
													key={u.id}
													type='button'
													onClick={() => {
														setRecipientId(String(u.id))
														setSearch(u.username)
														setHits([])
													}}
													className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
														recipientId === String(u.id)
															? 'bg-indigo-500/10 text-indigo-300'
															: 'text-gray-200'
													}`}
												>
													{u.username}
												</button>
											))}
										</div>
									)}
									<button
										type='button'
										disabled={loading}
										onClick={giftPremium}
										className='w-full rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 py-3 text-sm font-semibold text-white disabled:opacity-50 hover:from-indigo-500 hover:to-purple-500 transition-all'
									>
										{loading
											? 'Отправка…'
											: `Подарить Premium (${PREMIUM_PRICE} коинов)`}
									</button>
								</>
							)}

							{error && (
								<p className='text-sm text-red-400 text-center'>{error}</p>
							)}
							{note && (
								<p className='text-sm text-emerald-400 text-center'>{note}</p>
							)}
						</div>
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
