'use client'
import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import { useAuth } from '@/lib/AuthContext'
import { getAttachmentUrl } from '@/lib/utils'
import {
	FiCoffee as Coffee,
	FiHelpCircle as HelpCircle,
} from 'react-icons/fi'
import {
	LuCoins as Coins,
	LuCrown as Crown,
	LuFlame as Flame,
	LuFlower as Flower,
	LuGift as Gift,
	LuHeart as Heart,
	LuStar as Star,
} from 'react-icons/lu'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function ShopPage() {
	const { user } = useAuth()
	const router = useRouter()
	const [premiumLoading, setPremiumLoading] = useState(false)
	const [premiumNote, setPremiumNote] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [balanceOverride, setBalanceOverride] = useState<number | null>(null)
	const [isModalOpen, setIsModalOpen] = useState(false)
	const [selectedGift, setSelectedGift] = useState<any | null>(null)
	const [giftLoading, setGiftLoading] = useState(false)
	const [giftError, setGiftError] = useState<string | null>(null)
	const [showAll, setShowAll] = useState(false)
	const [giftMode, setGiftMode] = useState(false)
	const [friends, setFriends] = useState<any[]>([])
	const [friendsLoading, setFriendsLoading] = useState(false)
	const [friendsError, setFriendsError] = useState<string | null>(null)
	const [recipientId, setRecipientId] = useState<string | null>(null)
	const [recipientSearch, setRecipientSearch] = useState('')
	const [userSearchHits, setUserSearchHits] = useState<any[]>([])
	const [userSearchLoading, setUserSearchLoading] = useState(false)
	const [giftComment, setGiftComment] = useState('')
	const [showHowToModal, setShowHowToModal] = useState(false)
	const [premiumGiftOpen, setPremiumGiftOpen] = useState(false)
	const [premiumRecipientId, setPremiumRecipientId] = useState<string | null>(null)
	const [premiumSearch, setPremiumSearch] = useState('')
	const [premiumHits, setPremiumHits] = useState<any[]>([])
	const [premiumSearchLoading, setPremiumSearchLoading] = useState(false)
	const [premiumGiftLoading, setPremiumGiftLoading] = useState(false)
	const [premiumGiftError, setPremiumGiftError] = useState<string | null>(null)
	const [coinRecipientId, setCoinRecipientId] = useState<string | null>(null)
	const [coinSearch, setCoinSearch] = useState('')
	const [coinHits, setCoinHits] = useState<any[]>([])
	const [coinSearchLoading, setCoinSearchLoading] = useState(false)
	const [coinAmount, setCoinAmount] = useState('10')
	const [coinTransferLoading, setCoinTransferLoading] = useState(false)
	const [coinTransferError, setCoinTransferError] = useState<string | null>(null)
	const [coinTransferNote, setCoinTransferNote] = useState<string | null>(null)

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
				const res = await fetch('/api/v1/gifts', {
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
	}, [])

	useEffect(() => {
		if (!giftMode || !recipientSearch.trim()) {
			setUserSearchHits([])
			return
		}
		const q = recipientSearch.trim()
		const t = setTimeout(async () => {
			setUserSearchLoading(true)
			try {
				const meRes = await fetch('/api/auth/me', { method: 'GET' })
				if (!meRes.ok) {
					setUserSearchHits([])
					return
				}
				const meData = await meRes.json()
				const token = meData?.user?.access_token || meData?.access_token
				if (!token) {
					setUserSearchHits([])
					return
				}
				const res = await fetch('/api/users/search', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ access_token: token, query: q }),
				})
				if (!res.ok) {
					setUserSearchHits([])
					return
				}
				const data = await res.json()
				setUserSearchHits(Array.isArray(data) ? data : [])
			} catch {
				setUserSearchHits([])
			} finally {
				setUserSearchLoading(false)
			}
		}, 400)
		return () => clearTimeout(t)
	}, [recipientSearch, giftMode])

	useEffect(() => {
		if (!premiumGiftOpen || !premiumSearch.trim()) {
			setPremiumHits([])
			return
		}
		const q = premiumSearch.trim()
		const t = setTimeout(async () => {
			setPremiumSearchLoading(true)
			try {
				const meRes = await fetch('/api/auth/me', { method: 'GET' })
				if (!meRes.ok) {
					setPremiumHits([])
					return
				}
				const meData = await meRes.json()
				const token = meData?.user?.access_token || meData?.access_token
				if (!token) {
					setPremiumHits([])
					return
				}
				const res = await fetch('/api/users/search', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ access_token: token, query: q }),
				})
				if (!res.ok) {
					setPremiumHits([])
					return
				}
				const data = await res.json()
				setPremiumHits(Array.isArray(data) ? data : [])
			} catch {
				setPremiumHits([])
			} finally {
				setPremiumSearchLoading(false)
			}
		}, 400)
		return () => clearTimeout(t)
	}, [premiumSearch, premiumGiftOpen])

	useEffect(() => {
		if (!coinSearch.trim()) {
			setCoinHits([])
			return
		}
		const q = coinSearch.trim()
		const t = setTimeout(async () => {
			setCoinSearchLoading(true)
			try {
				const meRes = await fetch('/api/auth/me', { method: 'GET' })
				if (!meRes.ok) {
					setCoinHits([])
					return
				}
				const meData = await meRes.json()
				const token = meData?.user?.access_token || meData?.access_token
				if (!token) {
					setCoinHits([])
					return
				}
				const res = await fetch('/api/users/search', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ access_token: token, query: q }),
				})
				if (!res.ok) {
					setCoinHits([])
					return
				}
				const data = await res.json()
				setCoinHits(Array.isArray(data) ? data : [])
			} catch {
				setCoinHits([])
			} finally {
				setCoinSearchLoading(false)
			}
		}, 400)
		return () => clearTimeout(t)
	}, [coinSearch])

	const openGiftModal = (gift: any) => {
		setSelectedGift(gift)
		setGiftError(null)
		setGiftMode(false)
		setRecipientId(null)
		setRecipientSearch('')
		setUserSearchHits([])
		setIsModalOpen(true)
	}

	const closeGiftModal = () => {
		setIsModalOpen(false)
		setSelectedGift(null)
		setGiftError(null)
		setRecipientSearch('')
		setUserSearchHits([])
	}

	const toggleGiftMode = async () => {
		if (giftMode) {
			setRecipientSearch('')
			setUserSearchHits([])
		}
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

	const openPremiumGiftModal = () => {
		setPremiumGiftOpen(true)
		setPremiumRecipientId(null)
		setPremiumSearch('')
		setPremiumHits([])
		setPremiumGiftError(null)
	}

	const closePremiumGiftModal = () => {
		setPremiumGiftOpen(false)
		setPremiumRecipientId(null)
		setPremiumGiftError(null)
	}

	const sendPremiumGift = async () => {
		if (!premiumRecipientId) {
			setPremiumGiftError('Выберите получателя')
			return
		}
		setPremiumGiftLoading(true)
		setPremiumGiftError(null)
		try {
			const meRes = await fetch('/api/auth/me', { method: 'GET' })
			if (!meRes.ok) throw new Error('Требуется авторизация')
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (!token) throw new Error('Требуется авторизация')
			const res = await fetch(`/api/v1/users/gift-premium-coins`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					access_token: token,
					target_user_id: premiumRecipientId,
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || data.message || 'Не удалось подарить Premium')
			}
			setBalanceOverride(typeof data.balance === 'number' ? data.balance : null)
			setPremiumNote('Premium подарен получателю на 30 дней.')
			closePremiumGiftModal()
			router.refresh()
		} catch (e: any) {
			setPremiumGiftError(e.message || 'Ошибка')
		} finally {
			setPremiumGiftLoading(false)
		}
	}

	const sendGiftToFriend = async () => {
		if (!selectedGift || !recipientId) {
			setGiftError('Выберите получателя (друг или по поиску)')
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
			const res = await fetch(`/api/v1/users/send-gift`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					access_token: token,
					target_user_id: recipientId,
					gift_id: selectedGift.id,
					quantity: 1,
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

	const sendCoinTransfer = async () => {
		if (!coinRecipientId) {
			setCoinTransferError('Выберите получателя')
			return
		}
		const amount = parseInt(coinAmount, 10)
		if (!amount || amount < 1) {
			setCoinTransferError('Укажите количество коинов')
			return
		}
		setCoinTransferLoading(true)
		setCoinTransferError(null)
		setCoinTransferNote(null)
		try {
			const meRes = await fetch('/api/auth/me', { method: 'GET' })
			if (!meRes.ok) throw new Error('Требуется авторизация')
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (!token) throw new Error('Требуется авторизация')
			const res = await fetch(`/api/v1/users/gift-coins`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					access_token: token,
					target_user_id: coinRecipientId,
					amount,
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || data.message || 'Не удалось отправить коины')
			}
			setBalanceOverride(typeof data.balance === 'number' ? data.balance : null)
			setCoinTransferNote(`Передано ${amount} коинов`)
			setCoinRecipientId(null)
			setCoinSearch('')
			setCoinAmount('10')
			router.refresh()
		} catch (e: any) {
			setCoinTransferError(e.message || 'Ошибка')
		} finally {
			setCoinTransferLoading(false)
		}
	}

	const buyPremiumWithCoins = async () => {
		setPremiumLoading(true)
		setPremiumNote(null)
		try {
			const meRes = await fetch('/api/auth/me', { method: 'GET' })
			if (!meRes.ok) {
				throw new Error('Требуется авторизация')
			}
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (!token) throw new Error('Требуется авторизация')
			const res = await fetch(`/api/v1/users/buy-premium-coins`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || data.message || 'Не удалось купить Premium')
			}
			setBalanceOverride(typeof data.balance === 'number' ? data.balance : null)
			setPremiumNote('Premium на 30 дней активирован.')
			router.refresh()
		} catch (e: any) {
			setPremiumNote(e.message || 'Ошибка')
		} finally {
			setPremiumLoading(false)
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
			const res = await fetch(`/api/v1/users/purchase-gift`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					access_token: token,
					gift_id: selectedGift.id,
					quantity: 1,
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
							<div className='rounded-2xl border border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-indigo-500/10 p-6 shadow-sm dark:border-amber-500/40'>
								<div className='flex items-start gap-4'>
									<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20'>
										<Crown className='h-6 w-6 text-amber-300' />
									</div>
									<div className='flex-1'>
										<div className='text-lg font-semibold text-white'>
											Vondic Premium
										</div>
										<p className='mt-1 text-sm text-gray-400'>
											Подписка на 30 дней за{' '}
											<span className='font-semibold text-amber-200'>50</span> коинов
											из баланса.
										</p>
										{premiumNote && (
											<p
												className={`mt-2 text-sm ${premiumNote.includes('Ошиб') || premiumNote.includes('Недост') ? 'text-red-400' : 'text-emerald-400'}`}
											>
												{premiumNote}
											</p>
										)}
										<button
											type='button'
											disabled={premiumLoading}
											onClick={buyPremiumWithCoins}
											className='mt-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50 hover:opacity-95 transition-opacity'
										>
											{premiumLoading ? 'Оформление…' : 'Купить за 50 коинов'}
										</button>
										<button
											type='button'
											onClick={openPremiumGiftModal}
											className='mt-3 block w-full rounded-xl border border-amber-400/50 px-5 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-500/10 transition-colors'
										>
											Подарить Premium за 50 коинов (любому пользователю)
										</button>
									</div>
								</div>
							</div>

							<div className='rounded-2xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 p-6 shadow-sm'>
								<div className='flex items-start gap-4'>
									<div className='flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/20'>
										<Coins className='h-6 w-6 text-indigo-300' />
									</div>
									<div className='flex-1'>
										<div className='text-lg font-semibold text-white'>
											Передать коины
										</div>
										<p className='mt-1 text-sm text-gray-400'>
											Отправьте коины любому пользователю по нику
										</p>
										<div className='mt-4 space-y-3'>
											<input
												type='text'
												value={coinSearch}
												onChange={e => {
													setCoinSearch(e.target.value)
													setCoinRecipientId(null)
												}}
												placeholder='Поиск по username…'
												className='w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 outline-none'
											/>
											{coinSearchLoading && (
												<p className='text-xs text-gray-500'>Поиск…</p>
											)}
											{coinHits.length > 0 && (
												<div className='max-h-36 overflow-y-auto rounded-xl border border-white/10 divide-y divide-white/5'>
													{coinHits.map((u: any) => (
														<button
															key={u.id}
															type='button'
															onClick={() => {
																setCoinRecipientId(String(u.id))
																setCoinSearch(u.username)
																setCoinHits([])
															}}
															className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors ${
																coinRecipientId === String(u.id)
																	? 'bg-indigo-500/10 text-indigo-300'
																	: 'text-gray-200'
															}`}
														>
															{u.username}
														</button>
													))}
												</div>
											)}
											<input
												type='number'
												min={1}
												max={10000}
												value={coinAmount}
												onChange={e => setCoinAmount(e.target.value)}
												placeholder='Количество коинов'
												className='w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white placeholder:text-gray-500 focus:border-indigo-500 outline-none'
											/>
											{coinTransferError && (
												<p className='text-sm text-red-400'>{coinTransferError}</p>
											)}
											{coinTransferNote && (
												<p className='text-sm text-emerald-400'>{coinTransferNote}</p>
											)}
											<button
												type='button'
												disabled={coinTransferLoading || !coinRecipientId}
												onClick={sendCoinTransfer}
												className='rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:from-indigo-500 hover:to-purple-500 transition-all'
											>
												{coinTransferLoading ? 'Отправка…' : 'Передать коины'}
											</button>
										</div>
									</div>
								</div>
							</div>

							<div className='rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-800'>
								<div className='text-lg font-semibold text-gray-900 dark:text-white'>
									Подарки
								</div>
								<div className='mt-1 text-sm text-gray-500 dark:text-gray-400'>
									Отправляйте подарки любому пользователю (поиск по нику или друг)
								</div>
								<div className='mt-4 grid grid-cols-2 gap-3'>
									{(showAll ? gifts : gifts.slice(0, 4)).map(g => {
										const Icon = iconMap[g.icon as string] || Gift
										const backendImage =
											typeof g.imageUrl === 'string' && g.imageUrl
												? getAttachmentUrl(g.imageUrl)
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

						{premiumGiftOpen && (
							<div className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50'>
								<div className='w-full max-w-md rounded-2xl border border-amber-400/40 bg-gray-900 p-6 shadow-xl text-white'>
									<div className='flex items-center gap-3'>
										<div className='flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20'>
											<Crown className='h-5 w-5 text-amber-300' />
										</div>
										<div className='text-lg font-semibold'>Подарить Premium</div>
									</div>
									<p className='mt-2 text-sm text-gray-400'>
										30 дней за 50 коинов. Найдите пользователя по нику или вставьте
										его ID.
									</p>
									<div className='mt-4'>
										<label className='text-sm text-gray-300'>Поиск по username</label>
										<input
											type='text'
											value={premiumSearch}
											onChange={e => setPremiumSearch(e.target.value)}
											placeholder='Например: vondic'
											className='mt-2 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white'
										/>
										<div className='mt-2 max-h-36 overflow-y-auto rounded-lg border border-white/10'>
											{premiumSearchLoading ? (
												<div className='p-2 text-xs text-gray-500'>Поиск…</div>
											) : premiumHits.length === 0 ? (
												<div className='p-2 text-xs text-gray-500'>
													{premiumSearch.trim() ? 'Никого не найдено' : 'Введите запрос'}
												</div>
											) : (
												<div className='divide-y divide-white/10'>
													{premiumHits.map((u: any) => (
														<button
															key={u.id}
															type='button'
															onClick={() => setPremiumRecipientId(String(u.id))}
															className={`flex w-full items-center justify-between p-2 text-left text-sm hover:bg-white/5 ${premiumRecipientId === String(u.id) ? 'bg-amber-500/10' : ''}`}
														>
															<span>{u.username}</span>
															<span className='text-xs text-gray-500'>
																{premiumRecipientId === String(u.id)
																	? 'Выбран'
																	: 'Выбрать'}
															</span>
														</button>
													))}
												</div>
											)}
										</div>
									</div>
									{premiumGiftError && (
										<div className='mt-3 rounded-lg border border-red-500/50 bg-red-900/20 px-3 py-2 text-sm text-red-300'>
											{premiumGiftError}
										</div>
									)}
									<div className='mt-6 flex gap-3'>
										<button
											type='button'
											disabled={premiumGiftLoading || !premiumRecipientId}
											onClick={sendPremiumGift}
											className='flex-1 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-semibold text-black disabled:opacity-50'
										>
											{premiumGiftLoading ? 'Отправка…' : 'Подарить за 50 коинов'}
										</button>
										<button
											type='button'
											onClick={closePremiumGiftModal}
											className='rounded-xl border border-white/20 px-4 py-2 text-sm hover:bg-white/5'
										>
											Отмена
										</button>
									</div>
								</div>
							</div>
						)}

						{isModalOpen && selectedGift && (
							<div className='fixed inset-0 z-[1000] flex items-center justify-center bg-black/50'>
								<div className='w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-800'>
									<div className='flex items-center gap-3'>
										{(() => {
											const Icon = iconMap[selectedGift.icon as string] || Gift
											const backendImage =
												typeof selectedGift.imageUrl === 'string' &&
												selectedGift.imageUrl
													? getAttachmentUrl(selectedGift.imageUrl)
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
									<div className='mt-3 text-sm text-gray-600 dark:text-gray-400'>
										Цена: {selectedGift.coinPrice} коинов
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
													{giftMode ? 'Только купить' : 'Подарить'}
												</button>
											</div>
											{giftMode && (
												<div className='mt-3 space-y-3'>
													<div>
														<div className='text-sm text-gray-900 dark:text-gray-200'>
															Поиск получателя по нику
														</div>
														<input
															type='text'
															value={recipientSearch}
															onChange={e => setRecipientSearch(e.target.value)}
															placeholder='Начните вводить username…'
															className='mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100'
														/>
														<div className='mt-2 max-h-32 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700'>
															{userSearchLoading ? (
																<div className='p-2 text-xs text-gray-500'>Поиск…</div>
															) : userSearchHits.length === 0 ? (
																<div className='p-2 text-xs text-gray-500'>
																	{recipientSearch.trim()
																		? 'Никого не найдено'
																		: 'Введите запрос'}
																</div>
															) : (
																<div className='divide-y divide-gray-200 dark:divide-gray-700'>
																	{userSearchHits.map((u: any) => (
																		<button
																			key={u.id}
																			type='button'
																			onClick={() =>
																				setRecipientId(String(u.id))
																			}
																			className={`flex w-full items-center gap-2 p-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-white/10 ${recipientId === String(u.id) ? 'bg-gray-100 dark:bg-white/10' : ''}`}
																		>
																			<span className='font-medium text-gray-900 dark:text-gray-100'>
																				{u.username}
																			</span>
																			<span className='ml-auto text-xs text-gray-500'>
																				{recipientId === String(u.id)
																					? 'Выбран'
																					: 'Выбрать'}
																			</span>
																		</button>
																	))}
																</div>
															)}
														</div>
													</div>
													<div>
														<div className='text-sm text-gray-900 dark:text-gray-200'>
															Или выберите из друзей
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
												Откройте чат с{' '}
												<a
													href='/feed/messages?bot_id=vondic_bot'
													className='font-semibold text-indigo-500 hover:text-indigo-400 underline underline-offset-2'
												>
													Вондик BOT
												</a>
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
