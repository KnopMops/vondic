import { useAppSelector } from '@/lib/hooks'
import { User } from '@/lib/types'
import { getAvatarUrl } from '@/lib/utils'
import { LuPlus as Plus } from 'react-icons/lu'
import { useEffect, useState } from 'react'
import CreateStoryModal from './CreateStoryModal'
import StoriesModal from './StoriesModal'

type Props = {
	onCreateStory?: () => void
}

export default function StoriesBar({ onCreateStory }: Props) {
	const { user } = useAppSelector(s => s.auth)
	const [friends, setFriends] = useState<User[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [openUser, setOpenUser] = useState<User | null>(null)
	const [isUploading, setIsUploading] = useState(false)
	const [showCreateModal, setShowCreateModal] = useState(false)
	const [viewedStories, setViewedStories] = useState<string[]>([])

	useEffect(() => {
		const viewed = localStorage.getItem('viewed_stories')
		if (viewed) {
			try {
				setViewedStories(JSON.parse(viewed))
			} catch (e) {
				console.error('Failed to parse viewed stories', e)
			}
		}
	}, [])

	const markAsViewed = (storyId: string) => {
		setViewedStories(prev => {
			if (prev.includes(storyId)) return prev
			const next = [...prev, storyId]
			localStorage.setItem('viewed_stories', JSON.stringify(next))
			return next
		})
	}

	useEffect(() => {
		const fetchData = async () => {
			if (!user) return
			setIsLoading(true)
			try {
				// 1. Fetch all friends
				const friendsRes = await fetch('/api/friends/list', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: user.id }),
				})
				let allFriends: User[] = []
				if (friendsRes.ok) {
					allFriends = await friendsRes.json().catch(() => [])
				}

				// 2. Fetch current user's stories
				const userStoriesRes = await fetch('/api/storis/user', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: user.id }),
				})
				let userStories: any[] = []
				if (userStoriesRes.ok) {
					userStories = await userStoriesRes.json().catch(() => [])
				}

				// 3. Fetch friends' stories
				const storiesRes = await fetch('/api/storis/friends', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ user_id: user.id }),
				})
				let friendsWithStoriesData: any[] = []
				if (storiesRes.ok) {
					friendsWithStoriesData = await storiesRes.json().catch(() => [])
				}

				// 4. Merge data: only friends with stories
				const storiesMap: Record<string, any[]> = {}
				friendsWithStoriesData.forEach((f: any) => {
					storiesMap[f.id] = f.storis || []
				})

				const friendsWithStoriesIds = new Set(
					friendsWithStoriesData.map((f: any) => f.id)
				)
				const friendsWithStories = allFriends
					.filter(f => friendsWithStoriesIds.has(f.id))
					.map(f => ({
						...f,
						storis: storiesMap[f.id] || [],
					}))

				const userWithStories = {
					...user,
					storis: Array.isArray(userStories) ? userStories : [],
				}

				// Only show user always, plus friends with stories
				const finalData = [
					userWithStories,
					...friendsWithStories.filter(f => f.id !== user.id),
				]
				setFriends(finalData)
			} catch (err) {
				console.error('Failed to fetch stories data', err)
			} finally {
				setIsLoading(false)
			}
		}
		fetchData()
	}, [user?.id])

	const handleUpload = async (file: File, text: string) => {
		setIsUploading(true)
		try {
			// Read file as data URL
			const dataUrl = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader()
				reader.onload = () => resolve(reader.result as string)
				reader.onerror = reject
				reader.readAsDataURL(file)
			})

			// Upload file
			const uploadRes = await fetch('/api/upload/file', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ file: dataUrl, filename: file.name }),
			})

			if (!uploadRes.ok) throw new Error('Upload failed')
			const uploadData = await uploadRes.json()
			const url = uploadData.url || uploadData.file_url || uploadData.path

			// Create story
			const ext = file.name.split('.').pop()?.toLowerCase() || ''
			const type = ['mp4', 'mov', 'webm'].includes(ext) ? 'video' : 'image'

			const storyRes = await fetch('/api/storis/create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ url, type, text }),
			})

			if (storyRes.ok) {
				const created = await storyRes.json()
				// Refresh data
				if (user) {
					const updatedFriends = friends.map(f =>
						f.id === user.id ? { ...f, storis: created.storis || [] } : f,
					)
					setFriends(updatedFriends)
				}
				setShowCreateModal(false)
			}
		} catch (error) {
			console.error('Story creation error:', error)
			alert('Ошибка при создании истории')
		} finally {
			setIsUploading(false)
		}
	}

	const hasUnviewedStories = (f: User) => {
		if (!f.storis || f.storis.length === 0) return false
		return f.storis.some((s: any) => !viewedStories.includes(s.id))
	}

	return (
		<div className='rounded-2xl bg-gray-900/40 backdrop-blur-md border border-gray-800/30 p-4'>
			<div className='mb-4'>
				<h3 className='text-sm font-semibold text-white'>Истории</h3>
			</div>

			{isLoading ? (
				<div className='flex gap-4 overflow-x-auto pb-2'>
					{[1, 2, 3, 4, 5].map(i => (
						<div
							key={i}
							className='flex flex-col items-center gap-2 min-w-[72px] animate-pulse'
						>
							<div className='h-16 w-16 rounded-full bg-gray-800' />
							<div className='h-3 w-12 rounded bg-gray-800' />
						</div>
					))}
				</div>
			) : (
				<div className='flex gap-4 overflow-x-auto custom-scrollbar pb-2'>
					{friends.map(f => {
						const isMe = f.id === user?.id
						const hasStories = f.storis && f.storis.length > 0
						const isNew = hasUnviewedStories(f)

						return (
							<button
								key={f.id}
								onClick={() => {
									if (hasStories) {
										setOpenUser(f)
										// Mark first story as viewed immediately
										if (f.storis && f.storis[0]) {
											markAsViewed(f.storis[0].id)
										}
									} else if (isMe) {
										setShowCreateModal(true)
									}
								}}
								className='flex flex-col items-center gap-2 min-w-[72px] group'
							>
								<div className='relative'>
									<div
										className={`rounded-full p-[2.5px] transition-all duration-300 ${
											isNew
												? 'bg-gradient-to-tr from-green-500 to-emerald-400'
												: 'bg-gray-700'
										}`}
									>
										<div className='rounded-full bg-gray-900 p-[2px]'>
											<img
												src={getAvatarUrl(f.avatar_url)}
												alt={f.username}
												className={`h-14 w-14 rounded-full object-cover transition-transform group-hover:scale-105 ${
													!hasStories && !isMe ? 'opacity-50' : ''
												}`}
											/>
										</div>
									</div>
									{isMe && !hasStories && (
										<div className='absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-indigo-600 border-2 border-gray-900 flex items-center justify-center shadow-lg'>
											<Plus className='w-3.5 h-3.5 text-white' />
										</div>
									)}
								</div>
								<div
									className={`text-xs max-w-[72px] truncate font-medium transition-colors ${
										isNew ? 'text-white' : 'text-gray-500'
									}`}
								>
									{isMe ? 'Моя история' : f.username.split(' ')[0]}
								</div>
							</button>
						)
					})}
				</div>
			)}

			<CreateStoryModal
				isOpen={showCreateModal}
				onClose={() => setShowCreateModal(false)}
				onUpload={handleUpload}
				isUploading={isUploading}
			/>

			{openUser && (
				<StoriesModal
					isOpen={!!openUser}
					onClose={() => setOpenUser(null)}
					items={(openUser.storis as any) || []}
					title={openUser.username}
					ownerId={openUser.id}
					onViewed={markAsViewed}
					onUpdateStories={items => {
						if (!items.length) {
							setOpenUser(null)
							setFriends(prev =>
								prev.map(f =>
									f.id === openUser.id ? { ...f, storis: [] } : f,
								),
							)
							return
						}
						setOpenUser({ ...openUser, storis: items as any })
						setFriends(prev =>
							prev.map(f =>
								f.id === openUser.id ? { ...f, storis: items as any } : f,
							),
						)
					}}
				/>
			)}
		</div>
	)
}
