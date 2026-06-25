'use client'

import AppLoader from '@/components/ui/AppLoader'
import Header from '@/components/social/Header'
import Sidebar from '@/components/social/Sidebar'
import RightPanel from '@/components/social/RightPanel'
import { useAuth } from '@/lib/AuthContext'
import { LuLoader as Loader2 } from 'react-icons/lu'
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
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative pb-20 md:pb-0'>
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px]' />
				<div className='absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-purple-900/20 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-900/10 blur-[100px]' />
			</div>

			<div className='relative z-20'>
				<Header email={user.email} onLogout={() => router.push('/')} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-7xl pt-20'>
				<Sidebar />
				<main className='flex-1 px-4 sm:px-6 lg:px-8'>
					<div className='mx-auto max-w-2xl space-y-6'>
						<div className='rounded-2xl border border-gray-800 bg-black/40 backdrop-blur-sm p-6'>
							<div className='flex items-center gap-2 mb-6'>
								<span className='text-lg font-semibold text-white'>
									Тех. поддержка
								</span>
								<span className='text-xs text-gray-400'>
									Справка и обращения
								</span>
							</div>

							<div className='space-y-6'>
								<div className='bg-gray-950/60 border border-gray-800 rounded-xl p-4'>
									<div className='text-sm font-medium text-gray-200 mb-3'>
										Частые вопросы
									</div>
									<div className='space-y-3 text-sm text-gray-300'>
										<div>
											<div className='font-semibold'>Как войти через Yandex?</div>
											<div className='text-gray-400'>
												На странице входа нажмите «Войти через Yandex» и
												подтвердите вход.
											</div>
										</div>
										<div>
											<div className='font-semibold'>
												Почему меня просят ввести код при входе?
											</div>
											<div className='text-gray-400'>
												Это двухфакторная защита (2FA).
											</div>
										</div>
										<div>
											<div className='font-semibold'>
												Письмо с кодом не приходит — что делать?
											</div>
											<div className='text-gray-400'>
												Проверьте «Спам» и «Промоакции».
											</div>
										</div>
										<div>
											<div className='font-semibold'>
												Как восстановить аккаунт?
											</div>
											<div className='text-gray-400'>
												Используйте команду /recover-account или нажмите «Забыли пароль?» на странице входа.
											</div>
										</div>
									</div>
								</div>

								<div className='bg-gray-950/60 border border-gray-800 rounded-xl p-4'>
									<div className='text-sm font-medium text-gray-200 mb-3'>
										Создать заявку
									</div>
									<div className='text-xs text-gray-400 mb-3'>
										Опишите вашу проблему. После создания заявки вы будете перенаправлены в мессенджер для общения с оператором.
									</div>
									<textarea
										value={ticketText}
										onChange={e => setTicketText(e.target.value)}
										placeholder='Опишите вашу проблему...'
										rows={4}
										className='w-full bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none'
									/>
									{error && (
										<div className='text-red-400 text-xs mt-2'>{error}</div>
									)}
									<div className='flex justify-end mt-3'>
										<button
											onClick={handleSubmitTicket}
											disabled={isSubmitting || !ticketText.trim()}
											className='px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium flex items-center gap-2'
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
				</main>
				<div className='hidden w-80 p-6 lg:block'>
					<RightPanel />
				</div>
			</div>
		</div>
	)
}
