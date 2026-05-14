'use client'

import { useAuth } from '@/lib/AuthContext'
import { setUser } from '@/lib/features/authSlice'
import { useAppDispatch } from '@/lib/hooks'
import { User } from '@/lib/types'
import { getAttachmentUrl, getAvatarUrl } from '@/lib/utils'
import { AnimatePresence, motion } from 'framer-motion'
import {
	LuCoffee as Coffee,
	LuCrown as Crown,
	LuFlame as Flame,
	LuFlower as Flower,
	LuGift as Gift,
	LuHeart as Heart,
	LuLink as LinkIcon,
	LuSettings as SettingsIcon,
	LuShare2 as Share2,
	LuStar as Star,
	LuUpload as UploadCloud,
} from 'react-icons/lu'
import Link from 'next/link'
import { FiPaperclip as Paperclip } from 'react-icons/fi'
import { useEffect, useRef, useState } from 'react'
import Post from './Post'
import StoriesModal from './StoriesModal'

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
		'posts' | 'friends' | 'gifts' | 'videos' | 'shorts' | 'video_info' | 'music'
	>('video_info')
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

	const [isEditModalOpen, setIsEditModalOpen] = useState(false)
	const [avatarUrl, setAvatarUrl] = useState(user.avatar_url || '')
	const [usernameEdit, setUsernameEdit] = useState(user.username || '')
	const [descriptionEdit, setDescriptionEdit] = useState(user.description || '')
	const [displayDescription, setDisplayDescription] = useState(
		user.description || '',
	)
	const [isUpdating, setIsUpdating] = useState(false)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)
	const [profileBgImageUrl, setProfileBgImageUrl] = useState<string>(
		(user as any).profile_bg_image || '',
	)
	const [uploadingBgImage, setUploadingBgImage] = useState(false)
	const [linkKey, setLinkKey] = useState<string | null>(null)
	const [isShareModalOpen, setIsShareModalOpen] = useState(false)
	const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false)
	const [isUserReportOpen, setIsUserReportOpen] = useState(false)
	const [userReportText, setUserReportText] = useState('')
	const [userReportBusy, setUserReportBusy] = useState(false)
	const [userReportUploading, setUserReportUploading] = useState(false)
	const [userReportAttachments, setUserReportAttachments] = useState<
		{ url: string; name: string; ext?: string }[]
	>([])
	const userReportFileInputRef = useRef<HTMLInputElement | null>(null)
	const [privacySettings, setPrivacySettings] = useState({
		show_email: true,
		show_online_status: true,
		show_last_seen: true,
		allow_friend_requests: true,
	})
	const [savingPrivacy, setSavingPrivacy] = useState(false)
	const [profileStories, setProfileStories] = useState<any[]>([])
	const [loadingStories, setLoadingStories] = useState(false)
	const [isStoriesOpen, setIsStoriesOpen] = useState(false)

	const [isGiftModalOpen, setIsGiftModalOpen] = useState(false)
	const [giftError, setGiftError] = useState<string | null>(null)
	const [giftLoading, setGiftLoading] = useState(false)
	const [userPlaylists, setUserPlaylists] = useState<any[]>([])
	const [loadingMusic, setLoadingMusic] = useState(false)
	const [addingPlaylistId, setAddingPlaylistId] = useState<string | null>(null)
	const [giftPremiumLoading, setGiftPremiumLoading] = useState(false)
	const [giftPremiumError, setGiftPremiumError] = useState<string | null>(null)

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
	const sendGiftPremium = async () => {
		if (!authUser) {
			setGiftPremiumError('Требуется авторизация')
			return
		}
		setGiftPremiumLoading(true)
		setGiftPremiumError(null)
		try {
			const backendUrl =
				process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
			const meRes = await fetch('/api/auth/me', { method: 'GET' })
			if (!meRes.ok) throw new Error('Требуется авторизация')
			const meData = await meRes.json()
			const token = meData?.user?.access_token || meData?.access_token
			if (!token) throw new Error('Требуется авторизация')
			const res = await fetch(`${backendUrl}/api/v1/users/gift-premium-coins`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({
					access_token: token,
					target_user_id: user.id,
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) {
				throw new Error(data.error || data.message || 'Не удалось подарить Premium')
			}
			alert('Premium подарен на 30 дней!')
		} catch (e: any) {
			setGiftPremiumError(e.message || 'Ошибка')
		} finally {
			setGiftPremiumLoading(false)
		}
	}

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
	const profileUrl =
		typeof window !== 'undefined'
			? `${window.location.origin}/feed/profile/${user.id}`
			: `/feed/profile/${user.id}`
	const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(
		profileUrl,
	)}`
	const activeThemeId =
		(isMe ? profileTheme : user.profile_bg_theme) || FREE_THEMES[0].id
	const activeTheme =
		FREE_THEMES.find(t => t.id === activeThemeId) || FREE_THEMES[0]
	const activeGradient = Boolean(user.premium)
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
	const videosCount =
		profileVideos.length || Number((user as any).videos_count || 0)
	const shortsCount =
		profileShorts.length || Number((user as any).shorts_count || 0)
	const hasProfileStories = profileStories.length > 0

	useEffect(() => {
		if (!user) return
		const next = {
			show_email: user.privacy_settings?.show_email !== false,
			show_online_status: user.privacy_settings?.show_online_status !== false,
			show_last_seen: user.privacy_settings?.show_last_seen !== false,
			allow_friend_requests: user.privacy_settings?.allow_friend_requests !== false,
		}
		setPrivacySettings(next)
	}, [user.id, user.privacy_settings])

	useEffect(() => {
		const fetchStories = async () => {
			setLoadingStories(true)
			try {
				const res = await fetch('/api/storis/user', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: user.id }),
				})
				if (!res.ok) throw new Error('Failed to load stories')
				const data = await res.json()
				setProfileStories(Array.isArray(data) ? data : [])
			} catch {
				setProfileStories([])
			} finally {
				setLoadingStories(false)
			}
		}
		fetchStories()
	}, [user.id])

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

	const copyProfileLink = async () => {
		try {
			await navigator.clipboard.writeText(profileUrl)
			alert('Ссылка скопирована')
		} catch {
			alert('Не удалось скопировать ссылку')
		}
	}

	const savePrivacySettings = async () => {
		if (!currentUser) return
		setSavingPrivacy(true)
		try {
			const res = await fetch('/api/users/update', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					user_id: currentUser.id,
					privacy_settings: privacySettings,
				}),
			})
			const data = await res.json().catch(() => ({}))
			if (!res.ok) throw new Error(data.error || 'Ошибка сохранения')
			const updatedUser = data.user || data
			if (updatedUser) {
				dispatch(setUser(updatedUser))
				localStorage.setItem('user', JSON.stringify(updatedUser))
			}
			setIsPrivacyModalOpen(false)
			alert('Настройки конфиденциальности сохранены')
		} catch (error) {
			console.error(error)
			alert('Не удалось сохранить настройки конфиденциальности')
		} finally {
			setSavingPrivacy(false)
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
		if (activeTab === 'music' && userPlaylists.length === 0) {
			const fetchPlaylists = async () => {
				setLoadingMusic(true)
				try {
					const res = await fetch(`/api/playlists/user/${user.id}/public`, {
						method: 'GET',
						headers: { 'Content-Type': 'application/json' },
					})
					if (res.ok) {
						const data = await res.json()
						setUserPlaylists(Array.isArray(data) ? data : [])
					}
				} catch (e) {
					console.error('Failed to load user playlists:', e)
					setUserPlaylists([])
				} finally {
					setLoadingMusic(false)
				}
			}
			fetchPlaylists()
		}
	}, [activeTab, user.id, userPlaylists.length])

	const handleAddPlaylistToMyMusic = async (playlistId: string) => {
		if (!authUser) return
		
		try {
			setAddingPlaylistId(playlistId)
			// Get the playlist details first
			const playlist = userPlaylists.find(p => p.id === playlistId)
			if (!playlist) return

			// Borrow playlist (creates local snapshot + requests sync permission)
			const response = await fetch('/api/playlists/borrow', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					source_playlist_id: playlist.id,
				}),
			})

			if (response.ok) {
				alert('Плейлист добавлен. Запрос синхронизации отправлен владельцу!')
			} else {
				alert('Не удалось добавить плейлист')
			}
		} catch (error) {
			console.error('Error adding playlist:', error)
			alert('Ошибка при добавлении плейлиста')
		} finally {
			setAddingPlaylistId(null)
		}
	}

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
			if (!res.ok) {
				const text = await res.text()
				let msg = text || 'Не удалось отправить заявку'
				try {
					const data = JSON.parse(text)
					msg = data?.error || data?.message || msg
				} catch {}
				throw new Error(msg)
			}
			alert('Заявка отправлена!')
		} catch (error) {
			console.error(error)
			alert((error as any)?.message || 'Ошибка при отправке заявки')
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
				description: (descriptionEdit || '').trim(),
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
				setDescriptionEdit(mergedUser.description || '')
				setDisplayDescription(mergedUser.description || '')
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

	useEffect(() => {
		setDescriptionEdit(user.description || '')
		setDisplayDescription(user.description || '')
	}, [user.description, user.id])

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
			className='mx-auto max-w-3xl space-y-6'
		>
			<div
				className={`relative h-48 rounded-2xl overflow-hidden shadow-lg ${
					user.premium ? '' : activeTheme.class
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
				{Boolean(user.premium) && (
					<div className='absolute inset-0 pointer-events-none'>
						<div className='absolute -top-10 -left-10 w-64 h-64 bg-amber-400/10 rounded-full blur-3xl animate-pulse' />
						<div className='absolute -bottom-10 -right-10 w-72 h-72 bg-indigo-500/10 rounded-full blur-3xl animate-pulse' />
					</div>
				)}
			</div>

			<div className='flex flex-col sm:flex-row items-end gap-6 px-4'>
				<motion.button
					initial={{ scale: 0.8, opacity: 0 }}
					animate={{ scale: 1, opacity: 1 }}
					transition={{ delay: 0.2 }}
					onClick={() => hasProfileStories && setIsStoriesOpen(true)}
					disabled={!hasProfileStories || loadingStories}
					className='-mt-20 relative z-10 disabled:cursor-default'
				>
					<div
						className={`rounded-full p-[3px] ${
							hasProfileStories
								? 'bg-gradient-to-tr from-indigo-500 to-pink-500'
								: 'bg-gray-700'
						}`}
					>
						<div className='flex h-32 w-32 items-center justify-center rounded-full bg-gray-900 overflow-hidden shadow-xl'>
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
						</div>
					</div>
					{hasProfileStories && (
						<span className='absolute -bottom-1 left-1/2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] text-white'>
							Сторис
						</span>
					)}
				</motion.button>

				<div className='flex-1 pb-2 w-full'>
					<div className='flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4'>
						<div>
							<h1 className='text-3xl font-bold text-white'>
								{user.username}
								{Boolean(user.premium) && (
									<span className='ml-2 text-amber-400'>★</span>
								)}
							</h1>
							{(isMe && privacySettings.show_email) ||
							(!isMe && user.privacy_settings?.show_email !== false) ? (
								<p className='text-sm text-gray-400'>{user.email}</p>
							) : null}
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

						<div className='flex flex-wrap items-center gap-2 justify-start sm:justify-end w-full sm:w-auto'>
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setIsShareModalOpen(true)}
								className='rounded-xl bg-white/10 border border-white/20 p-2.5 text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
								title='Поделиться страницей'
							>
								<Share2 className='h-4 w-4' />
							</motion.button>
							{isMe && (
								<>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={() => setIsPrivacyModalOpen(true)}
										className='rounded-xl bg-white/10 border border-white/20 p-2.5 text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
										title='Конфиденциальность'
									>
										<SettingsIcon className='h-4 w-4' />
									</motion.button>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={() => setIsEditModalOpen(true)}
										className='rounded-xl bg-white/10 border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
									>
										Редактировать
									</motion.button>
								</>
							)}
							{!isMe && (
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => setIsUserReportOpen(true)}
									className='rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-500/20 transition-all shadow-lg'
								>
									Пожаловаться
								</motion.button>
							)}
						</div>

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
												Инфо
											</label>
											<textarea
												value={descriptionEdit}
												onChange={e => setDescriptionEdit(e.target.value)}
												rows={4}
												className='w-full rounded-xl border border-gray-700 bg-black/50 px-4 py-3 text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all'
												placeholder='Расскажите о себе...'
												maxLength={500}
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
															<UploadCloud className='h-5 w-5' />
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
																		<UploadCloud className='h-5 w-5' />
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
							<div className='mt-4 flex flex-wrap gap-3 w-full'>
								{isFriend ? (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleRemoveFriend}
										disabled={loading}
										className='rounded-xl bg-red-500/15 border border-red-400/60 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/25 transition-all disabled:opacity-50'
									>
										Удалить из друзей
									</motion.button>
								) : (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleAddFriend}
										disabled={loading}
										className='rounded-xl bg-indigo-500/30 border border-indigo-300/40 px-4 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/40 transition-all disabled:opacity-50'
									>
										Добавить в друзья
									</motion.button>
								)}

								{isSubscribed ? (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleUnsubscribe}
										disabled={loading}
										className='rounded-xl bg-slate-500/20 border border-slate-300/35 px-4 py-2 text-sm font-semibold text-slate-100 hover:bg-slate-500/30 transition-all disabled:opacity-50'
									>
										Отписаться
									</motion.button>
								) : (
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										onClick={handleSubscribe}
										disabled={loading}
										className='rounded-xl bg-blue-500/30 border border-blue-300/40 px-4 py-2 text-sm font-semibold text-blue-100 hover:bg-blue-500/40 transition-all disabled:opacity-50'
									>
										Подписаться
									</motion.button>
								)}
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => setIsGiftModalOpen(true)}
									disabled={loading}
									className='rounded-xl bg-pink-500/30 border border-pink-300/40 px-4 py-2 text-sm font-semibold text-pink-100 hover:bg-pink-500/40 transition-all disabled:opacity-50'
								>
									Подарить
								</motion.button>
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={sendGiftPremium}
									disabled={loading || giftPremiumLoading}
									className='rounded-xl bg-amber-500/25 border border-amber-400/50 px-4 py-2 text-sm font-semibold text-amber-100 hover:bg-amber-500/35 transition-all disabled:opacity-50'
								>
									{giftPremiumLoading ? '…' : 'Premium 50'}
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
								{giftPremiumError && (
									<p className='w-full basis-full text-sm text-red-400 mt-1'>
										{giftPremiumError}
									</p>
								)}
							</div>
						)}
					</div>

					{displayDescription && (
						<p className='mt-4 text-sm text-gray-300 max-w-2xl'>
							{displayDescription}
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
			<AnimatePresence>
				{isShareModalOpen && (
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
							className='w-full max-w-sm rounded-2xl bg-gray-900/90 border border-white/10 p-5 shadow-2xl space-y-4'
						>
							<div className='flex items-center justify-between'>
								<h3 className='text-lg font-bold text-white'>Поделиться профилем</h3>
								<button
									onClick={() => setIsShareModalOpen(false)}
									className='text-gray-400 hover:text-white'
								>
									✕
								</button>
							</div>
							<div className='rounded-2xl bg-white p-2 w-fit mx-auto'>
								<img src={qrUrl} alt='QR профиля' className='h-48 w-48' />
							</div>
							<div className='rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-gray-300 break-all'>
								{profileUrl}
							</div>
							<div className='flex gap-2'>
								<button
									onClick={copyProfileLink}
									className='flex-1 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition'
								>
									Копировать ссылку
								</button>
								<a
									href={profileUrl}
									target='_blank'
									rel='noreferrer'
									className='rounded-xl border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10 transition inline-flex items-center gap-1'
								>
									<LinkIcon className='h-4 w-4' /> Открыть
								</a>
							</div>
						</motion.div>
					</motion.div>
				)}

				{isUserReportOpen && (
					<div className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'>
						<div className='w-full max-w-md rounded-2xl bg-gray-900/95 border border-white/10 p-6 shadow-2xl'>
							<div className='text-lg font-semibold text-white'>Жалоба</div>
							<div className='text-xs text-gray-400 mt-1'>
								На пользователя: {user.username}
							</div>
							<div className='mt-3 flex items-center gap-2'>
								<input
									ref={userReportFileInputRef}
									type='file'
									multiple
									className='hidden'
									onChange={async e => {
										const files = Array.from(e.target.files || [])
										if (!files.length) return
										setUserReportUploading(true)
										for (const file of files) {
											if (file.size > 20 * 1024 * 1024) {
												alert('Файл слишком большой (макс 20МБ)')
												continue
											}
											try {
												const base64 = await new Promise<string>(
													(resolve, reject) => {
														const reader = new FileReader()
														reader.onload = () =>
															resolve(reader.result as string)
														reader.onerror = () => reject(new Error('read_error'))
														reader.readAsDataURL(file)
													},
												)
												const res = await fetch('/api/v1/upload/file', {
													method: 'POST',
													headers: { 'Content-Type': 'application/json' },
													body: JSON.stringify({
														file: base64,
														filename: file.name,
													}),
												})
												const data = await res.json().catch(() => ({}))
												if (!res.ok || !data.url) {
													alert(data.error || 'Ошибка загрузки файла')
													continue
												}
												setUserReportAttachments(prev => [
													...prev,
													{ url: data.url, name: file.name, ext: data.ext },
												])
											} catch {
												alert('Ошибка загрузки файла')
											}
										}
										setUserReportUploading(false)
										if (userReportFileInputRef.current) {
											userReportFileInputRef.current.value = ''
										}
									}}
								/>
								<button
									type='button'
									onClick={() => userReportFileInputRef.current?.click()}
									disabled={userReportUploading}
									className='inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-white hover:bg-white/10 disabled:opacity-60'
								>
									<Paperclip className='h-4 w-4' />
									<span>
										{userReportUploading ? 'Загрузка...' : 'Прикрепить файлы'}
									</span>
								</button>
								{userReportAttachments.length > 0 && (
									<span className='text-xs text-gray-400'>
										{userReportAttachments.length} шт.
									</span>
								)}
							</div>
							{userReportAttachments.length > 0 && (
								<div className='mt-3 grid grid-cols-2 gap-2'>
									{userReportAttachments.map(a => {
										const src = getAttachmentUrl(a.url)
										const ext = (a.ext || a.name.split('.').pop() || '').toLowerCase()
										const isImg = [
											'jpg',
											'jpeg',
											'png',
											'gif',
											'webp',
											'svg',
										].includes(ext)
										const isVid = ['mp4', 'mov', 'webm', 'mkv', 'avi'].includes(ext)
										const isAud = ['mp3', 'wav', 'ogg', 'flac', 'm4a', 'webm'].includes(
											ext,
										)
										return (
											<div
												key={a.url}
												className='rounded-xl border border-white/10 bg-black/30 p-2'
											>
												<div className='flex items-center justify-between gap-2'>
													<div className='text-[10px] text-gray-300 truncate'>
														{a.name}
													</div>
													<button
														type='button'
														className='text-[10px] text-rose-300 hover:text-rose-200'
														onClick={() =>
															setUserReportAttachments(prev =>
																prev.filter(x => x.url !== a.url),
															)
														}
													>
														Удалить
													</button>
												</div>
												<div className='mt-2'>
													{isImg ? (
														<img
															src={src}
															alt='attachment'
															className='h-24 w-full rounded-lg object-cover cursor-pointer'
															onClick={() =>
																window.open(
																	src,
																	'_blank',
																	'noopener,noreferrer',
																)
															}
														/>
													) : isVid ? (
														<video
															controls
															preload='metadata'
															src={src}
															className='h-24 w-full rounded-lg object-cover'
														/>
													) : isAud ? (
														<audio controls preload='none' src={src} className='w-full' />
													) : (
														<a
															href={src}
															target='_blank'
															rel='noreferrer'
															className='text-xs text-indigo-300 hover:text-indigo-200 break-all'
														>
															Открыть
														</a>
													)}
												</div>
											</div>
										)
									})}
								</div>
							)}
							<textarea
								value={userReportText}
								onChange={e => setUserReportText(e.target.value)}
								className='mt-4 w-full min-h-[120px] rounded-xl border border-gray-700 bg-black/40 px-4 py-3 text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-rose-500/30'
								placeholder='Опишите проблему...'
							/>
							<div className='mt-4 flex gap-2'>
								<button
									type='button'
									onClick={() => setIsUserReportOpen(false)}
									className='flex-1 rounded-xl bg-gray-800 hover:bg-gray-700 text-white py-2.5'
								>
									Отмена
								</button>
								<button
									type='button'
									disabled={
										userReportBusy || userReportUploading || !userReportText.trim()
									}
									onClick={async () => {
										if (!authUser) return
										const description = userReportText.trim()
										if (!description) return
										setUserReportBusy(true)
										try {
											const res = await fetch('/api/support/user-reports', {
												method: 'POST',
												headers: { 'Content-Type': 'application/json' },
												body: JSON.stringify({
													target_user_id: user.id,
													target_user_login: user.username,
													description,
													attachments: userReportAttachments.map(a => a.url),
												}),
											})
											if (res.ok) {
												setUserReportText('')
												setUserReportAttachments([])
												setIsUserReportOpen(false)
											}
										} finally {
											setUserReportBusy(false)
										}
									}}
									className='flex-1 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white py-2.5 font-semibold'
								>
									Отправить
								</button>
							</div>
						</div>
					</div>
				)}
			</AnimatePresence>
			<AnimatePresence>
				{isPrivacyModalOpen && (
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
							className='w-full max-w-md rounded-2xl bg-gray-900/95 border border-white/10 p-6 shadow-2xl space-y-4'
						>
							<div className='flex items-center justify-between'>
								<h3 className='text-lg font-bold text-white'>Конфиденциальность</h3>
								<button
									onClick={() => setIsPrivacyModalOpen(false)}
									className='text-gray-400 hover:text-white'
								>
									✕
								</button>
							</div>
							{[
								{
									key: 'show_email',
									label: 'Показывать email',
									desc: 'Ваш email виден другим пользователям',
								},
								{
									key: 'show_online_status',
									label: 'Статус в сети',
									desc: 'Показывать, когда вы онлайн',
								},
								{
									key: 'show_last_seen',
									label: 'Последний раз в сети',
									desc: 'Показывать время последнего посещения',
								},
								{
									key: 'allow_friend_requests',
									label: 'Запросы в друзья',
									desc: 'Разрешить отправку запросов в друзья',
								},
							].map(item => (
								<div
									key={item.key}
									className='flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2.5'
								>
									<div>
										<div className='text-sm text-white'>{item.label}</div>
										<div className='text-xs text-gray-400'>{item.desc}</div>
									</div>
									<button
										onClick={() =>
											setPrivacySettings(prev => ({
												...prev,
												[item.key]: !(prev as any)[item.key],
											}))
										}
										className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
											(privacySettings as any)[item.key]
												? 'bg-indigo-600'
												: 'bg-gray-600'
										}`}
									>
										<span
											className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
												(privacySettings as any)[item.key]
													? 'translate-x-6'
													: 'translate-x-1'
											}`}
										/>
									</button>
								</div>
							))}
							<button
								onClick={savePrivacySettings}
								disabled={savingPrivacy}
								className='w-full rounded-xl bg-indigo-600 py-2.5 font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-60'
							>
								{savingPrivacy ? 'Сохранение...' : 'Сохранить'}
							</button>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>
			{isStoriesOpen && hasProfileStories && (
				<StoriesModal
					isOpen={isStoriesOpen}
					onClose={() => setIsStoriesOpen(false)}
					items={profileStories as any}
					title={user.username}
					ownerId={user.id}
					onUpdateStories={items => {
						setProfileStories(items as any)
					}}
				/>
			)}

			<div className='rounded-3xl bg-white/5 border border-white/10 backdrop-blur-md p-1'>
				<div className='flex flex-wrap gap-1'>
					<button
						onClick={() => setActiveTab('posts')}
						className={`flex-1 min-w-[110px] rounded-2xl py-3 px-2 text-sm font-medium transition-all ${
							activeTab === 'posts'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Посты
					</button>
					<button
						onClick={() => setActiveTab('friends')}
						className={`flex-1 min-w-[110px] rounded-2xl py-3 px-2 text-sm font-medium transition-all ${
							activeTab === 'friends'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Друзья
					</button>
					<button
						onClick={() => setActiveTab('music')}
						className={`flex-1 min-w-[110px] rounded-2xl py-3 px-2 text-sm font-medium transition-all ${
							activeTab === 'music'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Музыка
					</button>
					<button
						onClick={() => setActiveTab('video_info')}
						className={`flex-1 min-w-[100px] rounded-2xl py-3 px-2 text-sm font-medium transition-all ${
							activeTab === 'video_info'
								? 'bg-white/10 text-white shadow-sm'
								: 'text-gray-400 hover:text-white hover:bg-white/5'
						}`}
					>
						Инфо
					</button>
					<button
						onClick={() => setActiveTab('gifts')}
						className={`min-w-[96px] rounded-2xl py-3 px-3 text-sm font-medium whitespace-nowrap transition-all ${
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
									{displayDescription || 'Описание не указано'}
								</div>
							</div>
							<div className='grid grid-cols-1 gap-3 sm:grid-cols-3'>
								<div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
									<div className='text-xs text-gray-400'>Видео</div>
									<div className='mt-1 text-lg font-semibold text-white'>
										{videosCount}
									</div>
								</div>
								<div className='rounded-2xl border border-white/10 bg-white/5 p-4'>
									<div className='text-xs text-gray-400'>VShorts</div>
									<div className='mt-1 text-lg font-semibold text-white'>
										{shortsCount}
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
					) : activeTab === 'music' ? (
						<div className='space-y-4'>
							{loadingMusic ? (
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
									<p className='text-lg font-medium'>Музыка скрыта</p>
									<p className='text-sm text-gray-500'>
										Музыкальные плейлисты пользователя недоступны из-за блокировки
									</p>
								</div>
							) : userPlaylists.length > 0 ? (
								<div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'>
									{userPlaylists.map(playlist => (
										<motion.div
											key={playlist.id}
											initial={{ opacity: 0, y: 20 }}
											animate={{ opacity: 1, y: 0 }}
											className='rounded-2xl border border-white/10 bg-white/5 p-4 hover:bg-white/10 transition-all'
										>
											<div className='flex items-start justify-between mb-3'>
												<div className='flex-1 min-w-0'>
													<h3 className='font-bold text-white truncate'>
														{playlist.name}
													</h3>
													{playlist.description && (
														<p className='text-xs text-gray-400 mt-1 line-clamp-2'>
															{playlist.description}
														</p>
													)}
												</div>
											</div>
											<div className='space-y-2'>
												<div className='flex items-center justify-between text-xs text-gray-400'>
													<span>🎵 Треков:</span>
													<span className='text-white font-medium'>
														{playlist.track_count || playlist.tracks?.length || 0}
													</span>
												</div>
												{playlist.created_at && (
													<div className='flex items-center justify-between text-xs text-gray-400'>
														<span>📅 Создан:</span>
														<span className='text-white'>
															{new Date(playlist.created_at).toLocaleDateString()}
														</span>
													</div>
												)}
												{!isMe && authUser && (
													<button
														onClick={() => handleAddPlaylistToMyMusic(playlist.id)}
														disabled={addingPlaylistId === playlist.id}
														className='w-full mt-2 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-600 text-white text-sm font-medium rounded-xl transition-colors'
													>
														{addingPlaylistId === playlist.id ? (
															<span className='flex items-center justify-center gap-2'>
																<div className='h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent' />
																Добавление...
															</span>
														) : (
															'Добавить в мою музыку'
														)}
													</button>
												)}
											</div>
										</motion.div>
									))}
								</div>
							) : (
								<div className='col-span-full flex flex-col items-center justify-center py-12 text-center text-gray-400'>
									<motion.div
										initial={{ scale: 0.8, opacity: 0 }}
										animate={{ scale: 1, opacity: 1 }}
										transition={{ delay: 0.4 }}
										className='mb-4 text-6xl opacity-50'
									>
										🎵
									</motion.div>
									<p className='text-lg font-medium'>
										{isMe ? 'У вас пока нет плейлистов' : 'У пользователя нет плейлистов'}
									</p>
									<p className='text-sm text-gray-500 mt-1'>
										{isMe
											? 'Создайте свой первый плейлист в VМьюзик'
											: 'Пользователь еще не создал ни одного плейлиста'}
									</p>
								</div>
							)}
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
											src={getAvatarUrl(friend.avatar_url)}
											alt={friend.username}
											className='h-12 w-12 rounded-full object-cover'
										/>
										<div>
											<p className='font-medium text-white'>
												{friend.username}
											</p>
											{friend.privacy_settings?.show_email !== false && (
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
