'use client'

import AppLoader from '@/components/ui/AppLoader'
import Composer from '@/components/social/Composer'
import FeedPageShell from '@/components/social/FeedPageShell'
import Post from '@/components/social/Post'
import { useAuth } from '@/lib/AuthContext'
import { useSocialCommunities, type SocialCommunity } from '@/lib/hooks/useSocialCommunities'
import { useToast } from '@/lib/ToastContext'
import { Attachment } from '@/lib/types'
import { formatMskDateTime, getAttachmentUrl, getAvatarUrl } from '@/lib/utils'

function socialCommunityJoinUrl(code: string) {
	if (typeof window !== 'undefined') {
		return `${window.location.origin}/feed/communities/join/${encodeURIComponent(code)}`
	}
	return `/feed/communities/join/${encodeURIComponent(code)}`
}
import { motion } from 'framer-motion'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	LuCamera as Camera,
	LuCheck as Check,
	LuCopy as Copy,
	LuLoader as Loader,
	LuUsers as Users,
} from 'react-icons/lu'

type CommunityPost = {
	id: string
	author_name?: string
	author_avatar?: string | null
	posted_by: string
	content: string
	created_at?: string
	likes?: number
	comments_count?: number
	is_liked?: boolean
	attachments?: Attachment[]
}

function coverGradient(name: string) {
	let hash = 0
	for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
	const hue = Math.abs(hash) % 360
	return `linear-gradient(135deg, hsl(${hue} 45% 28%) 0%, hsl(${(hue + 40) % 360} 50% 18%) 100%)`
}

