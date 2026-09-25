'use client'

import { useState } from 'react'
import { LuLifeBuoy as LifeBuoy, LuX as X } from 'react-icons/lu'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/AuthContext'

const SUPPORT_QUESTIONS = [
	'Как сменить пароль?',
	'Как удалить аккаунт?',
	'Не могу войти в аккаунт',
	'Ошибка при загрузке страницы',
	'Как связаться с поддержкой?',
	'Другое',
]

export default function SupportWidget() {
	const [isOpen, setIsOpen] = useState(false)
	const [question, setQuestion] = useState('')
	const [customQuestion, setCustomQuestion] = useState('')
	const [loading, setLoading] = useState(false)
	const pathname = usePathname()
	const router = useRouter()
	const { user } = useAuth()

	if (pathname?.startsWith('/feed/messages')) return null

	const handleSubmit = async () => {
		const q = question === 'Другое' ? customQuestion.trim() : question
		if (!q) return

		setLoading(true)
		try {
			const res = await fetch('/api/support/chat/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: q, new_chat: true }),
			})

			if (res.status === 401 && !user) {
				const anonRes = await fetch('/api/support/anon/create', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ question: q }),
				})
				const anonData = await anonRes.json()
				if (anonData.ok && anonData.anon_token) {
					localStorage.setItem('anon_support_token', anonData.anon_token)
					setIsOpen(false)
					setQuestion('')
					setCustomQuestion('')
					router.push(`/feed/messages/anon/${anonData.escalation_id}`)
				}
				return
			}

			const data = await res.json()
			if (data.ok && data.escalation_id) {
				setIsOpen(false)
				setQuestion('')
				setCustomQuestion('')
				router.push(`/feed/messages?support_id=${data.escalation_id}`)
			}
		} catch (e) {
			console.error('Support error:', e)
		} finally {
			setLoading(false)
		}
	}

	return (
		<>
			<button
				type='button'
				onClick={() => setIsOpen(true)}
				className='fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[#0077FF] hover:bg-[#0066dd] text-white shadow-lg shadow-[#0077FF]/30 hover:shadow-[#0077FF]/50 hover:scale-105 transition-all duration-200 cursor-pointer'
				aria-label='Техническая поддержка'
			>
				<LifeBuoy className='h-6 w-6' />
			</button>

			{isOpen && (
				<div
					className='fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4'
					onClick={() => setIsOpen(false)}
				>
					<div
						className='w-full sm:max-w-lg max-h-[85vh] overflow-y-auto bg-[#161b22] sm:rounded-2xl rounded-t-2xl border border-[#30363d] shadow-2xl'
						onClick={e => e.stopPropagation()}
					>
						<div className='flex items-center justify-between p-4 border-b border-[#30363d]'>
							<div className='flex items-center gap-2'>
								<LifeBuoy className='h-5 w-5 text-[#0077FF]' />
								<h2 className='text-lg font-semibold text-white'>Техническая поддержка</h2>
							</div>
							<button
								type='button'
								onClick={() => setIsOpen(false)}
								className='p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer'
							>
								<X className='h-5 w-5' />
							</button>
						</div>

						<div className='p-4 space-y-4'>
							<div>
								<h3 className='text-sm font-medium text-[#8b949e] mb-2'>Частые вопросы</h3>
								<div className='space-y-2'>
									{SUPPORT_QUESTIONS.map(q => (
										<button
											key={q}
											type='button'
											onClick={() => setQuestion(q === question ? '' : q)}
											className={`w-full text-left px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer ${
												question === q
													? 'bg-[#0077FF]/15 text-white ring-1 ring-[#0077FF]/40 border border-[#0077FF]/30 font-medium'
													: 'bg-[#0e1117] text-[#8b949e] border border-[#30363d] hover:bg-white/5 hover:text-white'
											}`}
										>
											{q}
										</button>
									))}
								</div>
							</div>

							{question === 'Другое' && (
								<div>
									<label className='text-sm font-medium text-[#8b949e] mb-2 block'>
										Опишите вашу проблему
									</label>
									<textarea
										value={customQuestion}
										onChange={e => setCustomQuestion(e.target.value)}
										placeholder='Опишите вашу проблему подробно...'
										rows={4}
										className='w-full rounded-xl bg-[#0e1117] border border-[#30363d] px-4 py-3 text-sm text-[#e6edf3] placeholder-[#8b949e]/60 focus:outline-none focus:ring-2 focus:ring-[#0077FF]/50 focus:border-[#0077FF] resize-none'
									/>
								</div>
							)}

							<button
								type='button'
								onClick={handleSubmit}
								disabled={loading || (!question && !customQuestion.trim()) || (question === 'Другое' && !customQuestion.trim())}
								className='w-full rounded-xl bg-[#0077FF] px-4 py-3 text-sm font-medium text-white hover:bg-[#0066dd] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md shadow-[#0077FF]/25 cursor-pointer'
							>
								{loading ? 'Отправка...' : 'Отправить'}
							</button>
						</div>
					</div>
				</div>
			)}
		</>
	)
}
