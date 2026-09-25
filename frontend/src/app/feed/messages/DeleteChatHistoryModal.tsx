'use client'

import { motion, AnimatePresence } from 'framer-motion'

export type DeleteHistoryScope = 'for_me' | 'for_all'

type Props = {
	isOpen: boolean
	isLoading?: boolean
	chatLabel?: string
	canDeleteForAll?: boolean
	onClose: () => void
	onConfirm: (scope: DeleteHistoryScope) => void
}

export default function DeleteChatHistoryModal({
	isOpen,
	isLoading = false,
	chatLabel,
	canDeleteForAll = true,
	onClose,
	onConfirm,
}: Props) {
	return (
		<AnimatePresence>
			{isOpen && (
				<motion.div
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					exit={{ opacity: 0 }}
					className='fixed inset-0 z-[100000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
					onClick={onClose}
				>
					<motion.div
						initial={{ opacity: 0, scale: 0.96, y: 8 }}
						animate={{ opacity: 1, scale: 1, y: 0 }}
						exit={{ opacity: 0, scale: 0.96, y: 8 }}
						transition={{ duration: 0.2 }}
						className='w-full max-w-md rounded-2xl border border-[#30363d] bg-[#161b22] p-6 shadow-2xl'
						onClick={e => e.stopPropagation()}
					>
						<h3 className='text-lg font-bold text-white'>
							Удалить переписку
						</h3>
						<p className='mt-2 text-sm text-[#8b949e] leading-relaxed'>
							{chatLabel ? (
								<>
									Чат: <span className='text-[#e6edf3] font-medium'>{chatLabel}</span>.
									<br />
								</>
							) : null}
							Выберите, как удалить историю сообщений.
						</p>

						<div className='mt-5 flex flex-col gap-2.5'>
							<button
								type='button'
								disabled={isLoading}
								onClick={() => onConfirm('for_me')}
								className='w-full rounded-xl border border-[#30363d] bg-[#0e1117] p-4 text-left text-sm text-[#e6edf3] hover:bg-[#21262d] transition disabled:opacity-50'
							>
								<span className='font-semibold text-white block'>
									Только у меня
								</span>
								<span className='mt-1 block text-xs text-[#8b949e] leading-relaxed'>
									Сообщения исчезнут только в вашем чате. У собеседника они
									останутся.
								</span>
							</button>

							{canDeleteForAll && (
								<button
									type='button'
									disabled={isLoading}
									onClick={() => onConfirm('for_all')}
									className='w-full rounded-xl border border-rose-500/25 bg-rose-500/10 p-4 text-left text-sm hover:bg-rose-500/15 transition disabled:opacity-50'
								>
									<span className='font-semibold text-rose-300 block'>
										У всех
									</span>
									<span className='mt-1 block text-xs text-rose-200/70 leading-relaxed'>
										Все сообщения будут удалены без восстановления для всех
										участников.
									</span>
								</button>
							)}
						</div>

						<div className='mt-5 flex justify-end gap-2'>
							<button
								type='button'
								disabled={isLoading}
								onClick={onClose}
								className='rounded-xl px-4 py-2 text-sm font-medium text-[#8b949e] hover:text-[#e6edf3] hover:bg-[#21262d] transition disabled:opacity-50'
							>
								Отмена
							</button>
						</div>

						{isLoading && (
							<p className='mt-3 text-center text-xs text-[#8b949e]'>
								Удаление…
							</p>
						)}
					</motion.div>
				</motion.div>
			)}
		</AnimatePresence>
	)
}