export default function CommunityPage() {
	const { id } = useParams()
	const communityId = String(id)
	const { user, logout } = useAuth()
	const { showToast } = useToast()
	const { fetchMyCommunities, updateCommunity } = useSocialCommunities()
	const [community, setCommunity] = useState<SocialCommunity | null>(null)
	const [posts, setPosts] = useState<CommunityPost[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState('')
	const [copiedInvite, setCopiedInvite] = useState(false)
	const [uploadingAvatar, setUploadingAvatar] = useState(false)
	const [uploadingCover, setUploadingCover] = useState(false)
	const avatarInputRef = useRef<HTMLInputElement>(null)
	const coverInputRef = useRef<HTMLInputElement>(null)

	const isOwner = useMemo(
		() => community && user && String(community.owner_id) === String(user.id),
		[community, user],
	)

	const loadCommunity = useCallback(async () => {
		const res = await fetch(`/api/v1/social-communities/${communityId}`, {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({}),
		})
		if (!res.ok) throw new Error('Сообщество не найдено')
		setCommunity(await res.json())
	}, [communityId])

	const loadPosts = useCallback(async () => {
		const res = await fetch(
			`/api/posts?social_community_id=${encodeURIComponent(communityId)}&per_page=30`,
		)
		if (!res.ok) throw new Error('Не удалось загрузить записи')
		const data = await res.json()
		setPosts(data.items || [])
	}, [communityId])

	useEffect(() => {
		const run = async () => {
			setLoading(true)
			setError('')
			try {
				await Promise.all([loadCommunity(), loadPosts()])
				fetchMyCommunities()
			} catch (e: unknown) {
				setError(e instanceof Error ? e.message : 'Ошибка загрузки')
			} finally {
				setLoading(false)
			}
		}
		if (communityId) run()
	}, [communityId, loadCommunity, loadPosts, fetchMyCommunities])

	const handleCreatePost = async (text: string, attachments?: Attachment[]) => {
		const res = await fetch('/api/posts', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				content: text,
				attachments,
				social_community_id: communityId,
			}),
		})
		if (!res.ok) {
			const err = await res.json().catch(() => ({}))
			throw new Error(err.error || 'Не удалось опубликовать')
		}
		await loadPosts()
		showToast('Запись опубликована', 'success')
	}

	const handleDeletePost = async (postId: string | number, reason?: string) => {
		if (!user?.id) return
		try {
			const res = await fetch(`/api/posts/${postId}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ user_id: user.id, reason }),
			})
			if (!res.ok) {
				const err = await res.json().catch(() => ({}))
				throw new Error(err.error || 'Не удалось удалить')
			}
			setPosts(prev => prev.filter(p => String(p.id) !== String(postId)))
			showToast('Запись удалена', 'success')
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Ошибка удаления', 'error')
		}
	}

	const handleUpdatePost = async (
		postId: string | number,
		newText?: string,
	) => {
		try {
			const res = await fetch(`/api/posts/${postId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ content: newText }),
			})
			if (!res.ok) throw new Error('Не удалось сохранить')
			await loadPosts()
			showToast('Запись обновлена', 'success')
		} catch {
			showToast('Не удалось обновить запись', 'error')
		}
	}

	const uploadImage = async (file: File, filename: string) => {
		const maxSize = 10 * 1024 * 1024
		if (file.size > maxSize) {
			throw new Error('Файл больше 10 МБ')
		}
		if (!file.type.startsWith('image/')) {
			throw new Error('Загрузите изображение (JPG, PNG, WebP)')
		}
		const base64 = await new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result))
			reader.onerror = () => reject(new Error('Ошибка чтения файла'))
			reader.readAsDataURL(file)
		})
		const res = await fetch('/api/upload/file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ file: base64, filename }),
		})
		const data = await res.json().catch(() => ({}))
		if (!res.ok || !data.url) {
			throw new Error(data.error || 'Ошибка загрузки')
		}
		return data.url as string
	}

	const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file || !community) return
		setUploadingAvatar(true)
		try {
			const url = await uploadImage(file, `community-avatar-${community.id}.jpg`)
			const updated = await updateCommunity(community.id, { avatar_url: url })
			setCommunity(updated)
			showToast('Аватар обновлён', 'success')
		} catch (err: unknown) {
			showToast(err instanceof Error ? err.message : 'Ошибка', 'error')
		} finally {
			setUploadingAvatar(false)
			if (avatarInputRef.current) avatarInputRef.current.value = ''
		}
	}

	const handleCoverChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		if (!file || !community) return
		setUploadingCover(true)
		try {
			const url = await uploadImage(file, `community-cover-${community.id}.jpg`)
			const updated = await updateCommunity(community.id, { cover_url: url })
			setCommunity(updated)
			showToast('Обложка обновлена', 'success')
		} catch (err: unknown) {
			showToast(err instanceof Error ? err.message : 'Ошибка', 'error')
		} finally {
			setUploadingCover(false)
			if (coverInputRef.current) coverInputRef.current.value = ''
		}
	}

	const copyInvite = async () => {
		if (!community?.invite_code) return
		try {
			await navigator.clipboard.writeText(
				socialCommunityJoinUrl(community.invite_code),
			)
			setCopiedInvite(true)
			showToast('Ссылка скопирована', 'success')
			setTimeout(() => setCopiedInvite(false), 2000)
		} catch {
			showToast('Не удалось скопировать', 'error')
		}
	}

	if (loading) {
		return (
			<FeedPageShell email={user?.email} onLogout={logout}>
				<main className='flex flex-1 items-center justify-center p-8'>
					<AppLoader size='lg' />
				</main>
			</FeedPageShell>
		)
	}

	if (error || !community) {
		return (
			<FeedPageShell email={user?.email} onLogout={logout}>
				<main className='flex flex-1 flex-col items-center justify-center p-8'>
					<p className='mb-4 text-gray-400'>{error || 'Не найдено'}</p>
					<Link href='/feed/communities' className='text-indigo-400'>
						← Все сообщества
					</Link>
				</main>
			</FeedPageShell>
		)
	}

	const coverBackground = community.cover_url
		? { backgroundImage: `url(${getAttachmentUrl(community.cover_url)})` }
		: { backgroundImage: coverGradient(community.name) }

	return (
		<FeedPageShell email={user?.email} onLogout={logout}>
				<main className='flex-1 p-4 sm:p-6 lg:p-8'>
					<Link
						href='/feed/communities'
						className='mb-4 inline-block text-sm text-gray-400 hover:text-white'
					>
						← Все сообщества
					</Link>

					<motion.div
						initial={{ opacity: 0, y: 12 }}
						animate={{ opacity: 1, y: 0 }}
						className='mx-auto max-w-3xl'
					>
						{/* Обложка + шапка как у страницы VK */}
						<div className='overflow-hidden rounded-2xl border border-white/10 bg-gray-900/30 shadow-xl'>
							{isOwner && (
								<>
									<input
										ref={coverInputRef}
										type='file'
										accept='image/*'
										className='hidden'
										onChange={handleCoverChange}
									/>
									<input
										ref={avatarInputRef}
										type='file'
										accept='image/*'
										className='hidden'
										onChange={handleAvatarChange}
									/>
								</>
							)}
							<div
								className='group/cover relative h-44 bg-cover bg-center sm:h-52'
								style={coverBackground}
							>
								<div className='absolute inset-0 bg-gradient-to-t from-black via-black/20 to-black/10' />
								{isOwner && (
									<button
										type='button'
										onClick={() => coverInputRef.current?.click()}
										disabled={uploadingCover}
										className='absolute right-3 top-3 flex items-center gap-2 rounded-lg bg-black/50 px-3 py-1.5 text-xs font-medium text-white opacity-90 backdrop-blur-sm transition-opacity hover:bg-black/70 sm:opacity-0 sm:group-hover/cover:opacity-100 disabled:opacity-70'
									>
										{uploadingCover ? (
											<Loader className='h-4 w-4 animate-spin' />
										) : (
											<Camera className='h-4 w-4' />
										)}
										{uploadingCover ? 'Загрузка…' : 'Изменить обложку'}
									</button>
								)}
							</div>

							<div className='relative px-4 pb-5 sm:px-6'>
								<div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
									<div className='flex items-end gap-4'>
										<div className='group/avatar relative -mt-14 shrink-0 sm:-mt-16'>
											<div className='rounded-full border-4 border-black bg-black shadow-lg'>
												{community.avatar_url ? (
													<img
														src={getAvatarUrl(community.avatar_url)}
														alt=''
														className='h-24 w-24 rounded-full object-cover sm:h-28 sm:w-28'
													/>
												) : (
													<div className='flex h-24 w-24 items-center justify-center rounded-full bg-indigo-900/80 text-3xl font-bold text-indigo-100 sm:h-28 sm:w-28'>
														{community.name.charAt(0).toUpperCase()}
													</div>
												)}
											</div>
											{isOwner && (
												<button
													type='button'
													onClick={() => avatarInputRef.current?.click()}
													disabled={uploadingAvatar}
													className='absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-90 transition-opacity sm:opacity-0 sm:group-hover/avatar:opacity-100 disabled:opacity-70'
													title='Изменить аватар'
												>
													{uploadingAvatar ? (
														<Loader className='h-7 w-7 animate-spin text-white' />
													) : (
														<Camera className='h-7 w-7 text-white' />
													)}
												</button>
											)}
										</div>
										<div className='min-w-0 pb-1'>
											<h1 className='truncate text-2xl font-bold sm:text-3xl'>
												{community.name}
											</h1>
											<div className='mt-1 flex flex-wrap items-center gap-3 text-sm text-gray-400'>
												<span className='inline-flex items-center gap-1'>
													<Users className='h-4 w-4' />
													{community.members_count ?? 0} подписчиков
												</span>
												{community.is_public !== false && (
													<span className='rounded-full bg-white/10 px-2 py-0.5 text-xs'>
														Открытое
													</span>
												)}
												{isOwner && (
													<span className='rounded-full bg-indigo-500/20 px-2 py-0.5 text-xs text-indigo-300'>
														Вы администратор
													</span>
												)}
											</div>
										</div>
									</div>

									{community.invite_code && (
										<button
											type='button'
											onClick={copyInvite}
											className='inline-flex items-center justify-center gap-2 self-start rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm hover:bg-white/10 sm:self-auto'
										>
											{copiedInvite ? (
												<Check className='h-4 w-4 text-green-400' />
											) : (
												<Copy className='h-4 w-4' />
											)}
											Пригласить
										</button>
									)}
								</div>

								{community.description && (
									<p className='mt-4 text-sm leading-relaxed text-gray-300 sm:text-base'>
										{community.description}
									</p>
								)}
							</div>
						</div>

						{/* Вкладка «Записи» */}
						<div className='mt-6 border-b border-white/10'>
							<span className='inline-block border-b-2 border-indigo-500 px-1 pb-3 text-sm font-semibold text-white'>
								Записи
							</span>
						</div>

						<div className='mt-4'>
							{isOwner && <Composer onCreate={handleCreatePost} />}
						</div>

						<div className='mt-4 space-y-4'>
							{posts.length === 0 ? (
								<div className='rounded-xl border border-dashed border-gray-700 bg-gray-900/20 py-12 text-center text-gray-500'>
									Пока нет записей на стене сообщества
								</div>
							) : (
								posts.map(p => (
									<Post
										key={p.id}
										id={p.id}
										author={p.author_name || 'Участник'}
										author_id={p.posted_by}
										author_avatar={p.author_avatar}
										time={
											p.created_at
												? formatMskDateTime(p.created_at)
												: 'недавно'
										}
										text={p.content}
										likes={p.likes || 0}
										comments_count={p.comments_count || 0}
										isLikedByCurrentUser={p.is_liked || false}
										attachments={p.attachments}
										currentUserId={user?.id}
										userRole={user?.role}
										canModerate={!!isOwner}
										onDelete={handleDeletePost}
										onUpdate={handleUpdatePost}
									/>
								))
							)}
						</div>
					</motion.div>
				</main>
		</FeedPageShell>
	)
}
