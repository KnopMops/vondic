'use client'

import PollCard from '@/components/chat/PollCard'
import AudioPlayer from '@/components/social/AudioPlayer'
import PostDetailsModal from '@/components/social/PostDetailsModal'
import VideoPlayer from '@/components/social/VideoPlayer'
import { AppleEmoji } from '@/components/ui/AppleEmoji'
import { Attachment, User } from '@/lib/types'
import { MessageGroupPosition } from '@/lib/chatMessageLayout'
import {
	inviteEntityLabel,
	parseInviteLink,
} from '@/lib/inviteLinks'
import { renderRichFormattedContent } from '@/lib/messageRichText'
import { formatMskTime, getAttachmentUrl, getAvatarUrl, isGifUrl, isStickerUrl } from '@/lib/utils'
import { memo, useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
	LuCheck as Check,
	LuCheckCheck as CheckCheck,
	LuMic as Mic,
	LuRepeat2 as Repeat2,
	LuTimer as TimerIcon,
	LuMapPin,
	LuUser,
	LuChartNoAxesColumn,
	LuMusic,
} from 'react-icons/lu'
import { FiMoreHorizontal as MoreHorizontal } from 'react-icons/fi'

interface Message {
	id: string
	sender_id: string
	content: string
	timestamp: string
	isOwn: boolean
	is_read?: boolean
	is_edited?: boolean
	type?: 'text' | 'voice' | 'video_note' | 'poll' | 'image' | 'file' | 'game' | 'call_invite'
		| 'photo' | 'video' | 'document' | 'audio' | 'sticker' | 'location' | 'venue'
		| 'contact' | 'dice'
	channel_id?: string
	group_id?: string
	reply_to?: string
	attachments?: Attachment[]
	is_deleted?: boolean
	sender_username?: string
	sender_avatar?: string | null
	forwarded_from?: {
		sender_id: string
		sender_name: string
		sender_avatar?: string | null
		chat_name?: string
	}
	reply_markup?: {
		inline_keyboard: Array<Array<{
			text: string
			callback_data?: string
			url?: string
		}>>
	}
	disappear_after?: number | null
	disappear_at?: string | null
	game?: {
		id: string
		title?: string
		embed_url: string
		download_url?: string
	}
	target_id?: string
	// Bot outbox content types (from send_bot_message)
	bot_photo?: any
	bot_video?: any
	bot_document?: any
	bot_audio?: any
	bot_voice?: any
	bot_video_note?: any
	bot_sticker?: any
	bot_location?: any
	bot_venue?: any
	bot_contact?: any
	bot_poll?: any
	bot_dice?: any
	bot_caption?: string
}

const getBubbleRadius = (
	isOwn: boolean,
	position: MessageGroupPosition = 'single',
) => {
	if (isOwn) {
		switch (position) {
			case 'first':
				return 'rounded-[17px] rounded-br-[5px]'
			case 'middle':
				return 'rounded-[17px] rounded-tr-[5px] rounded-br-[5px]'
			case 'last':
				return 'rounded-[17px] rounded-tr-[5px] rounded-br-[3px]'
			default:
				return 'rounded-[17px] rounded-br-[3px]'
		}
	}
	switch (position) {
		case 'first':
			return 'rounded-[17px] rounded-bl-[5px]'
		case 'middle':
			return 'rounded-[17px] rounded-tl-[5px] rounded-bl-[5px]'
		case 'last':
			return 'rounded-[17px] rounded-tl-[5px] rounded-bl-[3px]'
		default:
			return 'rounded-[17px] rounded-bl-[3px]'
	}
}

const getClusterMargin = (position: MessageGroupPosition) => {
	if (position === 'first' || position === 'middle') return 'mb-1.5'
	return 'mb-4'
}

interface MessageBubbleProps {
	msg: Message
	groupPosition?: MessageGroupPosition
	theme?: {
		ownMessageBg: string
	}
	sender?: User
	isPinned?: boolean
	replyPreview?: { sender: string; text: string }
	reactions?: Record<string, { count: number; reacted: boolean }>
	onReply?: (msg: Message) => void
	onPin?: (msg: Message) => void
	onDelete?: (msg: Message) => void
	onEdit?: (msg: Message, text: string) => void
	onReact?: (msg: Message, emoji: string) => void
	onForward?: (msg: Message) => void
	isSelectionMode?: boolean
	isSelected?: boolean
	onToggleSelect?: (msg: Message) => void
	isDeleting?: boolean
	currentUserId?: string
	botAccessToken?: string
	onBotOutboxItems?: (botId: string, items: any[]) => void
	onBotModal?: (botId: string, modal: string) => void
	onBotGamePlay?: (game: { embed_url: string; title?: string; download_url?: string }) => void
	onSenderClick?: (senderId: string) => void
}

const REACTIONS = ['❤️', '🔥', '😂', '👍', '😮', '😢']

