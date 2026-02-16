'use client'

import { useAppSelector } from '@/lib/hooks'
import { User } from '@/lib/types'
import { getAttachmentUrl } from '@/lib/utils'
import { useEffect, useRef, useState } from 'react'
import StoriesModal from './StoriesModal'

type Props = {
	onCreateStory?: () => void
}

export default function StoriesBar({ onCreateStory }: Props) {
	const { user } = useAppSelector(s => s.auth)
	const [friends, setFriends] = useState<User[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [openUser, setOpenUser] = useState<User | null>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [isUploading, setIsUploading] = useState(false)
	const [storyText, setStoryText] = useState('')

	useEffect(() => {
		const fetchFriends = async () => {
			if (!user) return
			setIsLoading(true)
			try {
				const cacheKey = `stories_friends_${user.id}`
				try {
					const raw = typeof window !== 'undefined' ? window.localStorage.getItem(cacheKey) : null
					if (raw) {
						const parsed = JSON.parse(raw)
						if (Array.isArray(parsed)) {
							setFriends(parsed)
						}
					}
				} catch {}
				const res = await fetch('/api/storis/friends', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: user.id }),
				})
				if (res.ok) {
					const data = await res.json()
					const list = Array.isArray(data) ? data : []
					setFriends(list)
					try {
						if (typeof window !== 'undefined') {
							window.localStorage.setItem(cacheKey, JSON.stringify(list))
						}
					} catch {}
				}
			} finally {
				setIsLoading(false)
			}
		}
		fetchFriends()
	}, [user?.id])

	const fileToDataUrl = (file: File) =>
		new Promise<string>((resolve, reject) => {
			const reader = new FileReader()
			reader.onload = () => resolve(String(reader.result))
			reader.onerror = () => reject(new Error('File read error'))
			reader.readAsDataURL(file)
		})

	const uploadFile = async (file: File) => {
		const dataUrl = await fileToDataUrl(file)
		const res = await fetch('/api/upload/file', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				file: dataUrl,
				filename: file.name,
			}),
		})
		if (!res.ok) throw new Error(await res.text())
		const data: any = await res.json().catch(() => ({}))
		const url = data?.url || data?.file_url || data?.path
		if (!url) throw new Error('Invalid upload response')
		return url
	}

	const createStory = async (file: File) => {
		if (isUploading) return
		setIsUploading(true)
		try {
			const url = await uploadFile(file)
			const ext = file.name.includes('.')
				? file.name.split('.').pop()!.toLowerCase()
				: ''
			const type = ['mp4', 'mov', 'webm', 'mkv'].includes(ext) ? 'video' : 'image'
			const res = await fetch('/api/storis/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url,
					type,
					text: storyText.trim() || undefined,
				}),
			})
			if (res.ok) {
				const created = await res.json().catch(() => null)
				let selfStories: any[] | null = null
				if (created && created.storis && Array.isArray(created.storis)) {
					selfStories = created.storis
					if (user) {
						setOpenUser({
							...(user as User),
							storis: created.storis,
						})
					}
				}
				const list = await fetch('/api/storis/friends', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: user?.id }),
				})
				if (list.ok) {
					const data = await list.json()
					let updated = Array.isArray(data) ? data : []
					if (user && selfStories) {
						const me: User = {
							...(user as User),
							storis: selfStories as any,
						}
						updated = [me, ...updated.filter(f => f.id !== user.id)]
					}
					setFriends(updated)
					try {
						if (user && typeof window !== 'undefined') {
							const cacheKey = `stories_friends_${user.id}`
							window.localStorage.setItem(cacheKey, JSON.stringify(updated))
						}
					} catch {}
				}
			}
			setStoryText('')
		} finally {
			setIsUploading(false)
		}
	}

	const pickFile = () => fileInputRef.current?.click()
	const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0]
		e.target.value = ''
		if (file) createStory(file)
	}

	return (
		<div className='rounded-xl bg-gray-900/40 backdrop-blur-md border border-gray-800/50 p-3'>
			<input
				ref={fileInputRef}
				type='file'
				accept='image/*,video/*'
				className='hidden'
				onChange={onFileSelected}
			/>
			<div className='mb-2 flex items-center justify-between'>
				<div className='text-sm text-gray-400'>Сторис друзей</div>
				<button
					onClick={pickFile}
					className='rounded-md bg-indigo-600 px-3 py-1 text-sm text-white hover:bg-indigo-500 disabled:opacity-60'
					disabled={isUploading}
				>
					{isUploading ? 'Публикация...' : 'Создать сторис'}
				</button>
			</div>
			<div className='mb-2'>
				<input
					type='text'
					value={storyText}
					onChange={e => setStoryText(e.target.value)}
					placeholder='Текст для вашей сторис'
					className='w-full rounded-md border border-gray-800 bg-gray-900/60 px-3 py-1.5 text-sm text-gray-100 placeholder:text-gray-500 outline-none focus:border-indigo-500'
					maxLength={200}
				/>
			</div>
			{isLoading ? (
				<div className='py-2 text-xs text-gray-500'>Загрузка...</div>
			) : friends.length === 0 ? (
				<div className='py-2 text-xs text-gray-500'>Нет сторис у друзей</div>
			) : (
				<div className='flex gap-3 overflow-x-auto'>
					{friends.map(f => (
						<button
							key={f.id}
							onClick={async () => {
								try {
									const res = await fetch('/api/storis/user', {
										method: 'POST',
										headers: { 'Content-Type': 'application/json' },
										body: JSON.stringify({ user_id: f.id }),
									})
									if (res.ok) {
										const items = await res.json().catch(() => [])
										setOpenUser({
											...f,
											storis: Array.isArray(items) ? (items as any) : [],
										})
										return
									}
								} catch {}
								setOpenUser(f)
							}}
							className='flex flex-col items-center gap-2'
						>
							<img
								src={getAttachmentUrl(f.avatar_url) || '/placeholder-user.jpg'}
								alt={f.username}
								className='h-14 w-14 rounded-full object-cover ring-2 ring-indigo-500'
							/>
							<div className='text-xs text-gray-400 max-w-[80px] truncate'>
								{f.username}
							</div>
						</button>
					))}
				</div>
			)}

			{openUser && (
				<StoriesModal
					isOpen={!!openUser}
					onClose={() => setOpenUser(null)}
					items={(openUser.storis as any) || []}
					title={openUser.username}
					ownerId={openUser.id}
					onUpdateStories={items => {
						if (!items.length) {
							setOpenUser(prev =>
								prev && prev.id === openUser.id ? null : prev,
							)
							setFriends(prev => {
								const next = prev.filter(f => f.id !== openUser.id)
								if (user && typeof window !== 'undefined') {
									const cacheKey = `stories_friends_${user.id}`
									try {
										window.localStorage.setItem(
											cacheKey,
											JSON.stringify(next),
										)
									} catch {}
								}
								return next
							})
							return
						}
						setOpenUser(prev =>
							prev && prev.id === openUser.id
								? { ...prev, storis: items as any }
								: prev,
						)
						setFriends(prev => {
							const next = prev.map(f =>
								f.id === openUser.id ? { ...f, storis: items as any } : f,
							)
							if (user && typeof window !== 'undefined') {
								const cacheKey = `stories_friends_${user.id}`
								try {
									window.localStorage.setItem(cacheKey, JSON.stringify(next))
								} catch {}
							}
							return next
						})
					}}
				/>
			)}
		</div>
	)
}
