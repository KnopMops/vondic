'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { FiDownload, FiX } from 'react-icons/fi'

type Props = {
	isOpen: boolean
	botId: string
	gameId: string
	title?: string
	onClose: () => void
}

export default function BotGamePlayerModal({
	isOpen,
	botId,
	gameId,
	title,
	onClose,
}: Props) {
	const embedSrc = `/api/v1/bots/${botId}/games/${gameId}/embed`

	return (
		<AnimatePresence>
			{isOpen && botId && gameId && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-[100002] flex flex-col bg-black/95'
				>
					<div className='flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0'>
						<h2 className='text-white font-semibold truncate'>
							{title || 'Игра'}
						</h2>
						<div className='flex items-center gap-2'>
							<a
								href={`/api/v1/bots/${botId}/games/${gameId}/download`}
								className='rounded-lg border border-white/15 px-3 py-1.5 text-xs text-gray-200 hover:bg-white/10 flex items-center gap-1'
							>
								<FiDownload className='w-4 h-4' />
								Скачать
							</a>
							<button
								type='button'
								onClick={onClose}
								className='p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/10'
							>
								<FiX className='w-5 h-5' />
							</button>
						</div>
					</div>
					<div className='flex-1 min-h-0 bg-black'>
						<iframe
							title={title || 'Bot game'}
							src={embedSrc}
							className='w-full h-full border-0'
							sandbox='allow-scripts allow-same-origin allow-pointer-lock'
							allow='fullscreen'
						/>
					</div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
