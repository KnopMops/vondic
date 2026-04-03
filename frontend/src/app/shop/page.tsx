'use client'
import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import {
	Coins,
	Flame,
	Flower,
	Gift,
	Heart,
	Star,
	Coffee,
	Crown,
	HelpCircle,
} from 'lucide-react'
import { useEffect, useState } from 'react'

export default function ShopPage() {
	const { user } = useAuth()
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [balanceOverride, setBalanceOverride] = useState<number | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [selectedGift, setSelectedGift] = useState<any | null>(null)
	const [quantity, setQuantity] = useState(1)
	const [giftLoading, setGiftLoading] = useState(false)
	const [giftError, setGiftError] = useState<string | null>(null)
	const [showAll, setShowAll] = useState(false)
	const [giftMode, setGiftMode] = useState(false)
	const [friends, setFriends] = useState<any[]>([])
	const [friendsLoading, setFriendsLoading] = useState(false)
	const [friendsError, setFriendsError] = useState<string | null>(null)
	const [recipientId, setRecipientId] = useState<string | null>(null)
	const [giftComment, setGiftComment] = useState('')
	const [showHowToModal, setShowHowToModal] = useState(false)

	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
	const staticGiftImages: Record<string, string> = {
		newyear_fireworks: '/static/gifts/firework.png',
		valentine_heart: '/static/gifts/bouquet.png',
		womens_day_bouquet: '/static/gifts/female_day.png',
		birthday_cake: '/static/gifts/Birthday.png',
		halloween_pumpkin: '/static/gifts/pumpkin.png',
		easter_egg: '/static/gifts/egg.png',
		christmas_gift: '/static/gifts/present.png',
		knowledge_day_coffee: '/static/gifts/knowledge.png',
		anniversary_crown: '/static/gifts/crown.png',
		party_flame: '/static/gifts/fire.png',
		partner_badge: '/static/gifts/partner.png',
		gold_star: '/static/gifts/star.png',
	}
	const iconMap: Record<string, any> = {
		Flame,
		Heart,
		Flower,
		Gift,
		Coffee,
		Crown,
		Star,
	}

	const [gifts, setGifts] = useState<any[]>([])
	useEffect(() => {
		const fetchGifts = async () => {
			try {
				const res = await fetch(`${backendUrl}/api/v1/gifts/`, {
					method: 'GET',
				})
				if (!res.ok) {
					const text = await res.text()
					throw new Error(text || 'Ошибка загрузки подарков')
				}
				const data = await res.json()
				setGifts(Array.isArray(data) ? data : [])
			} catch (e: any) {
				setError(e.message || 'Не удалось загрузить подарки')
			}
		}
		fetchGifts()
	}, [backendUrl])

	const openGiftModal = (gift: any) => {
		setSelectedGift(gift)
		setQuantity(1)
		setGiftError(null)
		setGiftMode(false)
		setRecipientId(null)
		setIsModalOpen(true)
	}

	const closeGiftModal = () => {
		setIsModalOpen(false)
		setSelectedGift(null)
		setGiftError(null)
	}

	const toggleGiftMode = async () => {
		if (!giftMode) {
			setFriendsError(null)
			setFriendsLoading(true)
			try {
				const res = await fetch('/api/friends/list', { method: 'POST' })
				let data: any = null
				try {
					data = await res.json()
				} catch {
					data = null
				}
				if (!res.ok) {
					const raw = data && typeof data === 'object' ? data.error : null
					const msg =
						raw === 'Unauthorized'
							? 'Требуется авторизация для загрузки списка друзей'
							: raw || 'Ошибка загрузки друзей'
					throw new Error(msg)
				}
				setFriends(Array.isArray(data) ? data : [])
			} catch (e: any) {
				setFriendsError(e.message || 'Не удалось загрузить друзей')
			} finally {
				setFriendsLoading(false)
			}
		}
		setGiftMode(prev => !prev)
	}

	const sendGiftToFriend = async () => {
		if (!selectedGift || !recipientId) {
			setGiftError('Выберите друга для подарка')
			return
		}
		setGiftLoading(true)
		setGiftError(null)
		try {
			const meRes = await fetch('/api/auth/me', { method: 'GET' })
			if (!meRes.ok) {
				throw new Error('Требуется авторизация')
			}
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (!token) throw new Error('Требуется авторизация')
			const res = await fetch(`${backendUrl}/api/v1/users/send-gift`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					access_token: token,
					target_user_id: recipientId,
					gift_id: selectedGift.id,
					quantity,
					comment: giftComment.trim() || undefined,
				}),
			})
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || 'Ошибка отправки подарка')
			}
			await res.json()
			setIsModalOpen(false)
			setGiftComment('')
		} catch (e: any) {
			setGiftError(e.message || 'Не удалось отправить подарок')
		} finally {
			setGiftLoading(false)
		}
	}

	const buyGift = async () => {
		if (!selectedGift) {
			setGiftError('Требуется авторизация')
			return
		}
		setGiftLoading(true)
		setGiftError(null)
		try {
			const meRes = await fetch('/api/auth/me', { method: 'GET' })
			if (!meRes.ok) {
				throw new Error('Требуется авторизация')
			}
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (!token) throw new Error('Требуется авторизация')
			const res = await fetch(`${backendUrl}/api/v1/users/purchase-gift`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					access_token: token,
					gift_id: selectedGift.id,
					quantity,
				}),
			})
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || 'Ошибка покупки подарка')
			}
			await res.json()
			setIsModalOpen(false)
		} catch (e: any) {
			setGiftError(e.message || 'Не удалось купить подарок')
			setGiftLoading(false)
		}
	}

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-20'>
				<Header email={user?.email || ''} onLogout={() => {}} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-7xl pt-6'>
				<Sidebar />
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<div className='mx-auto max-w-5xl'>
						<h1 className='text-2xl font-bold text-white'>Магазин</h1>
						<p className='mt-1 text-gray-400'>
							Поддержите проект и получите расширенные возможности
						</p>
						<div className='mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm'>
							<div className='flex items-center gap-3 text-white'>
								<div className='h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center'>
									<Coins className='h-5 w-5 text-indigo-300' />
								</div>
								<div className='flex-1'>
									<div className='text-sm text-gray-400'>Ваш баланс</div>
									<div className='text-lg font-semibold'>
										{typeof balanceOverride === 'number'
											? balanceOverride
											: typeof user?.balance === 'number'
												? user.balance
												: 0}{' '}
										Вондик Coins
									</div>
								</div>
								<button
									onClick={() => setShowHowToModal(true)}
									className='flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm text-white hover:bg-white/20 transition-colors'
								>
									<HelpCircle className='h-4 w-4' />
									Как пополнить?
								</button>
							</div>
						</div>

						{error && (
							<div className='mt-4 rounded-lg border border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300'>
								{error}
							</div>
						)}

						<div className='mt-6 grid grid-cols-1 gap-6'>
							<div className='rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
								<div className='text-lg font-semibold text-gray-900 dark:text-white'>
									Подарки
								</div>
								<div className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
									Отправляйте виртуальные подарки друзьям
								</div>
								<div className='mt-4 grid grid-cols-2 gap-3'>
									{(showAll ? gifts : gifts.slice(0, 4)).map(g => {
										const Icon = iconMap[g.icon as string] || Gift
										const backendImage =
											typeof g.imageUrl === 'string' && g.imageUrl
												? g.imageUrl.startsWith('http')
													? g.imageUrl
													: `${backendUrl}${g.imageUrl}`
												: null
										const staticImageUrl =
											typeof g.id === 'string'
												? staticGiftImages[g.id] || null
												: null
										const imgSrc = backendImage || staticImageUrl || null
										const hasImage = !!imgSrc
										const supply =
											typeof g.totalSupply === 'number'
												? g.totalSupply
												: g.totalSupply != null
													? Number(g.totalSupply)
													: null
										const minted =
											typeof g.mintedCount === 'number'
												? g.mintedCount
												: g.mintedCount != null
													? Number(g.mintedCount)
													: null
										const limitLabel =
											supply && minted != null
												? `${minted}/${supply}`
												: supply
													? `до ${supply} шт.`
													: null
										return (
											<button
												key={g.id}
												onClick={() => openGiftModal(g)}
												className='flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-left hover:bg-white/60 dark:border-gray-700 dark:hover:bg-white/10'
											>
												{hasImage && imgSrc ? (
													<img
														src={imgSrc}
														alt={g.name}
														className='h-8 w-8 rounded object-contain'
													/>
												) : (
													<Icon className='h-5 w-5 text-pink-600 dark:text-pink-400' />
												)}
												<span className='text-sm text-gray-900 dark:text-gray-200'>
													{g.name}
												</span>
												<div className='ml-auto flex flex-col items-end gap-0.5'>
													<span className='text-xs text-gray-600 dark:text-gray-400'>
														{g.coinPrice} коинов
													</span>
													{limitLabel && (
														<span className='text-[10px] text-indigo-600 dark:text-indigo-300'>
															{limitLabel}
														</span>
													)}
												</div>
											</button>
										)
									})}
								</div>
								<div className='mt-3'>
									<button
										onClick={() => setShowAll(true)}
										className='w-full rounded-xl bg-gray-900 px-4 py-2 text-white hover:bg-black dark:bg-gray-700 dark:hover:bg-gray-600'
									>
										Все подарки
									</button>
								</div>
							</div>
						</div>

						{isModalOpen && selectedGift && (
							<div className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50'>
								<div className='w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800'>
									<div className='flex items-center gap-3'>
										{(() => {
											const Icon = iconMap[selectedGift.icon as string] || Gift
											const backendImage =
												typeof selectedGift.imageUrl === 'string' &&
												selectedGift.imageUrl
													? selectedGift.imageUrl.startsWith('http')
														? selectedGift.imageUrl
														: `${backendUrl}${selectedGift.imageUrl}`
													: null
											const staticImageUrl =
												typeof selectedGift.id === 'string'
													? staticGiftImages[selectedGift.id] || null
													: null
											const imgSrc = backendImage || staticImageUrl
											const hasImage = !!imgSrc
											return hasImage && imgSrc ? (
												<img
													src={imgSrc}
													alt={selectedGift.name}
													className='h-10 w-10 rounded object-contain'
												/>
											) : (
												<Icon className='h-6 w-6 text-pink-600 dark:text-pink-400' />
											)
										})()}
										<div className='text-lg font-semibold text-gray-900 dark:text-white'>
											{selectedGift.name}
										</div>
									</div>
									<div className='mt-2 text-sm text-gray-600 dark:text-gray-400'>
										{selectedGift.desc}
									</div>
									<div className='mt-4'>
										<div className='text-sm text-gray-900 dark:text-gray-200'>
											Количество
										</div>
										<div className='mt-2 flex items-center gap-2'>
											<button
												onClick={() => setQuantity(q => Math.max(1, q - 1))}
												className='rounded-lg border border-gray-300 px-3 py-1 dark:border-gray-600'
											>
												-
											</button>
											<div className='min-w-12 rounded-lg border border-gray-300 px-3 py-1 text-center dark:border-gray-600'>
												{quantity}
											</div>
											<button
												onClick={() => setQuantity(q => Math.min(20, q + 1))}
												className='rounded-lg border border-gray-300 px-3 py-1 dark:border-gray-600'
											>
												+
											</button>
										</div>
										<div className='mt-3 text-sm text-gray-600 dark:text-gray-400'>
											Итого: {selectedGift.coinPrice * quantity} коинов
										</div>
										<div className='mt-4'>
											<div className='flex items-center justify-between'>
												<div className='text-sm text-gray-900 dark:text-gray-200'>
													Режим
												</div>
												<button
													onClick={toggleGiftMode}
													className='rounded-lg border border-gray-300 px-3 py-1 text-sm dark:border-gray-600'
												>
													{giftMode ? 'Подарить другу' : 'Подарить'}
												</button>
											</div>
											{giftMode && (
												<div className='mt-3 space-y-3'>
													<div>
														<div className='text-sm text-gray-900 dark:text-gray-200'>
															Выберите друга
														</div>
														{friendsError && (
															<div className='mt-2 rounded-lg border border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300'>
																{friendsError}
															</div>
														)}
														<div className='mt-2 max-h-44 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700'>
															{friendsLoading ? (
																<div className='p-3 text-sm text-gray-600 dark:text-gray-400'>
																	Загрузка…
																</div>
															) : friends.length === 0 ? (
																<div className='p-3 text-sm text-gray-600 dark:text-gray-400'>
																	Список друзей пуст
																</div>
															) : (
																<div className='divide-y divide-gray-200 dark:divide-gray-700'>
																	{friends.map((f: any) => (
																		<button
																			key={f.id}
																			onClick={() =>
																				setRecipientId(String(f.id))
																			}
																			className={`flex w-full items-center gap-2 p-3 text-left hover:bg-gray-50 dark:hover:bg-white/10 ${recipientId === String(f.id) ? 'bg-gray-100 dark:bg-white/10' : ''}`}
																		>
																			<div className='h-8 w-8 rounded-full bg-white/10' />
																			<div className='flex-1'>
																				<div className='text-sm text-gray-900 dark:text-gray-200'>
																					{f.username ||
																						`Пользователь ${String(f.id).slice(0, 6)}`}
																				</div>
																				<div className='text-xs text-gray-600 dark:text-gray-400'>
																					{f.email || ''}
																				</div>
																			</div>
																			<div className='text-xs text-gray-500'>
																				{recipientId === String(f.id)
																					? 'Выбран'
																					: 'Выбрать'}
																			</div>
																		</button>
																	))}
																</div>
															)}
														</div>
													</div>
													<div>
														<div className='text-sm text-gray-900 dark:text-gray-200'>
															Подпись к подарку
														</div>
														<textarea
															value={giftComment}
															onChange={e => setGiftComment(e.target.value)}
															rows={3}
															maxLength={280}
															placeholder='Напишите пару слов для получателя'
															className='mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
														/>
														<div className='mt-1 text-xs text-gray-500 dark:text-gray-400 text-right'>
															{giftComment.length}/280
														</div>
													</div>
												</div>
											)}
										</div>
									</div>
									{giftError && (
										<div className='mt-3 rounded-lg border border-red-500 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-600 dark:bg-red-900/30 dark:text-red-300'>
											{giftError}
										</div>
									)}
									<div className='mt-6 flex items-center gap-3'>
										{giftMode ? (
											<button
												onClick={sendGiftToFriend}
												disabled={giftLoading || !recipientId}
												className='flex-1 rounded-xl bg-pink-600 px-4 py-2 text-white hover:bg-pink-700 disabled:opacity-50'
											>
												{giftLoading ? 'Отправка…' : 'Отправить'}
											</button>
										) : (
											<button
												onClick={buyGift}
												disabled={giftLoading}
												className='flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50'
											>
												{giftLoading ? 'Перенаправление…' : 'Купить'}
											</button>
										)}
										<button
											onClick={closeGiftModal}
											className='rounded-xl border border-gray-300 px-4 py-2 text-gray-900 hover:bg-gray-100 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-white/10'
										>
											Отмена
										</button>
									</div>
								</div>
							</div>
						)}

						{showHowToModal && (
							<div className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50'>
								<div className='w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800'>
									<div className='flex items-center gap-3'>
										<div className='h-10 w-10 rounded-xl bg-indigo-500/20 flex items-center justify-center'>
											<HelpCircle className='h-5 w-5 text-indigo-300' />
										</div>
										<div className='text-lg font-semibold text-gray-900 dark:text-white'>
											Как пополнить баланс?
										</div>
									</div>
									<div className='mt-4 space-y-3 text-sm text-gray-700 dark:text-gray-300'>
										<p>
											Для пополнения баланса вам нужно:
										</p>
										<ol className='list-decimal list-inside space-y-2'>
											<li>
												Зайдите во вкладку <strong>Мессенджер</strong>
											</li>
											<li>
												В поиске чатов напишите <strong className='text-indigo-500'>Вондик BOT</strong>
											</li>
											<li>
												Напишите ему команду <code className='rounded bg-gray-100 px-1.5 py-0.5 text-xs font-mono dark:bg-gray-700'>/start</code>
											</li>
										</ol>
										<p className='text-xs text-gray-500 dark:text-gray-400'>
											После этого бот поможет вам пополнить баланс удобным способом.
										</p>
									</div>
									<div className='mt-6'>
										<button
											onClick={() => setShowHowToModal(false)}
											className='w-full rounded-xl bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700'
										>
											Понятно
										</button>
									</div>
								</div>
							</div>
						)}
					</div>
				</main>
			</div>
		</div>
	)
}
