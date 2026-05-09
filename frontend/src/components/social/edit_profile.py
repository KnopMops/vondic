import re

with open('UserProfile.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Replace the h1 tag with username to add online status
old_h1 = """<h1 className='text-3xl font-bold text-white'>
								{user.username}
								{Boolean(user.premium) && (
									<span className='ml-2 text-amber-400'>★</span>
								)}
							</h1>"""

new_h1 = """<h1 className='text-3xl font-bold text-white flex items-center gap-2 flex-wrap'>
								{user.username}
								{Boolean(user.premium) && (
									<span className='text-amber-400'>★</span>
								)}
								{user.socket_id && (
									<span className='inline-flex items-center text-xs font-normal text-green-400'>
										<span className='w-2 h-2 bg-green-400 rounded-full mr-1 animate-pulse'></span>
										в сети
									</span>
								)}
								{!user.socket_id && (
									<span className='inline-flex items-center text-xs font-normal text-gray-500'>
										<span className='w-2 h-2 bg-gray-500 rounded-full mr-1'></span>
										в мессенджере
									</span>
								)}
							</h1>"""

content = content.replace(old_h1, new_h1)

# 2. Replace the Edit button section with buttons container
old_buttons = """{isMe && (
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setIsEditModalOpen(true)}
								className='rounded-xl bg-white/10 border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
							>
								Редактировать
							</motion.button>
						)}"""

new_buttons = """<div className='flex items-center gap-2 flex-wrap'>
							{isMe && (
								<motion.button
									whileHover={{ scale: 1.05 }}
									whileTap={{ scale: 0.95 }}
									onClick={() => setIsEditModalOpen(true)}
									className='rounded-xl bg-white/10 border border-white/20 px-6 py-2 text-sm font-semibold text-white hover:bg-white/20 backdrop-blur-md transition-all shadow-lg'
								>
									Редактировать
								</motion.button>
							)}
							{!isMe && (
								<Link href={`/messages/${user.id}`}>
									<motion.button
										whileHover={{ scale: 1.05 }}
										whileTap={{ scale: 0.95 }}
										className='rounded-xl bg-blue-500/20 border border-blue-400/30 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/30 backdrop-blur-md transition-all shadow-lg flex items-center gap-2'
									>
										<MessageSquare size={16} />
										Написать
									</motion.button>
								</Link>
							)}
							<motion.button
								whileHover={{ scale: 1.05 }}
								whileTap={{ scale: 0.95 }}
								onClick={() => setIsShareModalOpen(true)}
								className='rounded-xl bg-purple-500/20 border border-purple-400/30 px-4 py-2 text-sm font-semibold text-purple-400 hover:bg-purple-500/30 backdrop-blur-md transition-all shadow-lg flex items-center gap-2'
							>
								<Share2 size={16} />
								Поделиться
							</motion.button>
						</div>"""

content = content.replace(old_buttons, new_buttons)

with open('UserProfile.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('File updated successfully!')
