'use client'

import { useAuth } from '@/lib/AuthContext'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { User } from '@/lib/types'
import { getAttachmentUrl } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import { Coffee, Crown, Flame, Flower, Gift, Heart, Star } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import Post from './Post'

type Props = {
	user: User
	currentUser: User | null
}

type VideoItem = {
	id: string
	title: string
	description?: string | null
	url: string
	poster?: string | null
	views?: number
	likes?: number
	duration?: number | null
	created_at?: string
}

export default function UserProfile({ user, currentUser }: Props) {
	const { user: authUser } = useAuth()
	const [isFriend, setIsFriend] = useState(false)
	const [isSubscribed, setIsSubscribed] = useState(false)
	const [isBlocked, setIsBlocked] = useState(Boolean((user as any).is_blocked))
	const [blockedByAdmin, setBlockedByAdmin] = useState<string | null>(
		(user as any).blocked_by_admin || null,
	)
	const [loading, setLoading] = useState(false)
	const [checkingStatus, setCheckingStatus] = useState(true)
	const [activeTab, setActiveTab] = useState<
		'posts' | 'friends' | 'gifts' | 'videos' | 'shorts' | 'video_info'
	>('posts')
	const [friends, setFriends] = useState<User[]>([])
	const [loadingFriends, setLoadingFriends] = useState(false)
	const [profilePosts, setProfilePosts] = useState<any[]>([])
	const [loadingPosts, setLoadingPosts] = useState(false)
	const [postsPage, setPostsPage] = useState(1)
	const [hasMorePosts, setHasMorePosts] = useState(true)
	const [profileVideos, setProfileVideos] = useState<VideoItem[]>([])
	const [profileShorts, setProfileShorts] = useState<VideoItem[]>([])
	const [loadingVideos, setLoadingVideos] = useState(false)
	const [loadingShorts, setLoadingShorts] = useState(false)
	const [giftSenders, setGiftSenders] = useState<Record<string, any>>({})
	const [giftCatalogMap, setGiftCatalogMap] = useState<Record<string, any>>({})
	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
	const STATIC_GIFT_IMAGES: Record<string, string> = {
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
	const GIFT_NAME_MAP: Record<string, string> = {
		newyear_fireworks: 'Новогодний салют',
		valentine_heart: 'Валентинка',
		womens_day_bouquet: 'Букет к 8 Марта',
		birthday_cake: 'Торт на День Рождения',
		halloween_pumpkin: 'Тыква на Хэллоуин',
		easter_egg: 'Пасхальное яйцо',
		christmas_gift: 'Подарок на Рождество',
		knowledge_day_coffee: 'Кофе ко Дню знаний',
		anniversary_crown: 'Корона на юбилей',
		party_flame: 'Огонь на вечеринку',
		partner_badge: 'Наш партнёр',
		gold_star: 'Золотая звезда',
	}

	// Edit Profile Modal State
	const [isEditModalOpen, setIsEditModalOpen] = useState(false)
	const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
	const [usernameEdit, setUsernameEdit] = useState(user.username || '')
	const [isUpdating, setIsUpdating] = useState(false)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)
	const [profileBgImageUrl, setProfileBgImageUrl] = useState<string>(
		(user as any).profile_bg_image || '',
	)
	const [uploadingBgImage, setUploadingBgImage] = useState(false)
	const [linkKey, setLinkKey] = useState<string | null>(null)
	// Gift modal
	const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
	const [giftError, setGiftError] = useState<string | null>(null)
	const [giftLoading, setGiftLoading] = useState(false)
	const giftsCatalog = [
		{ id: 'newyear_fireworks', name: 'Новогодний салют', icon: Flame },
		{ id: 'valentine_heart', name: 'Валентинка', icon: Heart },
		{ id: 'womens_day_bouquet', name: 'Букет к 8 Марта', icon: Flower },
		{ id: 'birthday_cake', name: 'Торт на День Рождения', icon: Gift },
		{ id: 'halloween_pumpkin', name: 'Тыква на Хэллоуин', icon: Flame },
		{ id: 'easter_egg', name: 'Пасхальное яйцо', icon: Gift },
		{ id: 'christmas_gift', name: 'Подарок на Рождество', icon: Gift },
		{ id: 'knowledge_day_coffee', name: 'Кофе ко Дню знаний', icon: Coffee },
		{ id: 'anniversary_crown', name: 'Корона на юбилей', icon: Crown },
		{ id: 'party_flame', name: 'Огонь на вечеринку', icon: Flame },
		{ id: 'partner_badge', name: 'Наш партнёр', icon: Crown },
		{ id: 'gold_star', name: 'Золотая звезда', icon: Star },
	]
	const sendGift = async (giftId: string) => {
		if (!authUser) {
			setGiftError('Требуется авторизация')
			return
		}
		setGiftLoading(true)
		setGiftError(null)
		try {
			const backendUrl =
				process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
			const meRes = await fetch('/api/auth/me', { method: 'GET' })
			if (!meRes.ok) {
				throw new Error('Требуется авторизация')
			}
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (!token) {
				throw new Error('Требуется авторизация')
			}
			const res = await fetch(`${backendUrl}/api/v1/users/send-gift`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					access_token: token,
					target_user_id: user.id,
					gift_id: giftId,
					quantity: 1,
				}),
			})
			if (!res.ok) {
				const text = await res.text()
				throw new Error(text || 'Ошибка отправки подарка')
			}
			setIsGiftModalOpen(false)
		} catch (e: any) {
			setGiftError(e.message || 'Не удалось отправить подарок')
		} finally {
			setGiftLoading(false)
		}
	}
	// Background customization state
	const FREE_THEMES = [
		{
			id: 'indigo',
			class: 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600',
		},
		{
			id: 'purple',
			class: 'bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600',
		},
		{
			id: 'emerald',
			class: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600',
		},
		{
			id: 'rose',
			class: 'bg-gradient-to-r from-rose-600 via-orange-600 to-amber-600',
		},
		{
			id: 'cyan',
			class: 'bg-gradient-to-r from-cyan-600 via-sky-600 to-indigo-600',
		},
	]
	const [profileTheme, setProfileTheme] = useState<string>(
		user.profile_bg_theme || FREE_THEMES[0].id,
	)
	const [gradColor1, setGradColor1] = useState<string>('#4f46e5') // indigo-600
	const [gradColor2, setGradColor2] = useState<string>('#ec4899') // pink-500
	const [gradAngle, setGradAngle] = useState<number>(135)
	const dispatch = useAppDispatch()

	const isMe = currentUser?.id === user.id
	const isAdmin = currentUser?.role === 'Admin'
	const activeThemeId =
		(isMe ? profileTheme : user.profile_bg_theme) || FREE_THEMES[0].id
	const activeTheme =
		FREE_THEMES.find(t => t.id === activeThemeId) || FREE_THEMES[0]
	const activeGradient = user.premium
		? `linear-gradient(${gradAngle}deg, ${gradColor1}, ${gradColor2})`
		: undefined
	const registeredDate = (() => {
		const dt = (user as any).registeredAt || (user as any).created_at
		if (!dt) return '—'
		const value = new Date(dt)
		if (Number.isNaN(value.getTime())) return '—'
		return value.toLocaleDateString('ru-RU', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
		})
	})()

	useEffect(() => {
		if (user.profile_bg_theme) {
			setProfileTheme(user.profile_bg_theme)
		} else {
			setProfileTheme(FREE_THEMES[0].id)
		}
		if (user.profile_bg_gradient) {
			const match = user.profile_bg_gradient.match(
				/linear-gradient\(\s*([0-9.]+)deg\s*,\s*([^,]+)\s*,\s*([^)]+)\)/i,
			)
			if (match) {
				const angle = Number(match[1])
				if (!Number.isNaN(angle)) {
					setGradAngle(angle)
				}
				setGradColor1(match[2].trim())
				setGradColor2(match[3].trim())
			}
		}
	}, [user.profile_bg_theme, user.profile_bg_gradient])
	useEffect(() => {
		setIsBlocked(Boolean((user as any).is_blocked))
		setBlockedByAdmin((user as any).blocked_by_admin || null)
	}, [user])

	const generateLinkKey = async () => {
		try {
			const res = await fetch('/api/users/link-key', {
				method: 'POST',
			})
			if (res.ok) {
				const data = await res.json()
				setLinkKey(data.link_key)
			} else {
				alert('Failed to generate key')
			}
		} catch (e) {
			console.error(e)
			alert('Error generating key')
		}
	}

	useEffect(() => {
		if (!currentUser || isMe) {
			setCheckingStatus(false)
			return
		}

		const checkStatus = async () => {
			try {
				// 1. Check Friends
				const friendsRes = await fetch('/api/friends/list', {
					method: 'POST',
				})
				if (friendsRes.ok) {
					const friends = await friendsRes.json()
					if (Array.isArray(friends)) {
						const isMyFriend = friends.some(
							(f: any) => f.id === user.id || f.friend_id === user.id,
						)
						setIsFriend(isMyFriend)
					}
				}

				// 2. Check Subscriptions (Following)
				const followingRes = await fetch('/api/subscriptions/following', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: currentUser.id }),
				})
				if (followingRes.ok) {
					const following = await followingRes.json()
					if (Array.isArray(following)) {
						const isFollowing = following.some(
							(f: any) => f.id === user.id || f.user_id === user.id,
						)
						setIsSubscribed(isFollowing)
					}
				}
			} catch (error) {
				console.error('Error checking status:', error)
			} finally {
				setCheckingStatus(false)
			}
		}

		checkStatus()
	}, [currentUser, user.id, isMe])

	useEffect(() => {
		if (activeTab === 'friends' && friends.length === 0) {
			const fetchFriends = async () => {
				setLoadingFriends(true)
				try {
					const res = await fetch('/api/friends/list', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ user_id: user.id }),
					})
					if (res.ok) {
						const data = await res.json()
						setFriends(Array.isArray(data) ? data : [])
					}
				} catch (e) {
					console.error(e)
				} finally {
					setLoadingFriends(false)
				}
			}
			fetchFriends()
		}
	}, [activeTab, user.id, friends.length])

	const fetchProfilePosts = async (page: number, replace = false) => {
		if (isBlocked && !isAdmin) {
			if (replace) {
				setProfilePosts([])
			}
			setHasMorePosts(false)
			setLoadingPosts(false)
			return
		}
		setLoadingPosts(true)
		try {
			const res = await fetch(
				`/api/posts?user_id=${user.id}&page=${page}&per_page=5`,
				{ method: 'GET' },
			)
			if (res.ok) {
				const data = await res.json()
				const items = Array.isArray(data)
					? data
					: data.items || data.posts || []
				setProfilePosts(prev => (replace ? items : [...prev, ...items]))
				const currentPage = data.page || page
				const totalPages = data.pages || currentPage
				setPostsPage(currentPage)
				setHasMorePosts(currentPage < totalPages)
			} else if (replace) {
				setProfilePosts([])
				setHasMorePosts(false)
			}
		} catch (e) {
			console.error('Failed to load posts', e)
			if (replace) {
				setProfilePosts([])
				setHasMorePosts(false)
			}
		} finally {
			setLoadingPosts(false)
		}
	}

	const fetchProfileVideos = async (shorts: boolean) => {
		if (isBlocked && !isAdmin) {
			if (shorts) {
				setProfileShorts([])
			} else {
				setProfileVideos([])
			}
			return
		}
		if (shorts) {
			setLoadingShorts(true)
		} else {
			setLoadingVideos(true)
		}
		try {
			const params = new URLSearchParams({
				user_id: String(user.id),
				sort: 'created_at',
				order: 'desc',
				limit: '24',
				offset: '0',
			})
			if (shorts) params.set('shorts', 'true')
			const res = await fetch(`/api/videos?${params.toString()}`, {
				cache: 'no-store',
			})
			const data = res.ok ? await res.json() : []
			const items = Array.isArray(data) ? data : []
			if (shorts) {
				setProfileShorts(items)
			} else {
				setProfileVideos(items)
			}
		} catch {
			if (shorts) {
				setProfileShorts([])
			} else {
				setProfileVideos([])
			}
		} finally {
			if (shorts) {
				setLoadingShorts(false)
			} else {
				setLoadingVideos(false)
			}
		}
	}

	useEffect(() => {
		if (activeTab !== 'posts') return
		setProfilePosts([])
		setPostsPage(1)
		setHasMorePosts(true)
		if (isBlocked && !isAdmin) {
			setHasMorePosts(false)
			return
		}
		fetchProfilePosts(1, true)
	}, [activeTab, user.id, isBlocked, isAdmin])

	useEffect(() => {
		if (activeTab === 'videos') {
			fetchProfileVideos(false)
		}
		if (activeTab === 'shorts') {
			fetchProfileVideos(true)
		}
		if (activeTab === 'video_info') {
			fetchProfileVideos(false)
			fetchProfileVideos(true)
		}
	}, [activeTab, user.id, isBlocked, isAdmin])

	useEffect(() => {
		if (activeTab !== 'gifts') return
		const loadSendersAndCatalog = async () => {
			try {
				const ids = Array.isArray(user.gifts)
					? Array.from(
							new Set(
								user.gifts
									.map((g: any) => String(g.from_user_id || ''))
									.filter(id => id && id !== String(user.id)),
							),
						)
					: []
				const nextMap: Record<string, any> = {}
				for (const id of ids) {
					const res = await fetch(`/api/users/${id}`, { method: 'GET' })
					if (res.ok) {
						const data = await res.json()
						const u = data.user || data
						nextMap[id] = u
					}
				}
				setGiftSenders(nextMap)

				const res = await fetch(`${backendUrl}/api/v1/gifts/`, {
					method: 'GET',
				})
				if (res.ok) {
					const data = await res.json()
					if (Array.isArray(data)) {
						const map: Record<string, any> = {}
						for (const g of data) {
							if (g && g.id) {
								map[g.id] = g
							}
						}
						setGiftCatalogMap(map)
					}
				}
			} catch {}
		}
		loadSendersAndCatalog()
	}, [activeTab, user.gifts, user.id, backendUrl])

	const handleAddFriend = async () => {
		if (!currentUser) return
		setLoading(true)
		try {
			const res = await fetch('/api/friends/add', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ friend_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to add friend')
			alert('Заявка отправлена!')
		} catch (error) {
			console.error(error)
			alert('Ошибка при отправке заявки')
		} finally {
			setLoading(false)
		}
	}

	const handleRemoveFriend = async () => {
		if (!currentUser) return
		if (!confirm('Удалить из друзей?')) return
		setLoading(true)
		try {
			const res = await fetch('/api/friends/remove', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ friend_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to remove friend')
			setIsFriend(false)
		} catch (error) {
			console.error(error)
			alert('Ошибка при удалении из друзей')
		} finally {
			setLoading(false)
		}
	}

	const handleSubscribe = async () => {
		if (!currentUser) return
		setLoading(true)
		try {
			const res = await fetch('/api/subscriptions/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ target_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to subscribe')
			setIsSubscribed(true)
		} catch (error) {
			console.error(error)
			alert('Ошибка при подписке')
		} finally {
			setLoading(false)
		}
	}

	const handleUnsubscribe = async () => {
		if (!currentUser) return
		setLoading(true)
		try {
			const res = await fetch('/api/subscriptions/unsubscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ target_id: user.id }),
			})
			if (!res.ok) throw new Error('Failed to unsubscribe')
			setIsSubscribed(false)
		} catch (error) {
			console.error(error)
			alert('Ошибка при отписке')
		} finally {
			setLoading(false)
		}
	}

	const handleBlock = async () => {
		if (!currentUser || !isAdmin) return
		if (!confirm('Вы уверены, что хотите заблокировать пользователя?')) return
		setLoading(true)
		try {
			const res = await fetch('/api/users/block', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: user.id,
					admin_user_id: currentUser.id,
				}),
			})
			if (!res.ok) throw new Error('Failed to block')
			alert('Пользователь заблокирован')
			setIsBlocked(true)
			if (currentUser?.username) {
				setBlockedByAdmin(currentUser.username)
			}
		} catch (error) {
			console.error(error)
			alert('Ошибка блокировки')
		} finally {
			setLoading(false)
		}
	}

	const handleUnblock = async () => {
		if (!currentUser || !isAdmin) return
		if (!confirm('Разблокировать пользователя?')) return
		setLoading(true)
		try {
			const res = await fetch('/api/users/unblock', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: user.id,
					admin_user_id: currentUser.id,
				}),
			})
			if (!res.ok) throw new Error('Failed to unblock')
			alert('Пользователь разблокирован')
			setIsBlocked(false)
			setBlockedByAdmin(null)
		} catch (error) {
			console.error(error)
			alert('Ошибка разблокировки')
		} finally {
			setLoading(false)
		}
	}

	const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file) return

		// Check file type (allow images and gifs)
		if (!file.type.startsWith('image/')) {
			alert('Пожалуйста, загрузите изображение (JPG, PNG, GIF)')
			return
		}
		if (file.type.toLowerCase().includes('gif') && !currentUser?.premium) {
			alert('GIF-аватарка доступна только для Premium аккаунтов')
			return
		}

		setUploadingAvatar(true)
		try {
			// Convert to base64
			const reader = new FileReader()
			reader.readAsDataURL(file)
			reader.onload = async () => {
				const base64File = reader.result as string

				const res = await fetch('/api/upload/file', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						// Authorization header will be handled by nextjs middleware or proxy if configured,
						// but usually client components use a proxy route.
						// However, since we don't have a direct /api/upload/file proxy,
						// we might need to assume there is one or call backend directly.
						// Let's assume there is a Next.js route handler at /api/upload/file or similar,
						// OR we use the same pattern as other calls.
						// Given the project structure, let's try calling backend directly via a new Next.js route handler
						// or assume one exists.
						// WAIT: I should check if I need to create a route handler for upload.
						// The previous search showed /api/posts route handler.
						// Let's assume we need to implement a route handler for upload first.
					},
					body: JSON.stringify({
						file: base64File,
						filename: file.name,
					}),
				})

				// Wait, I should probably create the route handler first.
				// But let's write the frontend logic assuming it exists at /api/upload/file
				// Actually, looking at other components, they use relative paths like /api/friends/list.
				// I'll assume I need to create /src/app/api/upload/file/route.ts

				if (!res.ok) {
					const err = await res.json()
					throw new Error(err.error || err.message || 'Upload failed')
				}

				const data = await res.json()
				setAvatarUrl(data.url)
			}
		} catch (error: any) {
			console.error(error)
			alert(error.message || 'Ошибка загрузки аватара')
		} finally {
			setUploadingAvatar(false)
		}
	}

	const handleProfileBgUpload = async (
		e: React.ChangeEvent<HTMLInputElement>,
	) => {
		const file = e.target.files?.[0]
		if (!file) return
		if (!currentUser?.premium) {
			alert('Фоновое изображение доступно только для Premium аккаунтов')
			return
		}
		if (!file.type.startsWith('image/')) {
			alert('Пожалуйста, загрузите изображение (JPG, PNG)')
			return
		}
		setUploadingBgImage(true)
		try {
			const reader = new FileReader()
			reader.readAsDataURL(file)
			reader.onload = async () => {
				const base64File = reader.result as string
				const res = await fetch('/api/upload/file', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						file: base64File,
						filename: file.name,
					}),
				})
				if (!res.ok) {
					const errText = await res.text()
					throw new Error(errText || 'Upload failed')
				}
				const data = await res.json()
				setProfileBgImageUrl(data.url)
			}
		} catch (error: any) {
			console.error(error)
			alert(error.message || 'Ошибка загрузки фонового изображения')
		} finally {
			setUploadingBgImage(false)
		}
	}

	const handleUpdateProfile = async () => {
		if (!currentUser) return
		setIsUpdating(true)
		try {
			const uname = (usernameEdit || '').trim()
			if (!uname || uname.length < 3 || uname.length > 32) {
				alert('Имя пользователя от 3 до 32 символов')
				return
			}
			const payload: any = {
				user_id: user.id,
				email: user.email,
				username: uname,
				avatar_url: avatarUrl,
			}
			if (currentUser?.premium) {
				if ((profileBgImageUrl || '').trim()) {
					payload.profile_bg_image = (profileBgImageUrl || '').trim()
				} else {
					payload.profile_bg_gradient = `linear-gradient(${gradAngle}deg, ${gradColor1}, ${gradColor2})`
				}
			} else {
				payload.profile_bg_theme = profileTheme
			}

			const res = await fetch('/api/users/update', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload),
			})

			if (!res.ok) throw new Error('Failed to update profile')
			const data = await res.json()
			const updatedUser = data.user || data
			if (updatedUser && currentUser) {
				const mergedUser = { ...currentUser, ...updatedUser }
				dispatch(setUser(mergedUser))
				localStorage.setItem('user', JSON.stringify(mergedUser))
				setAvatarUrl(mergedUser.avatar_url || '')
				setUsernameEdit(mergedUser.username || '')
				if (mergedUser.profile_bg_theme) {
					setProfileTheme(mergedUser.profile_bg_theme)
				}
				if ((mergedUser as any).profile_bg_image !== undefined) {
					setProfileBgImageUrl((mergedUser as any).profile_bg_image || '')
				}
			}
			alert('Профиль обновлен!')
			setIsEditModalOpen(false)
		} catch (error) {
			console.error(error)
			alert('Ошибка обновления профиля')
		} finally {
			setIsUpdating(false)
		}
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className='mx-auto max-w-3xl space-y-6'
		>
			{/* Cover Image */}
			<div
				className={`relative h-48 rounded-2xl overflow-hidden shadow-lg ${
					user.premium ? 'ring-2 ring-amber-400/30' : activeTheme.class
				}`}
				style={
					user.premium && !user.profile_bg_image && activeGradient
						? { backgroundImage: activeGradient }
						: undefined
				}
			>
				{user.profile_bg_image && (
					<img
						src={getAttachmentUrl(user.profile_bg_image)}
						alt='Background'
						className='absolute inset-0 w-full h-full object-cover'
					/>
				)}
				<div className='absolute inset-0 bg-black/20' />
				{user.premium && (
					<div className='absolute inset-0 pointer-events-none'>
						<div className='absolute -top-10 -left-10 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl animate-pulse' />
						<div className='absolute -bottom-10 -right-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse' />
					</div>
				)}
			</div>

			{/* User Info Section */}
			<div className='flex flex-col sm:flex-row items-end gap-6 px-4'>
				<motion.div
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ delay: 0.2 }}
					className={`-mt-20 flex h-32 w-32 items-center justify-center rounded-full bg-gray-900 ring-4 ${
						user.premium
							? 'ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
							: 'ring-black'
					} overflow-hidden shadow-xl z-10`}
				>
					{user.avatar_url && (!isBlocked || isAdmin) ? (
						<img
							src={getAttachmentUrl(user.avatar_url)}
							alt={user.username}
							className='h-full w-full object-cover'
						/>
					) : (
						<span className='text-5xl'>
							{user.username?.[0]?.toUpperCase() || '👤'}
						</span>
					)}
				</motion.div>

				<div className='flex-1 pb-2 w-full'>
					<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
						<div>
							<h1 className='text-3xl font-bold text-white'>
								{user.username}
								{user.premium && <span className='ml-2 text-amber-400'>★</span>}
							</h1>
							{!user.email?.endsWith('@telegram.bot') && (
								<p className='text-sm text-gray-400'>{user.email}</p>
							)}
							<p
								className={`text-sm capitalize mt-1 ${
									user.role === 'Admin'
										? 'text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 font-bold'
										: 'text-gray-400'
								}`}
							>
								{user.role === 'Admin' ? 'Администратор' : 'Пользователь'}
							</p>
							{isBlocked && !isAdmin && (
								<p className='mt-2 text-sm font-semibold text-red-500'>
									Пользователь заблокирован администратором{' '}
									{blockedByAdmin ||
										(user as any).blocked_by_admin ||
										'администратором'}
								</p>
							)}
						</div>

						{/* Actions */}
						{isMe && (
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setIsEditModalOpen(true)}
								className='rounded-xl bg-white/10 border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
							>
								Редактировать
							</motion.button>
						)}

						{/* Edit Modal */}
						<AnimatePresence>
							{isEditModalOpen && (
								<motion.div
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
								>
									<motion.div
										initial={{ scale: 0.9, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										exit={{ scale: 0.9, opacity: 0 }}
										className='w-full max-w-md space-y-6 rounded-2xl bg-gray-900/90 border border-white/10 p-8 shadow-2xl backdrop-blur-xl'
									>
										<h2 className='text-2xl font-bold text-white'>
											Редактировать профиль
										</h2>

										<div>
											<label className='mb-2 block text-sm font-medium text-gray-400'>
												Имя пользователя
											</label>
											<input
												type='text'
												value={usernameEdit}
												onChange={e => setUsernameEdit(e.target.value)}
												className='w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all'
												placeholder='Введите имя...'
												maxLength={32}
											/>
										</div>

										<div>
											<label className='mb-2 block text-sm font-medium text-gray-400'>
												Аватар (Изображение или GIF)
											</label>
											<div className='flex gap-2 mb-2'>
												<input
													type='file'
													accept='image/*,image/gif'
													onChange={handleAvatarUpload}
													className='hidden'
													id='avatar-upload'
												/>
												<label
													htmlFor='avatar-upload'
													className={`flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-600 bg-black/30 p-4 text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-all ${
														uploadingAvatar
															? 'opacity-50 pointer-events-none'
															: ''
													}`}
												>
													{uploadingAvatar ? (
														<span>Загрузка...</span>
													) : (
														<>
															<svg
																xmlns='http://www.w3.org/2000/svg'
																fill='none'
																viewBox='0 0 24 24'
																strokeWidth={1.5}
																stroke='currentColor'
																className='w-5 h-5'
															>
																<path
																	strokeLinecap='round'
																	strokeLinejoin='round'
																	d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5'
																/>
															</svg>
															<span>Загрузить фото/GIF</span>
														</>
													)}
												</label>
											</div>
											<input
												type='text'
												value={avatarUrl}
												onChange={e => setAvatarUrl(e.target.value)}
												className='w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all'
												placeholder='Или вставьте ссылку...'
											/>
										</div>
										<div className='pt-4'>
											<label className='mb-2 block text-sm font-medium text-gray-400'>
												Задний фон профиля
											</label>
											{currentUser?.premium ? (
												<div className='space-y-3'>
													<p className='text-xs text-gray-500'>
														Выберите градиент или задайте картинку на фоне
													</p>
													<div className='grid grid-cols-2 gap-3'>
														<div className='flex items-center gap-2'>
															<span className='text-xs text-gray-400'>
																Цвет 1
															</span>
															<input
																type='color'
																value={gradColor1}
																onChange={e => setGradColor1(e.target.value)}
																className='h-8 w-12 rounded border border-white/10 bg-transparent'
															/>
														</div>
														<div className='flex items-center gap-2'>
															<span className='text-xs text-gray-400'>
																Цвет 2
															</span>
															<input
																type='color'
																value={gradColor2}
																onChange={e => setGradColor2(e.target.value)}
																className='h-8 w-12 rounded border border-white/10 bg-transparent'
															/>
														</div>
													</div>
													<div className='flex items-center gap-3'>
														<span className='text-xs text-gray-400'>Угол</span>
														<input
															type='range'
															min={0}
															max={360}
															value={gradAngle}
															onChange={e =>
																setGradAngle(Number(e.target.value))
															}
															className='flex-1'
														/>
														<span className='text-xs text-gray-300 w-10 text-right'>
															{gradAngle}°
														</span>
													</div>
													<div
														className='h-16 rounded-xl border border-white/10'
														style={{
															backgroundImage: `linear-gradient(${gradAngle}deg, ${gradColor1}, ${gradColor2})`,
														}}
													/>
													<div className='pt-3 space-y-2'>
														<label className='mb-1 block text-sm font-medium text-gray-400'>
															Изображение фона (Премиум)
														</label>
														<div className='flex gap-2'>
															<input
																type='file'
																accept='image/*'
																onChange={handleProfileBgUpload}
																className='hidden'
																id='bg-upload'
															/>
															<label
																htmlFor='bg-upload'
																className={`flex-1 cursor-pointer flex items-center justify-center gap-2 rounded-xl border border-dashed border-gray-600 bg-black/30 p-3 text-gray-400 hover:border-indigo-500 hover:text-indigo-400 transition-all ${
																	uploadingBgImage
																		? 'opacity-50 pointer-events-none'
																		: ''
																}`}
															>
																{uploadingBgImage ? (
																	<span>Загрузка...</span>
																) : (
																	<>
																		<svg
																			xmlns='http://www.w3.org/2000/svg'
																			fill='none'
																			viewBox='0 0 24 24'
																			strokeWidth={1.5}
																			stroke='currentColor'
																			className='w-5 h-5'
																		>
																			<path
																				strokeLinecap='round'
																				strokeLinejoin='round'
																				d='M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5'
																			/>
																		</svg>
																		<span>Загрузить фон</span>
																	</>
																)}
															</label>
														</div>
														<input
															type='text'
															value={profileBgImageUrl}
															onChange={e =>
																setProfileBgImageUrl(e.target.value)
															}
															className='w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all'
															placeholder='Или вставьте ссылку на изображение...'
														/>
													</div>
												</div>
											) : (
												<div className='grid grid-cols-5 gap-2'>
													{FREE_THEMES.map(t => (
														<button
															key={t.id}
															onClick={() => setProfileTheme(t.id)}
															className={`h-8 rounded-lg border ${
																profileTheme === t.id
																	? 'border-amber-400'
																	: 'border-white/10'
															} ${t.class}`}
															title={t.id}
														/>
													))}
												</div>
											)}
										</div>
										<div className='flex justify-end gap-3 pt-4'>
											<button
												onClick={() => setIsEditModalOpen(false)}
												className='rounded-xl px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-all'
											>
												Отмена
											</button>
											<button
												onClick={handleUpdateProfile}
												disabled={isUpdating}
												className='rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50'
											>
												{isUpdating ? 'Сохранение...' : 'Сохранить'}
											</button>
										</div>
									</motion.div>
								</motion.div>
							)}
						</AnimatePresence>

						{!isMe && currentUser && !checkingStatus && (
							<div className='flex flex-wrap gap-3'>
								{/* Friend Button */}
								{isFriend ? (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleRemoveFriend}
										disabled={loading}
										className='rounded-xl bg-red-500/10 border border-red-500/50 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 transition-all disabled:opacity-50'
									>
										Удалить из друзей
									</motion.button>
								) : (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleAddFriend}
										disabled={loading}
										className='rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-sm font-semibold text-white hover:shadow-lg hover:shadow-indigo-500/25 transition-all disabled:opacity-50'
									>
										Добавить в друзья
									</motion.button>
								)}

								{/* Subscribe Button */}
								{isSubscribed ? (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleUnsubscribe}
										disabled={loading}
										className='rounded-xl bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition-all disabled:opacity-50'
									>
										Отписаться
									</motion.button>
								) : (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleSubscribe}
										disabled={loading}
										className='rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-all disabled:opacity-50'
									>
										Подписаться
									</motion.button>
								)}
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => setIsGiftModalOpen(true)}
									disabled={loading}
									className='rounded-xl bg-pink-600 px-4 py-2 text-sm font-semibold text-white hover:bg-pink-500 transition-all disabled:opacity-50'
								>
									Подарить
								</motion.button>

								{isAdmin && (
									<>
										{isBlocked ? (
											<motion.button
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												onClick={handleUnblock}
												disabled={loading}
												className='rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-all disabled:opacity-50'
											>
												Разблокировать
											</motion.button>
										) : (
											<motion.button
												whileHover={{ scale: 1.05 }}
												whileTap={{ scale: 0.95 }}
												onClick={handleBlock}
												disabled={loading}
												className='rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-500 transition-all disabled:opacity-50'
											>
												Заблокировать
											</motion.button>
										)}
									</>
								)}
							</div>
						)}
					</div>

					{user.description && (
						<p className='mt-4 text-sm text-gray-300 max-w-2xl'>
							{user.description}
						</p>
					)}
				</div>
			</div>

			<AnimatePresence>
				{isGiftModalOpen && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
					>
						<motion.div
							initial={{ scale: 0.95, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.95, opacity: 0 }}
							className='w-full max-w-lg rounded-2xl bg-gray-900/90 border border-white/10 p-6 shadow-2xl'
						>
							<div className='flex items-center justify-between mb-4'>
								<h3 className='text-lg font-bold text-white'>
									Отправить подарок
								</h3>
								<button
									onClick={() => setIsGiftModalOpen(false)}
									className='text-gray-400 hover:text-white'
								>
									✕
								</button>
							</div>
							{giftError && (
								<div className='mb-3 rounded-lg border border-red-500 bg-red-900/30 px-3 py-2 text-sm text-red-300'>
									{giftError}
								</div>
							)}
							<div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
								{giftsCatalog.map(g => {
									const Icon = g.icon
									return (
										<button
											key={g.id}
											disabled={giftLoading}
											onClick={() => sendGift(g.id)}
											className='flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left hover:bg-white/10 transition'
										>
											<Icon className='h-5 w-5 text-pink-400' />
											<span className='text-sm text-white'>{g.name}</span>
										</button>
									)
								})}
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Content Tabs */}
			<div className='rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-1'>
				<div className='flex flex-wrap'>
					<button
						onClick={() => setActiveTab('posts')}
						className={`flex-1 min-w-[120px] rounded-2xl py-3 text-sm font-medium transition-all ${
							activeTab === 'posts'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Посты
					</button>
					<button
						onClick={() => setActiveTab('friends')}
						className={`flex-1 min-w-[120px] rounded-2xl py-3 text-sm font-medium transition-all ${
							activeTab === 'friends'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Друзья
					</button>
					<button
						onClick={() => setActiveTab('videos')}
						className={`flex-1 min-w-[120px] rounded-2xl py-3 text-sm font-medium transition-all ${
							activeTab === 'videos'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Видео
					</button>
					<button
						onClick={() => setActiveTab('shorts')}
						className={`flex-1 min-w-[120px] rounded-2xl py-3 text-sm font-medium transition-all ${
							activeTab === 'shorts'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						VShorts
					</button>
					<button
						onClick={() => setActiveTab('video_info')}
						className={`flex-1 min-w-[120px] rounded-2xl py-3 text-sm font-medium transition-all ${
							activeTab === 'video_info'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Инфо
					</button>
					<button
						onClick={() => setActiveTab('gifts')}
						className={`flex-1 min-w-[120px] rounded-2xl py-3 text-sm font-medium transition-all ${
							activeTab === 'gifts'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Подарки
					</button>
				</div>

				<div className='min-h-[300px] p-6'>
					{activeTab === 'posts' ? (
						<>
							{loadingPosts ? (
								<div className='flex justify-center py-12'>
									<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
								</div>
							) : isBlocked && !isAdmin ? (
								<div className='flex flex-col items-center justify-center py-12 text-center text-gray-400'>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.4 }}
										className='mb-4 text-6xl opacity-50'
									>
										🚫
									</motion.div>
									<p className='text-lg font-medium'>Публикации скрыты</p>
									<p className='text-sm text-gray-500'>
										Контент пользователя недоступен из-за блокировки
									</p>
								</div>
							) : profilePosts.length > 0 ? (
								<div className='space-y-4'>
									{profilePosts.map(p => (
										<Post
											key={p.id}
											id={p.id}
											author={p.author_name || 'Unknown'}
											author_id={p.posted_by}
											author_avatar={p.author_avatar}
											author_premium={p.author_premium}
											time={p.created_at}
											text={p.content}
											likes={p.likes || 0}
											comments_count={p.comments_count || 0}
											isLikedByCurrentUser={p.is_liked || false}
											image={p.image}
											attachments={p.attachments}
											currentUserId={String(currentUser?.id || '')}
											userRole={currentUser?.role}
										/>
									))}
									{hasMorePosts && (
										<div className='flex justify-center pt-2'>
											<button
												onClick={() => fetchProfilePosts(postsPage + 1)}
												disabled={loadingPosts}
												className='rounded-full border border-white/10 bg-white/5 px-5 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50'
											>
												{loadingPosts ? 'Загрузка...' : 'Показать ещё'}
											</button>
										</div>
									)}
								</div>
							) : (
								<div className='flex flex-col items-center justify-center py-12 text-center text-gray-400'>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.4 }}
										className='mb-4 text-6xl opacity-50'
									>
										📭
									</motion.div>
									<p className='text-lg font-medium'>Пока нет постов</p>
									<p className='text-sm text-gray-500'>
										Здесь будут отображаться публикации пользователя
									</p>
								</div>
							)}
						</>
					) : activeTab === 'videos' ? (
						<>
							{loadingVideos ? (
								<div className='flex justify-center py-12'>
									<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
								</div>
							) : isBlocked && !isAdmin ? (
								<div className='flex flex-col items-center justify-center py-12 text-center text-gray-400'>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.4 }}
										className='mb-4 text-6xl opacity-50'
									>
										🚫
									</motion.div>
									<p className='text-lg font-medium'>Видео скрыты</p>
									<p className='text-sm text-gray-500'>
										Контент пользователя недоступен из-за блокировки
									</p>
								</div>
							) : profileVideos.length > 0 ? (
								<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
									{profileVideos.map(v => {
										const poster =
											getAttachmentUrl(v.poster || '') || v.poster || ''
										return (
											<Link
												key={v.id}
												href={`/video/watch/${v.id}`}
												className='overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition'
											>
												<div className='relative aspect-video w-full overflow-hidden'>
													{poster ? (
														<img
															src={poster}
															alt={v.title}
															className='h-full w-full object-cover'
														/>
													) : (
														<div className='h-full w-full bg-gray-800' />
													)}
												</div>
												<div className='p-3'>
													<div className='text-sm font-semibold text-white line-clamp-2'>
														{v.title}
													</div>
													<div className='text-[11px] text-gray-400'>
														{v.views || 0} просмотров · {v.likes || 0} лайков
													</div>
												</div>
											</Link>
										)
									})}
								</div>
							) : (
								<div className='flex flex-col items-center justify-center py-12 text-center text-gray-400'>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.4 }}
										className='mb-4 text-6xl opacity-50'
									>
										🎬
									</motion.div>
									<p className='text-lg font-medium'>Пока нет видео</p>
								</div>
							)}
						</>
					) : activeTab === 'shorts' ? (
						<>
							{loadingShorts ? (
								<div className='flex justify-center py-12'>
									<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
								</div>
							) : isBlocked && !isAdmin ? (
								<div className='flex flex-col items-center justify-center py-12 text-center text-gray-400'>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.4 }}
										className='mb-4 text-6xl opacity-50'
									>
										🚫
									</motion.div>
									<p className='text-lg font-medium'>Shorts скрыты</p>
									<p className='text-sm text-gray-500'>
										Контент пользователя недоступен из-за блокировки
									</p>
								</div>
							) : profileShorts.length > 0 ? (
								<div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
									{profileShorts.map(v => {
										const poster =
											getAttachmentUrl(v.poster || '') || v.poster || ''
										return (
											<Link
												key={v.id}
												href={`/video/watch/${v.id}`}
												className='overflow-hidden rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition'
											>
												<div className='relative aspect-[9/16] w-full overflow-hidden'>
													{poster ? (
														<img
															src={poster}
															alt={v.title}
															className='h-full w-full object-cover'
														/>
													) : (
														<div className='h-full w-full bg-gray-800' />
													)}
												</div>
												<div className='p-3'>
													<div className='text-xs font-semibold text-white line-clamp-2'>
														{v.title}
													</div>
													<div className='text-[10px] text-gray-400'>
														{v.views || 0} просмотров
													</div>
												</div>
											</Link>
										)
									})}
								</div>
							) : (
								<div className='flex flex-col items-center justify-center py-12 text-center text-gray-400'>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.4 }}
										className='mb-4 text-6xl opacity-50'
									>
										📱
									</motion.div>
									<p className='text-lg font-medium'>Пока нет VShorts</p>
								</div>
							)}
						</>
					) : activeTab === 'video_info' ? (
						<div className='space-y-4 text-sm text-gray-300'>
							<div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
								<div className='text-xs text-gray-400'>Описание</div>
								<div className='mt-2 text-white'>
									{user.description || 'Описание не указано'}
								</div>
							</div>
							<div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
								<div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
									<div className='text-xs text-gray-400'>Видео</div>
									<div className='mt-1 text-lg font-semibold text-white'>
										{profileVideos.length}
									</div>
								</div>
								<div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
									<div className='text-xs text-gray-400'>VShorts</div>
									<div className='mt-1 text-lg font-semibold text-white'>
										{profileShorts.length}
									</div>
								</div>
								<div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
									<div className='text-xs text-gray-400'>Регистрация</div>
									<div className='mt-1 text-sm font-semibold text-white'>
										{registeredDate}
									</div>
								</div>
							</div>
						</div>
					) : activeTab === 'friends' ? (
						<div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
							{loadingFriends ? (
								<div className='col-span-full flex justify-center py-12'>
									<div className='h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent' />
								</div>
							) : friends.length > 0 ? (
								friends.map(friend => (
									<Link
										key={friend.id}
										href={`/feed/profile/${friend.id}`}
										className='flex items-center gap-3 rounded-xl bg-white/5 p-3 hover:bg-white/10 transition-colors'
									>
										<img
											src={
												getAttachmentUrl(friend.avatar_url) ||
												'/placeholder-user.jpg'
											}
											alt={friend.username}
											className='h-12 w-12 rounded-full object-cover'
										/>
										<div>
											<p className='font-medium text-white'>
												{friend.username}
											</p>
											{!friend.email.endsWith('@telegram.bot') && (
												<p className='text-xs text-gray-400'>{friend.email}</p>
											)}
										</div>
									</Link>
								))
							) : (
								<div className='col-span-full py-12 text-center text-gray-400'>
									<p>Нет друзей</p>
								</div>
							)}
						</div>
					) : (
						<>
							<h3 className='text-lg font-bold text-white mb-2'>Подарки</h3>
							<p className='text-sm text-gray-400 mb-3'>
								Кто купил: вы или другой пользователь
							</p>
							{Array.isArray(user.gifts) && user.gifts.length > 0 ? (
								<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
									{user.gifts.map((g, idx) => {
										const catalogGift = giftCatalogMap[g.gift_id || ''] || null
										const backendImage =
											catalogGift &&
											typeof catalogGift.imageUrl === 'string' &&
											catalogGift.imageUrl
												? catalogGift.imageUrl.startsWith('http')
													? catalogGift.imageUrl
													: `${backendUrl}${catalogGift.imageUrl}`
												: null
										const staticImage =
											g.gift_id && typeof g.gift_id === 'string'
												? STATIC_GIFT_IMAGES[g.gift_id] || null
												: null
										const imageSrc = backendImage || staticImage
										const Icon =
											g.gift_id === 'newyear_fireworks'
												? Flame
												: g.gift_id === 'valentine_heart'
													? Heart
													: g.gift_id === 'womens_day_bouquet'
														? Flower
														: g.gift_id === 'birthday_cake'
															? Gift
															: g.gift_id === 'halloween_pumpkin'
																? Flame
																: g.gift_id === 'easter_egg'
																	? Gift
																	: g.gift_id === 'christmas_gift'
																		? Gift
																		: g.gift_id === 'knowledge_day_coffee'
																			? Coffee
																			: g.gift_id === 'anniversary_crown'
																				? Crown
																				: g.gift_id === 'party_flame'
																					? Flame
																					: g.gift_id === 'gold_star'
																						? Star
																						: g.gift_id === 'partner_badge'
																							? Crown
																							: Gift
										const giftName = GIFT_NAME_MAP[g.gift_id] || g.gift_id
										const senderId = String(g.from_user_id || '')
										const isSelf = senderId && senderId === String(user.id)
										const sender = senderId ? giftSenders[senderId] : null
										const dateText = g.created_at
											? new Date(g.created_at).toLocaleDateString()
											: ''
										const supply =
											typeof catalogGift?.totalSupply === 'number'
												? catalogGift.totalSupply
												: catalogGift?.totalSupply != null
													? Number(catalogGift.totalSupply)
													: null
										const minted =
											typeof catalogGift?.mintedCount === 'number'
												? catalogGift.mintedCount
												: catalogGift?.mintedCount != null
													? Number(catalogGift.mintedCount)
													: null
										const limitLabel =
											supply && minted != null
												? `${minted}/${supply}`
												: supply
													? `до ${supply} шт.`
													: null
										const bgPresets = [
											'from-emerald-500/70 via-emerald-600/80 to-teal-500/80',
											'from-sky-500/70 via-sky-600/80 to-indigo-500/80',
											'from-fuchsia-500/70 via-pink-500/80 to-rose-500/80',
											'from-amber-500/70 via-orange-500/80 to-red-500/80',
											'from-violet-500/70 via-purple-500/80 to-indigo-500/80',
										]
										const bg = bgPresets[idx % bgPresets.length]
										return (
											<motion.div
												key={idx}
												initial={{ opacity: 0, y: 10, scale: 0.95 }}
												animate={{ opacity: 1, y: 0, scale: 1 }}
												transition={{ duration: 0.3 }}
												className='relative overflow-hidden rounded-2xl border border-white/10 bg-gray-900/80'
											>
												<div
													className={`relative h-24 sm:h-28 w-full bg-gradient-to-r ${bg}`}
												>
													<div className='absolute inset-0 flex items-center justify-center'>
														{imageSrc ? (
															<img
																src={imageSrc}
																alt={giftName}
																className='h-14 w-auto sm:h-16 object-contain drop-shadow-lg'
															/>
														) : (
															<Icon className='h-10 w-10 text-white drop-shadow' />
														)}
													</div>
													{sender && sender.avatar_url && (
														<div className='absolute left-2 top-2'>
															<img
																src={getAttachmentUrl(sender.avatar_url)}
																alt={sender.username || 'sender'}
																className='h-7 w-7 rounded-full border border-white/60 object-cover bg-black/40'
															/>
														</div>
													)}
													<div className='absolute right-2 top-2 flex flex-col items-end gap-0.5'>
														<div className='rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white'>
															x{g.quantity || 1}
														</div>
														{limitLabel && (
															<div className='rounded-full bg-black/30 px-2 py-0.5 text-[9px] font-semibold text-indigo-200'>
																{limitLabel}
															</div>
														)}
													</div>
												</div>
												<div className='px-3 pt-2 pb-1 flex items-center justify-between'>
													<div className='mr-2 truncate text-xs font-medium text-white'>
														{giftName}
													</div>
													{dateText && (
														<div className='text-[10px] text-gray-300'>
															{dateText}
														</div>
													)}
												</div>
												<div className='px-3 pb-2 text-[11px] text-gray-300'>
													{isSelf
														? 'Куплено вами'
														: sender
															? `Подарил ${sender.username || `#${String(sender.id || '').slice(0, 6)}`}`
															: 'Подарок'}
													{g.comment && (
														<>
															<span className='mx-1 text-gray-500'>•</span>
															<span className='break-words'>"{g.comment}"</span>
														</>
													)}
												</div>
											</motion.div>
										)
									})}
								</div>
							) : (
								<div className='rounded-xl border border-white/10 bg-white/5 p-4 text-center'>
									<div className='text-sm text-gray-400'>Нет подарков</div>
								</div>
							)}
						</>
					)}
				</div>
			</div>
		</motion.div>
	)
}
