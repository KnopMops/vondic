'use client'

import AppLoader from '@/components/ui/AppLoader'
import FeedPageShell from '@/components/social/FeedPageShell'
import { useAuth } from '@/lib/AuthContext'
import { LuLoader as Loader2, LuLifeBuoy as LifeBuoy, LuCircleHelp as HelpCircle } from 'react-icons/lu'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function SupportPage() {
	const { user, isLoading: isAuthLoading, isInitialized } = useAuth()
	const router = useRouter()
	const [ticketText, setTicketText] = useState('')
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [error, setError] = useState('')

	if (!isInitialized || isAuthLoading || !user) {
		return <AppLoader fullScreen size='lg' />
	}

	const handleSubmitTicket = async () => {
		const text = ticketText.trim()
		if (!text) return
		setIsSubmitting(true)
		setError('')
		try {
			const res = await fetch('/api/support/chat/send', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text, new_chat: true }),
			})
			const data = await res.json()
			if (res.ok && data?.ok && data?.escalation_id) {
				router.push(`/feed/messages?support_id=${data.escalation_id}`)
			} else {
				setError(data?.error || 'Не удалось создать заявку')
			}
		} catch {
			setError('Ошибка сети')
		} finally {
			setIsSubmitting(false)
		}
	}

	return (
		<FeedPageShell email={user.email} onLogout={() => router.push('/')}>
			<div className='mx-auto max-w-2xl space-y-6'>
				<div className='rounded-2xl border border-[#30363d] bg-[#161b22] p-6 shadow-sm'>
					<div className='flex items-center gap-3 mb-6'>
						<div className='w-10 h-10 rounded-xl bg-[#0077FF]/15 border border-[#0077FF]/30 flex items-center justify-center text-[#58a6ff]'>
							<LifeBuoy className='w-5 h-5' />
						</div>
						<div>
							<h1 className='text-lg font-bold text-white tracking-tight'>
								Техническая поддержка Вондик
							</h1>
							<p className='text-xs text-[#8b949e]'>
								Справочные материалы и прямая связь с операторами платформы
							</p>
						</div>
					</div>

					<div className='space-y-5'>
						<div className='bg-[#0d1117] border border-[#30363d] rounded-xl p-4'>
							<div className='text-xs font-semibold text-white uppercase tracking-wider mb-3 flex items-center gap-1.5'>
								<HelpCircle className='w-4 h-4 text-[#58a6ff]' />
								Частые вопросы
							</div>
							<div className='space-y-3 text-xs text-[#e6edf3]'>
								<div>
									<div className='font-semibold text-white'>Как войти через Yandex?</div>
									<div className='text-[#8b949e] mt-0.5'>
										На странице входа нажмите «Войти через Yandex» и
										подтвердите авторизацию.
									</div>
								</div>
								<div>
									<div className='font-semibold text-white'>
										Зачем нужен двухфакторный код при входе?
									</div>
									<div className='text-[#8b949e] mt-0.5'>
										Это защита аккаунта (2FA) для подтверждения владельца.
									</div>
								</div>
								<div>
									<div className='font-semibold text-white'>
										Письмо со ссылкой сброса не приходит — что делать?
									</div>
									<div className='text-[#8b949e] mt-0.5'>
										Проверьте папку «Спам» и «Рассылки».
									</div>
								</div>
								<div>
									<div className='font-semibold text-white'>
										Как восстановить доступ к аккаунту?
									</div>
									<div className='text-[#8b949e] mt-0.5'>
										Нажмите «Забыли пароль?» на странице входа или обратитесь в поддержку.
									</div>
								</div>
							</div>
						</div>

						<div className='bg-[#0d1117] border border-[#30363d] rounded-xl p-4'>
							<div className='text-sm font-semibold text-white mb-1'>
								Создать обращение
							</div>
							<div className='text-xs text-[#8b949e] mb-3'>
								Опишите ваш вопрос или проблему. После отправки диалог откроется в мессенджере с оператором.
							</div>
							<textarea
								value={ticketText}
								onChange={e => setTicketText(e.target.value)}
								placeholder='Опишите вашу проблему...'
								rows={4}
								className='w-full bg-[#161b22] border border-[#30363d] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-[#8b949e]/60 focus:border-[#0077FF] focus:ring-1 focus:ring-[#0077FF] outline-none transition-colors resize-none'
							/>
							{error && (
								<div className='text-red-400 text-xs mt-2'>{error}</div>
							)}
							<div className='flex justify-end mt-3'>
								<button
									onClick={handleSubmitTicket}
									disabled={isSubmitting || !ticketText.trim()}
									className='px-4 py-2 rounded-lg bg-[#0077FF] hover:bg-[#0066dd] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition-colors'
								>
									{isSubmitting ? (
										<Loader2 className='w-4 h-4 animate-spin' />
									) : null}
									Создать заявку
								</button>
							</div>
						</div>
					</div>
				</div>
			</div>
		</FeedPageShell>
	)
}