const MessageBubble = memo(
	({
		msg,
		groupPosition = 'single',
		theme,
		sender,
		isPinned,
		replyPreview,
		reactions,
		onReply,
		onPin,
		onDelete,
		onEdit,
		onReact,
		onForward,
		isSelectionMode,
		isSelected,
		onToggleSelect,
		isDeleting = false,
		currentUserId,
		botAccessToken,
		onBotOutboxItems,
		onBotModal,
		onBotGamePlay,
		onSenderClick,
	}: MessageBubbleProps) => {
		const [isDetailsOpen, setIsDetailsOpen] = useState(false)
		const [isMenuOpen, setIsMenuOpen] = useState(false)
		const [isReactionsOpen, setIsReactionsOpen] = useState(false)
		const [isEditing, setIsEditing] = useState(false)
		const [editValue, setEditValue] = useState(msg.content)
		const menuRef = useRef<HTMLDivElement | null>(null)
		const [hasDisappeared, setHasDisappeared] = useState(false)

		useEffect(() => {
			if (!msg.disappear_at) {
				setHasDisappeared(false)
				return
			}
			const check = () => {
				const diff = new Date(msg.disappear_at!).getTime() - Date.now()
				if (diff <= 0) {
					setHasDisappeared(true)
				}
			}
			check()
			const id = setInterval(check, 1000)
			return () => clearInterval(id)
		}, [msg.disappear_at])

		useEffect(() => {
			setEditValue(msg.content)
		}, [msg.content])

		useEffect(() => {
			if (!isMenuOpen && !isReactionsOpen) return
			const handleClickOutside = (event: MouseEvent) => {
				if (
					menuRef.current &&
					!menuRef.current.contains(event.target as Node)
				) {
					setIsMenuOpen(false)
					setIsReactionsOpen(false)
				}
			}
			document.addEventListener('mousedown', handleClickOutside)
			return () => {
				document.removeEventListener('mousedown', handleClickOutside)
			}
		}, [isMenuOpen, isReactionsOpen])

		const getSharedPost = (content: string) => {
			try {
				if (!content || typeof content !== 'string' || !content.trim().startsWith('{')) return null
				const data = JSON.parse(content)
				if (data && data.type === 'shared_post' && data.post) {
					return data.post
				}
			} catch (e) {
				return null
			}
			return null
		}

		const getStickerPayload = (content: string) => {
			try {
				if (!content || typeof content !== 'string' || !content.trim().startsWith('{')) return null
				const data = JSON.parse(content)
				if (data && data.type === 'sticker' && typeof data.url === 'string') {
					return data
				}
			} catch {
				return null
			}
			return null
		}

		const getInvitePayload = (content: string) => {
			try {
				if (
					!content ||
					typeof content !== 'string' ||
					!content.trim().startsWith('{')
				)
					return null
				const data = JSON.parse(content)
				if (
					data &&
					data.type === 'invite' &&
					typeof data.link === 'string' &&
					typeof data.title === 'string'
				) {
					return data as {
						type: 'invite'
						entity?: 'group' | 'channel' | 'community' | 'server'
						title: string
						link: string
						from_name?: string
					}
				}
			} catch {
				return null
			}
			return null
		}

		const sharedPost = msg.is_deleted ? null : getSharedPost(msg.content)
		const stickerPayload = msg.is_deleted ? null : getStickerPayload(msg.content)
		const invitePayload = msg.is_deleted ? null : getInvitePayload(msg.content)

		const getPollPayload = (content: string) => {
			try {
				if (
					!content ||
					typeof content !== 'string' ||
					!content.trim().startsWith('{')
				)
					return null
				const data = JSON.parse(content)
				if (data && data.type === 'poll' && typeof data.poll_id === 'string') {
					return data as { type: 'poll'; poll_id: string }
				}
			} catch {
				return null
			}
			return null
		}

		const pollPayload = msg.is_deleted ? null : getPollPayload(msg.content)

		const storyReplyMatch = !msg.is_deleted && msg.content
			? msg.content.match(/__STORY_REPLY__(\{.*?\})__/)
			: null
		const storyReplyData = storyReplyMatch
			? JSON.parse(storyReplyMatch[1]) as { url: string; type: string; text: string }
			: null
		const userTextForStoryReply = storyReplyMatch
			? msg.content.replace(storyReplyMatch[0], '').trim()
			: null
		const inviteInMessage =
			msg.is_deleted || invitePayload
				? null
				: (() => {
						const trimmed = msg.content.trim()
						if (!trimmed) return null
						const lines = trimmed.split('\n')
						const lastLine = lines[lines.length - 1]?.trim()
						if (!lastLine) return null
						const parsed = parseInviteLink(lastLine)
						if (!parsed) return null
						const intro =
							lines.length > 1
								? lines
										.slice(0, -1)
										.join('\n')
										.trim()
								: undefined
						return { intro, invite: parsed }
					})()
		const displayContent = msg.is_deleted
			? 'Сообщение удалено'
			: hasDisappeared
				? 'Сообщение исчезло'
				: typeof msg.content === 'string' && msg.content.startsWith('e2e:')
					? '🔒 Зашифрованное сообщение'
					: (msg.content || '').replace(/\n*\s*__STORY_REPLY__\{.*?\}__\s*/g, '').trim()
		const reactionEntries = reactions ? Object.entries(reactions) : []
		const attachments = Array.isArray(msg.attachments) ? msg.attachments : []
		const isGroupChat = !!(msg.group_id || msg.channel_id)
		const showAvatar =
			!msg.isOwn &&
			isGroupChat &&
			(groupPosition === 'single' || groupPosition === 'last')
		const showSenderName =
			!msg.isOwn &&
			isGroupChat &&
			(groupPosition === 'single' || groupPosition === 'first')
		const bubbleRadius = getBubbleRadius(msg.isOwn, groupPosition)
		const clusterMargin = getClusterMargin(groupPosition)

		const renderInviteCard = (
			title: string,
			link: string,
			entity?: string,
		) => (
			<div className='rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4'>
				<div className='text-xs uppercase tracking-wider text-emerald-200/80'>
					Приглашение
				</div>
				<div className='mt-1 text-sm font-semibold text-white break-words'>
					{title}
				</div>
				{entity ? (
					<div className='mt-1 text-xs text-emerald-100/70'>{entity}</div>
				) : null}
				<div className='mt-3 flex items-center gap-2'>
					<a
						href={link}
						className='flex-1 rounded-lg bg-emerald-500/80 hover:bg-emerald-500 px-3 py-2 text-center text-sm font-semibold text-white transition-colors'
					>
						Вступить
					</a>
				</div>
			</div>
		)

		const renderFormattedContent = (content: string) =>
			renderRichFormattedContent(content, msg.isOwn)

		const ownBubbleClass = theme?.ownMessageBg || 'chat-bubble-own'

		return (
			<div
				initial={{ opacity: 0, y: 5 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ duration: 0.18, ease: 'easeOut' }}
				className={`flex w-full ${clusterMargin} ${
					msg.isOwn ? 'justify-end pl-6 md:pl-10' : 'justify-start pr-6 md:pr-10'
				} ${isDeleting ? 'message-deleting' : ''} ${
					isMenuOpen || isReactionsOpen ? 'relative z-40' : ''
				}`}
			>
				{!msg.isOwn && isGroupChat && (
					<div className='flex items-end mr-2.5 w-10 shrink-0'>
						{showAvatar ? (
							<img
								src={getAvatarUrl(sender?.avatar_url || msg.sender_avatar)}
								alt={sender?.username || msg.sender_username || 'User'}
								className='w-10 h-10 rounded-full bg-black/30 object-cover ring-1 ring-white/10'
								title={sender?.username || msg.sender_username || 'User'}
							/>
						) : (
							<div className='w-10' aria-hidden />
						)}
					</div>
				)}
				<div
					className={`relative max-w-[min(72%,480px)] px-4 py-2.5 text-[15px] leading-relaxed transition-colors duration-300 ${bubbleRadius} ${
						msg.isOwn ? ownBubbleClass : 'chat-bubble-other'
					} ${
						isSelectionMode
							? isSelected
								? 'ring-2 ring-emerald-400'
								: 'opacity-60'
							: ''
					}`}
				>
					<div
						ref={menuRef}
						className={`absolute -top-2 ${
							msg.isOwn ? 'left-2' : 'right-2'
						} flex items-center gap-1 z-20`}
					>
						{isSelectionMode && (
							<button
								onClick={e => {
									e.stopPropagation()
									onToggleSelect?.(msg)
								}}
								className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-110 ${
									isSelected
										? 'bg-emerald-500 border-emerald-500 shadow-lg shadow-emerald-500/30'
										: 'border-white/60 hover:border-white hover:bg-white/10'
								}`}
								title={isSelected ? 'Отменить выделение' : 'Выбрать'}
							>
								{isSelected ? <Check className='w-4 h-4 text-white' /> : null}
							</button>
						)}
						{isPinned && (
							<span className='text-[10px] rounded-full bg-amber-400/20 px-2 py-0.5 text-amber-300'>
								📌
							</span>
						)}
						<button
							onClick={(e) => {
								e.stopPropagation()
								setIsMenuOpen(o => !o)
							}}
							className='rounded-full bg-black/30 px-2 py-0.5 text-xs text-white/80 hover:text-white hover:bg-black/50 transition z-30 relative'
							aria-label='Меню сообщения'
						>
							<MoreHorizontal className='h-4 w-4' />
						</button>
						{isMenuOpen && (
							<div className='absolute right-0 top-full mt-1 z-50 w-40 rounded-lg border border-white/10 bg-gray-900/95 p-1 shadow-xl'>
								{!msg.isOwn && (
									<button
										onClick={() => {
											onReply?.(msg)
											setIsMenuOpen(false)
										}}
										className='w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10 whitespace-nowrap'
									>
										Ответить
									</button>
								)}
								<button
									onClick={() => {
										onPin?.(msg)
										setIsMenuOpen(false)
									}}
									className='w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10 whitespace-nowrap'
								>
									{isPinned ? 'Открепить' : 'Закрепить'}
								</button>
								{!msg.is_deleted && (
									<button
										onClick={() => {
											onForward?.(msg)
											setIsMenuOpen(false)
										}}
										className='w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10 whitespace-nowrap'
									>
										Переслать
									</button>
								)}
								{msg.isOwn && !msg.is_deleted && (
									<button
										onClick={() => {
											setIsEditing(true)
											setIsMenuOpen(false)
										}}
										className='w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10 whitespace-nowrap'
									>
										Изменить
									</button>
								)}
								<button
									onClick={() => {
										onDelete?.(msg)
										setIsMenuOpen(false)
									}}
									className='w-full rounded-md px-2 py-1.5 text-left text-xs text-rose-200 hover:bg-rose-500/20 whitespace-nowrap'
								>
									Удалить
								</button>
								<button
									onClick={() => {
										setIsReactionsOpen(o => !o)
										setIsMenuOpen(false)
									}}
									className='w-full rounded-md px-2 py-1.5 text-left text-xs text-gray-200 hover:bg-white/10 whitespace-nowrap'
								>
									Реакция
								</button>
								<button
									onClick={() => {
										onToggleSelect?.(msg)
										setIsMenuOpen(false)
									}}
									className='w-full rounded-md px-2 py-1.5 text-left text-xs text-emerald-200 hover:bg-emerald-500/20 whitespace-nowrap'
								>
									{isSelected ? 'Снять выделение' : 'Выбрать'}
								</button>
							</div>
						)}
						{isReactionsOpen && (
							<div className='absolute right-0 top-6 z-10 rounded-lg border border-white/10 bg-gray-900/95 p-2 shadow-xl'>
								<div className='flex items-center gap-2'>
									{REACTIONS.map(emoji => (
										<button
											key={emoji}
											onClick={() => {
												onReact?.(msg, emoji)
												setIsReactionsOpen(false)
											}}
											className='rounded-md px-2 py-1 text-sm hover:bg-white/10'
										>
											<AppleEmoji emoji={emoji} size={18} />
										</button>
									))}
								</div>
							</div>
						)}
					</div>
					{showSenderName && (
						<div
							onClick={(e) => { e.stopPropagation(); onSenderClick?.(msg.sender_id) }}
							className='text-[13px] font-semibold text-indigo-400/90 mb-1 px-0.5 cursor-pointer hover:text-indigo-300 transition-colors'
						>
							{sender?.username || msg.sender_username || 'User'}
						</div>
					)}
					{replyPreview && (
						<div className='mb-2 rounded-xl border-l-2 border-indigo-500/35 bg-black/20 px-3 py-2 text-xs text-gray-300'>
							<div className='font-semibold text-indigo-400/90'>
								{replyPreview.sender}
							</div>
							<div className='truncate text-gray-500'>{replyPreview.text}</div>
						</div>
					)}
					{msg.forwarded_from && (
						<div className='mb-2 flex items-center gap-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 px-3 py-2 text-xs'>
							<Repeat2 className='w-3.5 h-3.5 text-indigo-400 flex-shrink-0' />
							<span className='text-indigo-300/90 truncate'>
								{'Переслано от '}
								<a
									href={`/feed/profile/${msg.forwarded_from.sender_id}`}
									onClick={e => e.stopPropagation()}
									className='font-semibold text-gray-200 hover:text-indigo-300 hover:underline cursor-pointer'
								>
									{msg.forwarded_from.sender_name}
								</a>
								{msg.forwarded_from.chat_name && (
									<span className='text-gray-400'>
										{' в '}
										<span className='font-medium text-gray-300'>
											{msg.forwarded_from.chat_name}
										</span>
									</span>
								)}
							</span>
						</div>
					)}
					{isEditing ? (
						<div className='space-y-2'>
							<textarea
								value={editValue}
								onChange={e => setEditValue(e.target.value)}
								rows={3}
								className='w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-gray-100 focus:outline-none'
							/>
							<div className='flex items-center justify-end gap-2'>
								<button
									onClick={() => {
										setIsEditing(false)
										setEditValue(msg.content)
									}}
									className='rounded-md px-3 py-1 text-xs text-gray-300 hover:bg-white/10'
								>
									Отмена
								</button>
								<button
									onClick={() => {
										const trimmed = editValue.trim()
										if (!trimmed) return
										onEdit?.(msg, trimmed)
										setIsEditing(false)
									}}
									className='rounded-md bg-emerald-500/80 px-3 py-1 text-xs text-white hover:bg-emerald-500'
								>
									Сохранить
								</button>
							</div>
						</div>
					) : msg.type === 'voice' ? (
						<div className='min-w-[240px] py-1'>
							<div className='flex items-center gap-2 mb-2'>
								<Mic className='w-4 h-4 text-blue-400' />
								<span className='text-xs text-blue-400'>
									Голосовое сообщение
								</span>
							</div>
							<audio
								controls
								// voice notes should be stored as attachment; fallback to content if server sent url there
								src={getAttachmentUrl(attachments[0]?.url || msg.content)}
								className='w-full h-8'
							/>
						</div>
					) : msg.type === 'video_note' ? (
						<div className='py-1'>
							<div
								style={{
									width: 200,
									height: 200,
									borderRadius: '50%',
									overflow: 'hidden',
									position: 'relative',
									border: '3px solid rgba(99,102,241,0.6)',
									boxShadow: '0 0 0 1px rgba(99,102,241,0.25)',
								}}
							>
								<video
									src={getAttachmentUrl(msg.content)}
									style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
									controls
									preload='metadata'
									playsInline
									loop={false}
								/>
							</div>
						</div>
					) : invitePayload ? (
						renderInviteCard(
							invitePayload.title,
							invitePayload.link,
							invitePayload.entity === 'group'
								? 'Группа'
								: invitePayload.entity === 'channel'
									? 'Канал'
									: invitePayload.entity === 'community' ||
										  invitePayload.entity === 'server'
										? 'Сервер'
										: undefined,
						)
					) : inviteInMessage ? (
						<div className='space-y-2'>
							{inviteInMessage.intro ? (
								<div className='relative min-w-[52px] pr-14 pb-0.5'>
									<div className='space-y-1.5'>
										{renderFormattedContent(inviteInMessage.intro)}
									</div>
								</div>
							) : null}
							{renderInviteCard(
								`Присоединиться: ${inviteEntityLabel(inviteInMessage.invite.entity)}`,
								inviteInMessage.invite.path,
								inviteEntityLabel(inviteInMessage.invite.entity),
							)}
						</div>
					) : stickerPayload ? (
						<img
							src={getAttachmentUrl(stickerPayload.url)}
							alt='sticker'
							className='w-full max-w-[240px] rounded-lg object-contain'
						/>
					) : pollPayload ? (
						<PollCard pollId={pollPayload.poll_id} currentUserId={currentUserId} />
					) : sharedPost ? (
						<>
							<div
								onClick={() => setIsDetailsOpen(true)}
								className='flex cursor-pointer flex-col gap-2 rounded-lg bg-black/20 p-3 transition-colors hover:bg-black/30'
							>
								<div className='flex items-center gap-2 border-b border-white/10 pb-2'>
									{sharedPost.author_avatar ? (
										<img
											src={getAttachmentUrl(sharedPost.author_avatar)}
											alt={sharedPost.author}
											className='h-6 w-6 rounded-full object-cover'
										/>
									) : (
										<div className='flex h-6 w-6 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white'>
											{sharedPost.author[0]?.toUpperCase()}
										</div>
									)}
									<span className='text-xs font-semibold text-white/90'>
										{sharedPost.author}
									</span>
									<span className='ml-auto text-[10px] text-white/50'>
										Пост
									</span>
								</div>
								<p className='line-clamp-4 text-sm text-white/90'>
									{sharedPost.text}
								</p>
								{sharedPost.image && (
									<img
										src={getAttachmentUrl(sharedPost.image)}
										alt='Shared content'
										className='mt-1 max-h-48 w-full rounded-md object-cover'
									/>
								)}
							</div>
							{isDetailsOpen && (
								<PostDetailsModal
									postId={sharedPost.id}
									isOpen={isDetailsOpen}
									onClose={() => setIsDetailsOpen(false)}
								/>
							)}
						</>
					) : storyReplyData ? (
						<div className='space-y-2'>
							<div className='relative w-[80px] h-[80px] rounded-xl overflow-hidden bg-black/30 border border-white/10'>
								{storyReplyData.type === 'video' ? (
									<video
										src={getAttachmentUrl(storyReplyData.url)}
										className='w-full h-full object-cover'
										muted
										preload='metadata'
									/>
								) : (
									<img
										src={getAttachmentUrl(storyReplyData.url)}
										alt=''
										className='w-full h-full object-cover'
									/>
								)}
								{storyReplyData.type === 'video' && (
									<div className='absolute inset-0 flex items-center justify-center bg-black/30'>
										<span className='text-white text-lg'>▶</span>
									</div>
								)}
							</div>
							{userTextForStoryReply && (
								<div className='relative min-w-[52px] pr-14 pb-0.5'>
									<div className='space-y-1.5'>
										{renderFormattedContent(userTextForStoryReply)}
									</div>
								</div>
							)}
							<div
								className={`text-[11px] mt-1 flex items-center gap-1 justify-end ${
									msg.isOwn
										? 'text-white/60'
										: 'text-[color:var(--app-muted)]'
								}`}
							>
								{formatMskTime(
									(msg as Message & { created_at?: string }).timestamp ||
										(msg as Message & { created_at?: string }).created_at ||
										'',
								)}
								{msg.is_edited && (
									<span className='ml-1 text-[10px] opacity-60'>ред.</span>
								)}
								{msg.isOwn && (
									<span className='inline-flex align-middle ml-1'>
										{msg.is_read ? (
											<CheckCheck className='h-3.5 w-3.5 text-indigo-300/80' />
										) : (
											<Check className='h-3.5 w-3.5 text-[color:var(--app-fg)]/45' />
										)}
									</span>
								)}
							</div>
						</div>
					) : msg.bot_photo ? (
						<div className='space-y-2'>
							{(() => {
								const photos = Array.isArray(msg.bot_photo) ? msg.bot_photo : [msg.bot_photo]
								return photos.map((p: any, i: number) => {
									const url = typeof p === 'string' ? p : (p?.url || p?.file_id || '')
									return url ? (
										<img key={i} src={getAttachmentUrl(url)} alt='photo' className='max-w-full rounded-lg object-cover max-h-[400px]' />
									) : null
								})
							})()}
							{msg.bot_caption && (
								<div className='text-sm'>{renderFormattedContent(msg.bot_caption)}</div>
							)}
						</div>
					) : msg.bot_video ? (
						<div className='space-y-2'>
							{(() => {
								const v = msg.bot_video
								const url = typeof v === 'string' ? v : (v?.url || v?.file_id || '')
								return url ? <VideoPlayer src={url} /> : null
							})()}
							{msg.bot_caption && (
								<div className='text-sm'>{renderFormattedContent(msg.bot_caption)}</div>
							)}
						</div>
					) : msg.bot_document ? (
						<div className='space-y-2'>
							{(() => {
								const doc = msg.bot_document
								const url = doc?.url || doc?.file_id || ''
								const name = doc?.file_name || 'Документ'
								const mime = doc?.mime_type || ''
								const isImage = mime.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|bmp|svg)$/i.test(name)
								const isVideo = mime.startsWith('video/') || /\.(mp4|mov|webm|m4v|avi|mkv)$/i.test(name)
								const isAudio = mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(name)
								if (isImage && url) return <img src={getAttachmentUrl(url)} alt={name} className='max-w-full rounded-lg object-cover max-h-[400px]' />
								if (isVideo && url) return <VideoPlayer src={url} />
								if (isAudio && url) return <AudioPlayer src={url} />
								return url ? (
									<a href={getAttachmentUrl(url)} target='_blank' rel='noreferrer'
										className='flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-200 hover:bg-black/30 transition-colors'>
										<span className='truncate'>{name}</span>
										<span className='ml-3 text-xs text-gray-400'>{mime.split('/').pop()?.toUpperCase() || 'FILE'}</span>
									</a>
								) : null
							})()}
							{msg.bot_caption && (
								<div className='text-sm'>{renderFormattedContent(msg.bot_caption)}</div>
							)}
						</div>
					) : msg.bot_audio ? (
						<div className='min-w-[240px] py-1'>
							<div className='flex items-center gap-2 mb-2'>
								<LuMusic className='w-4 h-4 text-purple-400' />
								<span className='text-xs text-purple-400'>
									{msg.bot_audio?.title || msg.bot_audio?.performer || 'Аудио'}
								</span>
							</div>
							<audio controls src={getAttachmentUrl(msg.bot_audio?.url || msg.bot_audio?.file_id || '')} className='w-full h-8' />
						</div>
					) : msg.bot_voice ? (
						<div className='min-w-[240px] py-1'>
							<div className='flex items-center gap-2 mb-2'>
								<Mic className='w-4 h-4 text-blue-400' />
								<span className='text-xs text-blue-400'>
									Голосовое сообщение
									{msg.bot_voice?.duration ? ` (${msg.bot_voice.duration}с)` : ''}
								</span>
							</div>
							<audio controls src={getAttachmentUrl(msg.bot_voice?.url || msg.bot_voice?.file_id || '')} className='w-full h-8' />
						</div>
					) : msg.bot_video_note ? (
						<div className='py-1'>
							<div style={{ width: 200, height: 200, borderRadius: '50%', overflow: 'hidden', position: 'relative', border: '3px solid rgba(99,102,241,0.6)', boxShadow: '0 0 0 1px rgba(99,102,241,0.25)' }}>
								<video src={getAttachmentUrl(msg.bot_video_note?.url || msg.bot_video_note?.file_id || '')}
									style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
									controls preload='metadata' playsInline />
							</div>
						</div>
					) : msg.bot_sticker ? (
						<div>
							{(() => {
								const s = msg.bot_sticker
								const url = s?.url || s?.file_id || ''
								return url ? (
									<img src={getAttachmentUrl(url)} alt={s?.emoji || 'sticker'} className='max-w-[200px] max-h-[200px] object-contain' />
								) : (
									<span className='text-4xl'>{s?.emoji || '🏷️'}</span>
								)
							})()}
						</div>
					) : msg.bot_location ? (
						<div className='py-1'>
							<div className='flex items-center gap-2 mb-1'>
								<LuMapPin className='w-4 h-4 text-red-400' />
								<span className='text-sm text-red-400 font-medium'>Местоположение</span>
							</div>
							<a href={`https://maps.google.com/?q=${msg.bot_location.latitude},${msg.bot_location.longitude}`}
								target='_blank' rel='noreferrer'
								className='text-xs text-indigo-300 hover:text-indigo-200 underline'>
								{msg.bot_location.latitude.toFixed(6)}, {msg.bot_location.longitude.toFixed(6)}
							</a>
						</div>
					) : msg.bot_venue ? (
						<div className='py-1'>
							<div className='flex items-center gap-2 mb-1'>
								<LuMapPin className='w-4 h-4 text-orange-400' />
								<span className='text-sm text-orange-400 font-medium'>{msg.bot_venue.title}</span>
							</div>
							{msg.bot_venue.address && (
								<p className='text-xs text-gray-400'>{msg.bot_venue.address}</p>
							)}
						</div>
					) : msg.bot_contact ? (
						<div className='py-1'>
							<div className='flex items-center gap-2 mb-1'>
								<LuUser className='w-4 h-4 text-green-400' />
								<span className='text-sm text-green-400 font-medium'>
									{msg.bot_contact.first_name}{msg.bot_contact.last_name ? ` ${msg.bot_contact.last_name}` : ''}
								</span>
							</div>
							{msg.bot_contact.phone_number && (
								<p className='text-xs text-gray-400'>📞 {msg.bot_contact.phone_number}</p>
							)}
							{msg.bot_contact.user_id && (
								<a href={`/feed/profile/${msg.bot_contact.user_id}`} className='text-xs text-indigo-300 hover:underline'>
									Открыть профиль
								</a>
							)}
						</div>
					) : msg.bot_poll ? (
						<div className='py-1'>
							<div className='flex items-center gap-2 mb-2'>
								<LuChartNoAxesColumn className='w-4 h-4 text-yellow-400' />
								<span className='text-sm text-yellow-400 font-medium'>Опрос</span>
							</div>
							<p className='text-sm font-medium text-white mb-2'>{msg.bot_poll.question}</p>
							<div className='space-y-1.5'>
								{(msg.bot_poll.options || []).map((opt: any, i: number) => {
									const total = msg.bot_poll.total_voter_count || 1
									const pct = Math.round(((opt.voter_count || 0) / total) * 100)
									return (
										<div key={i} className='relative rounded-lg overflow-hidden bg-black/20 border border-white/10'>
											<div className='absolute inset-0 bg-indigo-500/20' style={{ width: `${pct}%` }} />
											<div className='relative flex items-center justify-between px-3 py-1.5'>
												<span className='text-xs text-white/90'>{opt.text}</span>
												<span className='text-xs text-gray-400'>{pct}%</span>
											</div>
										</div>
									)
								})}
							</div>
							<p className='text-[10px] text-gray-500 mt-1.5'>
								{msg.bot_poll.total_voter_count || 0} голосов
								{msg.bot_poll.is_anonymous ? ' · Анонимный' : ''}
							</p>
						</div>
					) : msg.bot_dice ? (
						<div className='py-1 text-center'>
							<span className='text-4xl'>{msg.bot_dice.emoji || '🎲'}</span>
							<div className='text-xs text-gray-400 mt-1'>Выпало: {msg.bot_dice.value}</div>
						</div>
					) : (
						<div className='relative min-w-[52px]'>
							<div className='space-y-1.5'>
								{renderFormattedContent(displayContent)}
							</div>
						</div>
					)}
					{attachments.length > 0 && msg.type !== 'video_note' && (
						<div className='mt-2 space-y-2'>
							{attachments.map(a => {
								const ext = (a.ext || '').toLowerCase()
								const isImage =
									ext === 'png' ||
									ext === 'jpg' ||
									ext === 'jpeg' ||
									ext === 'gif' ||
									ext === 'webp' ||
									ext === 'bmp' ||
									ext === 'svg'
								const isVideo =
									ext === 'mp4' ||
									ext === 'mov' ||
									ext === 'webm' ||
									ext === 'm4v' ||
									ext === 'avi' ||
									ext === 'mkv'
								const isAudio =
									ext === 'mp3' ||
									ext === 'wav' ||
									ext === 'ogg' ||
									ext === 'm4a' ||
									ext === 'webm'

								if (isImage) {
									const imgUrl = getAttachmentUrl(a.url)
									if (isStickerUrl(imgUrl) || isStickerUrl(a.url)) {
										return (
											<img
												key={a.url}
												src={imgUrl}
												alt={a.name}
												className='w-36 h-36 object-contain filter drop-shadow-xl hover:scale-105 transition-transform duration-200'
											/>
										)
									}
									return (
										<img
											key={a.url}
											src={imgUrl}
											alt={a.name}
											className='w-full rounded-lg object-cover'
										/>
									)
								}
								if (isVideo) {
									const vidUrl = getAttachmentUrl(a.url)
									if (a.name?.toLowerCase().includes('gif') || vidUrl.includes('faststart') || isGifUrl(a.url)) {
										return (
											<video
												key={a.url}
												src={vidUrl}
												autoPlay
												loop
												muted
												playsInline
												className='rounded-xl max-w-xs max-h-72 object-cover shadow-lg'
											/>
										)
									}
									return <VideoPlayer key={a.url} src={a.url} />
								}
								if (isAudio) {
									return <AudioPlayer key={a.url} src={a.url} />
								}
								return (
									<a
										key={a.url}
										href={getAttachmentUrl(a.url)}
										target='_blank'
										rel='noreferrer'
										className='flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-gray-200 hover:bg-black/30 transition-colors'
									>
										<span className='truncate'>{a.name}</span>
										<span className='ml-3 text-xs text-gray-400'>
											{a.ext ? a.ext.toUpperCase() : 'FILE'}
										</span>
									</a>
								)
							})}
						</div>
					)}

					{msg.game?.embed_url && (
						<div className='mt-2 w-full max-w-md rounded-xl overflow-hidden border border-white/10 bg-black/40'>
							<div className='flex items-center gap-3 p-3'>
								<div className='flex-1 min-w-0'>
									{msg.game.title && (
										<p className='text-sm font-medium text-white truncate'>
											{msg.game.title}
										</p>
									)}
									<p className='text-xs text-gray-400'>HTML5-игра</p>
								</div>
								<button
									type='button'
									onClick={() => onBotGamePlay?.(msg.game!)}
									className='shrink-0 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-medium text-white'
								>
									Играть
								</button>
							</div>
							{msg.game.download_url && (
								<div className='px-3 py-2 border-t border-white/10'>
									<a
										href={msg.game.download_url}
										className='text-xs text-indigo-300 hover:text-indigo-200'
									>
										Скачать игру (ZIP)
									</a>
								</div>
							)}
						</div>
					)}

					{Array.isArray(msg.reply_markup?.inline_keyboard) && (
						<div className='mt-3 flex flex-col gap-2'>
							{msg.reply_markup.inline_keyboard.map((row, rowIndex) => (
								<div key={rowIndex} className='flex flex-wrap gap-2'>
									{(Array.isArray(row) ? row : []).map((btn, btnIndex) => (
										<button
											key={`${rowIndex}-${btnIndex}`}
											onClick={async (e) => {
												e.preventDefault()
												e.stopPropagation()
												const modalId =
													typeof btn.modal === 'string'
														? btn.modal
														: typeof btn.callback_data === 'string' &&
															  btn.callback_data.startsWith('ui:')
															? btn.callback_data.slice(3)
															: null
												if (modalId) {
													onBotModal?.(msg.sender_id, modalId)
													return
												}
												if (btn.url) {
													window.open(btn.url, '_blank')
													return
												}
												console.log('[Button] Clicked:', btn.callback_data, btn.text)
												if (btn.callback_data) {
													// Send callback to backend via frontend proxy
													try {
														const token = localStorage.getItem('access_token')
														const userData = localStorage.getItem('user')
														let user: { id?: string } | null = null
														try {
															user = userData ? JSON.parse(userData) : null
														} catch {
															user = null
														}
														const url = `/api/public/v1/bots/${msg.sender_id}/callback`
														console.log('[Button] Sending to:', url)
														const response = await fetch(url, {
															method: 'POST',
															headers: {
																'Content-Type': 'application/json',
															},
															body: JSON.stringify({
																message_id: msg.id,
																data: btn.callback_data,
																user_id: user?.id || 'unknown',
															}),
														})
														const callbackText = await response.text()
														console.log('[Button] Response:', response.status, callbackText)
														if (response.ok && currentUserId) {
															const token =
																botAccessToken ||
																localStorage.getItem('access_token') ||
																undefined
															const outboxRes = await fetch(
																`/api/v1/bots?bot_id=${msg.sender_id}&chat_id=${currentUserId}&mode=outbox`,
																token
																	? {
																			headers: {
																				Authorization: `Bearer ${token}`,
																			},
																		}
																	: undefined,
															)
															if (outboxRes.ok) {
																const outboxData = await outboxRes.json().catch(() => ({}))
																const items = Array.isArray(outboxData?.items) ? outboxData.items : []
																if (items.length) {
																	onBotOutboxItems?.(msg.sender_id, items)
																}
															}
														}
													} catch (e) {
														console.error('[Button] Error:', e)
													}
												}
											}}
											className='w-full bg-blue-600/80 hover:bg-blue-500 text-white font-medium py-2.5 px-4 rounded-lg transition-colors text-sm cursor-pointer'
											type='button'
										>
											{btn.text}
										</button>
									))}
								</div>
							))}
						</div>
					)}

					{reactionEntries.length > 0 && (
						<div className='mt-2 flex flex-wrap gap-1'>
							{reactionEntries.map(([emoji, info]) => (
								<button
									key={emoji}
									onClick={() => onReact?.(msg, emoji)}
									className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
										info.reacted
											? 'border-emerald-400/60 bg-emerald-400/20 text-emerald-200'
											: 'border-white/10 bg-black/20 text-gray-200 hover:bg-black/30'
									}`}
								>
									<AppleEmoji emoji={emoji} size={16} />
									<span>{info.count}</span>
								</button>
							))}
						</div>
					)}
					<div
						className={`text-[11px] mt-1 flex items-center gap-1 justify-end ${
							msg.isOwn
								? 'text-white/60'
								: 'text-[color:var(--app-muted)]'
						}`}
					>
						{formatMskTime(
							(msg as Message & { created_at?: string }).timestamp ||
								(msg as Message & { created_at?: string }).created_at ||
								'',
						)}
						{msg.is_edited && (
							<span className='ml-1 text-[10px] opacity-60'>ред.</span>
						)}
						{msg.disappear_at && !hasDisappeared && !msg.is_deleted && (
							<span className='ml-1 inline-flex items-center gap-0.5 text-[10px] text-amber-400/80'>
								<TimerIcon className='h-3 w-3' />
								{(() => {
									const remaining = Math.max(0, new Date(msg.disappear_at).getTime() - Date.now())
									if (remaining <= 0) return null
									const mins = Math.floor(remaining / 60000)
									const hrs = Math.floor(mins / 60)
									const days = Math.floor(hrs / 24)
									if (days > 0) return `${days}д`
									if (hrs > 0) return `${hrs}ч`
									return `${mins}м`
								})()}
							</span>
						)}
						{msg.isOwn && (
							<span className='inline-flex'>
								{msg.is_read ? (
									<CheckCheck className='h-3.5 w-3.5 text-indigo-300/80' />
								) : (
									<Check className='h-3.5 w-3.5 text-[color:var(--app-fg)]/45' />
								)}
							</span>
						)}
					</div>
				</div>
			</div>
		)
	},
)

MessageBubble.displayName = 'MessageBubble'

export default MessageBubble
