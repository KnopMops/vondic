'use client'

import AudioPlayer from '@/components/social/AudioPlayer'
import PostDetailsModal from '@/components/social/PostDetailsModal'
import VideoPlayer from '@/components/social/VideoPlayer'
import { AppleEmoji } from '@/components/ui/AppleEmoji'
import { Attachment, User } from '@/lib/types'
import { formatMskTime, getAttachmentUrl, getAvatarUrl } from '@/lib/utils'
import { memo, useEffect, useRef, useState } from 'react'

interface Message {
	id: string
	sender_id: string
	content: string
	timestamp: string
	isOwn: boolean
	is_read?: boolean
	type?: 'text' | 'voice'
	channel_id?: string
	group_id?: string
	reply_to?: string
	attachments?: Attachment[]
	is_deleted?: boolean
	forwarded_from?: {
		sender_id: string
		sender_name: string
		sender_avatar?: string | null
	}
	reply_markup?: {
		inline_keyboard: Array<Array<{
			text: string
			callback_data?: string
			url?: string
		}>>
	}
}

interface MessageBubbleProps {
	msg: Message
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
}

const REACTIONS = ['❤️', '🔥', '😂', '👍', '😮', '😢']

const MessageBubble = memo(
	({
		msg,
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
	}: MessageBubbleProps) => {
		const [isDetailsOpen, setIsDetailsOpen] = useState(false)
		const [isMenuOpen, setIsMenuOpen] = useState(false)
		const [isReactionsOpen, setIsReactionsOpen] = useState(false)
		const [isEditing, setIsEditing] = useState(false)
		const [editValue, setEditValue] = useState(msg.content)
		const menuRef = useRef<HTMLDivElement | null>(null)

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

		const sharedPost = msg.is_deleted ? null : getSharedPost(msg.content)
		const stickerPayload = msg.is_deleted ? null : getStickerPayload(msg.content)
		const displayContent = msg.is_deleted ? 'Сообщение удалено' : msg.content
		const reactionEntries = reactions ? Object.entries(reactions) : []
		const attachments = Array.isArray(msg.attachments) ? msg.attachments : []

		const renderInline = (text: string, keyPrefix: string) => {
			const parts = text.split('`')
			return parts.map((part, index) =>
				index % 2 === 1 ? (
					<code
						key={`${keyPrefix}-code-${index}`}
						className='rounded bg-black/30 px-1 text-[0.9em] font-mono text-emerald-200'
					>
						{part}
					</code>
				) : (
					<span key={`${keyPrefix}-text-${index}`}>{part}</span>
				),
			)
		}

		const renderTextBlock = (text: string, keyPrefix: string) => {
			const lines = text.split('\n')
			return (
				<div key={keyPrefix} className='break-words leading-relaxed'>
					{lines.map((line, index) => (
						<span key={`${keyPrefix}-line-${index}`}>
							{renderInline(line, `${keyPrefix}-inline-${index}`)}
							{index < lines.length - 1 ? <br /> : null}
						</span>
					))}
				</div>
			)
		}

		const renderFormattedContent = (content: string) => {
			const blocks = content.split('```')
			return blocks.map((block, index) => {
				if (index % 2 === 1) {
					const firstNewline = block.indexOf('\n')
					const firstLine =
						firstNewline === -1
							? block.trim()
							: block.slice(0, firstNewline).trim()
					const hasLang =
						firstLine.length > 0 &&
						!firstLine.includes(' ') &&
						firstNewline !== -1
					const language = hasLang ? firstLine : ''
					const code = hasLang ? block.slice(firstNewline + 1) : block
					const codeText = code.replace(/\n$/, '')
					return (
						<div
							key={`code-${index}`}
							className='my-2 overflow-hidden rounded-lg border border-white/10 bg-black/30'
						>
							{language ? (
								<div className='border-b border-white/10 bg-black/40 px-3 py-1 text-[10px] uppercase tracking-wider text-gray-400'>
									{language}
								</div>
							) : null}
							<pre className='overflow-x-auto p-3 text-xs md:text-sm'>
								<code className='font-mono text-emerald-200'>{codeText}</code>
							</pre>
						</div>
					)
				}
				return block.trim() ? renderTextBlock(block, `text-${index}`) : null
			})
		}

		return (
			<div
				className={`flex w-full mb-2 transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2 ${
					msg.isOwn ? 'justify-end' : 'justify-start'
				} ${isDeleting ? 'message-deleting' : ''}`}
			>
				{!msg.isOwn && sender && (
					<div className='flex items-end mr-2'>
						<img
							src={getAvatarUrl(sender.avatar_url)}
							alt={sender.username}
							className='w-8 h-8 rounded-full bg-gray-800 object-cover'
							title={sender.username}
						/>
					</div>
				)}
				<div
					className={`relative max-w-[75%] px-5 py-3 shadow-md text-sm md:text-base transition-colors duration-500 ${
						msg.isOwn
							? `${
									theme?.ownMessageBg ||
									'bg-gradient-to-br from-blue-600 to-blue-700'
								} text-white rounded-2xl rounded-tr-sm`
							: 'bg-gray-800 border border-gray-700 text-gray-100 rounded-2xl rounded-tl-sm'
					} ${
						isSelectionMode && msg.isOwn
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
						{isSelectionMode && msg.isOwn && (
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
								{isSelected && (
									<svg
										className='w-4 h-4 text-white'
										viewBox='0 0 24 24'
										fill='none'
										stroke='currentColor'
										strokeWidth='3'
										strokeLinecap='round'
										strokeLinejoin='round'
									>
										<polyline points='20 6 9 17 4 12'></polyline>
									</svg>
								)}
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
						>
							⋯
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
					{replyPreview && (
						<div className='mb-2 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-200'>
							<div className='font-semibold text-gray-300'>
								{replyPreview.sender}
							</div>
							<div className='truncate text-gray-400'>{replyPreview.text}</div>
						</div>
					)}
					{msg.forwarded_from && (
						<div className='mb-2 flex items-center gap-2 rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-xs'>
							<svg
								className='w-3.5 h-3.5 text-blue-400 flex-shrink-0'
								viewBox='0 0 24 24'
								fill='none'
								stroke='currentColor'
								strokeWidth='2'
							>
								<polyline points='17 1 21 5 17 9'></polyline>
								<path d='M3 11V9a4 4 0 0 1 4-4h14'></path>
								<polyline points='7 23 3 19 7 15'></polyline>
								<path d='M21 13v2a4 4 0 0 1-4 4H3'></path>
							</svg>
							<span className='text-blue-300 truncate'>
								Переслано от <span className='font-semibold text-white'>{msg.forwarded_from.sender_name}</span>
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
								<svg
									className='w-4 h-4 text-blue-400'
									viewBox='0 0 24 24'
									fill='none'
									stroke='currentColor'
									strokeWidth='2'
								>
									<path d='M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z'></path>
									<path d='M19 10v2a7 7 0 0 1-14 0v-2'></path>
									<line x1='12' y1='19' x2='12' y2='23'></line>
									<line x1='8' y1='23' x2='16' y2='23'></line>
								</svg>
								<span className='text-xs text-blue-400'>
									Голосовое сообщение
								</span>
							</div>
							<audio
								controls
								src={getAttachmentUrl(msg.content)}
								className='w-full h-8'
							/>
						</div>
					) : stickerPayload ? (
						<img
							src={getAttachmentUrl(stickerPayload.url)}
							alt='sticker'
							className='w-full max-w-[240px] rounded-lg object-contain'
						/>
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
					) : (
						<div className='space-y-2'>
							{renderFormattedContent(displayContent)}
						</div>
					)}
					{attachments.length > 0 && (
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
									return (
										<img
											key={a.url}
											src={getAttachmentUrl(a.url)}
											alt={a.name}
											className='w-full rounded-lg object-cover'
										/>
									)
								}
								if (isVideo) {
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
												if (btn.url) {
													window.open(btn.url, '_blank')
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
						className={`text-[10px] mt-1 flex items-center gap-1 ${
							msg.isOwn
								? 'justify-end text-blue-200/80'
								: 'justify-start text-gray-400'
						}`}
					>
						{!msg.isOwn && sender && (
							<span className='font-bold text-gray-300 mr-2'>
								{sender.username}
							</span>
						)}
						{formatMskTime((msg as any).timestamp || (msg as any).created_at || '')}
						{msg.isOwn && (
							<div className='flex items-center'>
								{msg.is_read ? (
									// Read: Double Blue Ticks
									<div className='flex items-center'>
										<svg
											className='h-3 w-3 text-blue-400'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='3'
											strokeLinecap='round'
											strokeLinejoin='round'
										>
											<polyline points='20 6 9 17 4 12'></polyline>
										</svg>
										<svg
											className='-ml-1.5 h-3 w-3 text-blue-400'
											viewBox='0 0 24 24'
											fill='none'
											stroke='currentColor'
											strokeWidth='3'
											strokeLinecap='round'
											strokeLinejoin='round'
										>
											<polyline points='20 6 9 17 4 12'></polyline>
										</svg>
									</div>
								) : (
									// Sent: Single Gray/White Tick
									<svg
										className='h-3 w-3 text-white/70'
										viewBox='0 0 24 24'
										fill='none'
										stroke='currentColor'
										strokeWidth='3'
										strokeLinecap='round'
										strokeLinejoin='round'
									>
										<polyline points='20 6 9 17 4 12'></polyline>
									</svg>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		)
	},
)

MessageBubble.displayName = 'MessageBubble'

export default MessageBubble
