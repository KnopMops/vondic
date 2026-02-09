import PostDetailsModal from '@/components/social/PostDetailsModal'
import { Message } from '@/lib/hooks/useChat'
import { memo, useState } from 'react'

interface MessageBubbleProps {
	msg: Message
	theme?: {
		ownMessageBg: string
	}
}

const MessageBubble = memo(({ msg, theme }: MessageBubbleProps) => {
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
				{sharedPost ? (
					<>
						<div
							onClick={() => setIsDetailsOpen(true)}
							className='flex cursor-pointer flex-col gap-2 rounded-lg bg-black/20 p-3 transition-colors hover:bg-black/30'
						>
							<div className='flex items-center gap-2 border-b border-white/10 pb-2'>
								{sharedPost.author_avatar ? (
									<img
										src={sharedPost.author_avatar}
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
									src={sharedPost.image}
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
