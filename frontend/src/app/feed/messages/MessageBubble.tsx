import PostDetailsModal from '@/components/social/PostDetailsModal'
import { User } from '@/lib/types'
import { getAttachmentUrl } from '@/lib/utils'
import { memo, useState } from 'react'

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
}

interface MessageBubbleProps {
	msg: Message
	theme?: {
		ownMessageBg: string
	}
	sender?: User
}

const MessageBubble = memo(({ msg, theme, sender }: MessageBubbleProps) => {
	const [isDetailsOpen, setIsDetailsOpen] = useState(false)

	const getSharedPost = (content: string) => {
		try {
			if (!content.trim().startsWith('{')) return null
			const data = JSON.parse(content)
			if (data && data.type === 'shared_post' && data.post) {
				return data.post
			}
		} catch (e) {
			return null
		}
		return null
	}

	const sharedPost = getSharedPost(msg.content)

	return (
		<div
			className={`flex w-full mb-2 transition-all duration-300 ease-out animate-in fade-in slide-in-from-bottom-2 ${
				msg.isOwn ? 'justify-end' : 'justify-start'
			}`}
		>
			{!msg.isOwn && sender && (
				<div className='flex items-end mr-2'>
					<img
						src={getAttachmentUrl(sender.avatar_url) || '/default-avatar.png'}
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
				}`}
			>
				{msg.type === 'voice' ? (
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
							<span className='text-xs text-blue-400'>Голосовое сообщение</span>
						</div>
						<audio
							controls
							src={getAttachmentUrl(msg.content)}
							className='w-full h-8'
						/>
					</div>
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
								<span className='ml-auto text-[10px] text-white/50'>Пост</span>
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
					<div className='break-words leading-relaxed'>{msg.content}</div>
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
					{new Date(msg.timestamp).toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit',
					})}
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
})

MessageBubble.displayName = 'MessageBubble'

export default MessageBubble
