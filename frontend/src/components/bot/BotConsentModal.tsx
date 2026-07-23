'use client'

import { useState, useEffect } from 'react'

const SCOPES = [
	{ id: 'basic_profile', label: 'Базовый профиль', desc: 'ID, username, аватар' },
	{ id: 'send_messages', label: 'Отправка сообщений', desc: 'Бот может писать вам' },
	{ id: 'read_profile', label: 'Полный профиль', desc: 'Имя, email, bio' },
	{ id: 'chat_access', label: 'Доступ к чатам', desc: 'Список ваших чатов' },
	{ id: 'message_history', label: 'История сообщений', desc: 'Чтение переписки' },
	{ id: 'media_access', label: 'Медиа', desc: 'Фото, видео, документы' },
	{ id: 'location_access', label: 'Геолокация', desc: 'Чтение местоположения' },
	{ id: 'notifications', label: 'Уведомления', desc: 'Push-уведомления' },
]

interface BotConsentModalProps {
	botId: string
	botName: string
	botDescription?: string
	botAvatar?: string
	scopes: string[]
	onGranted: () => void
	onDenied: () => void
}

export default function BotConsentModal({
	botId,
	botName,
	botDescription,
	botAvatar,
	scopes,
	onGranted,
	onDenied,
}: BotConsentModalProps) {
	const [loading, setLoading] = useState(false)

	const requestedScopes = SCOPES.filter(s => scopes.includes(s.id))

	const handleGrant = async () => {
		setLoading(true)
		try {
			const token = localStorage.getItem('access_token')
			await fetch(`/api/v1/bots/${botId}/permissions/grant`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				body: JSON.stringify({ scopes: scopes.join(',') }),
			})
			onGranted()
		} catch {
			onDenied()
		}
		setLoading(false)
	}

	return (
		<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm'>
			<div className='bg-[#1a1a2e] rounded-2xl p-6 max-w-[420px] w-full mx-4 border border-white/10 shadow-2xl'>
				{/* Bot info */}
				<div className='text-center mb-5'>
					<div className='w-16 h-16 mx-auto rounded-full bg-indigo-500/20 flex items-center justify-center text-2xl font-bold text-indigo-300 mb-3'>
						{botAvatar ? (
							<img src={botAvatar} alt={botName} className='w-16 h-16 rounded-full object-cover' />
						) : (
							botName.charAt(0).toUpperCase()
						)}
					</div>
					<h3 className='text-xl font-bold text-white'>{botName}</h3>
					{botDescription && (
						<p className='text-gray-400 text-sm mt-1'>{botDescription}</p>
					)}
				</div>

				<p className='text-gray-300 text-sm text-center mb-4'>
					Этот бот запрашивает доступ к:
				</p>

				{/* Scopes list */}
				<ul className='space-y-2 mb-6'>
					{requestedScopes.map(scope => (
						<li key={scope.id} className='flex items-start gap-3 p-2 rounded-lg bg-white/5'>
							<span className='text-green-400 mt-0.5'>✓</span>
							<div>
								<div className='text-white text-sm font-medium'>{scope.label}</div>
								<div className='text-gray-400 text-xs'>{scope.desc}</div>
							</div>
						</li>
					))}
				</ul>

				{/* Buttons */}
				<div className='flex gap-3'>
					<button
						onClick={onDenied}
						disabled={loading}
						className='flex-1 py-3 rounded-xl bg-white/8 text-gray-400 font-semibold text-sm hover:bg-white/12 transition-colors disabled:opacity-50'
					>
						Отклонить
					</button>
					<button
						onClick={handleGrant}
						disabled={loading}
						className='flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50'
					>
						{loading ? '...' : 'Разрешить'}
					</button>
				</div>
			</div>
		</div>
	)
}
