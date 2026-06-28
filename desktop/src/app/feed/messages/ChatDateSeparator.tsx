'use client'

import { motion } from 'framer-motion'
import { memo } from 'react'

interface ChatDateSeparatorProps {
	label: string
}

const ChatDateSeparator = memo(({ label }: ChatDateSeparatorProps) => (
	<motion.div
		initial={{ opacity: 0, y: -3 }}
		animate={{ opacity: 1, y: 0 }}
		transition={{ duration: 0.2, ease: 'easeOut' }}
		className='flex justify-center py-3 my-2'
	>
		<span className='chat-date-pill'>{label}</span>
	</motion.div>
))

ChatDateSeparator.displayName = 'ChatDateSeparator'

export default ChatDateSeparator
