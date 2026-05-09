"use client"
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LuSettings as Settings, LuArrowLeft as ArrowLeft } from 'react-icons/lu'
import Link from 'next/link'

export default function PrivacyPage() {
	const { user } = useAuth()
	const router = useRouter()
	const [privacySettings, setPrivacySettings] = useState({
		show_email: false,
		show_online_status: true,
		show_last_seen: true,
		allow_friend_requests: true,
	})

	useEffect(() => {
		if (!user) {
			router.push('/')
			return
		}

		// Load privacy settings from user
		if (user.privacy_settings) {
			try {
				const parsed =
					typeof user.privacy_settings === 'string'
						? JSON.parse(user.privacy_settings)
						: user.privacy_settings
				if (parsed && typeof parsed === 'object') {
					setPrivacySettings(prev => ({ ...prev, ...parsed }))
				}
			} catch {
				// ignore
			}
		}
	}, [user, router])

	const handleSave = async () => {
		try {
			const res = await fetch('/api/v1/users/me', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					privacy_settings: privacySettings,
				}),
			})
			if (res.ok) {
				alert('Настройки сохранены')
			}
		} catch (error) {
			console.error('Failed to save privacy settings:', error)
		}
	}

	return (
		<div className='min-h-screen bg-black text-white'>
			<header className='sticky top-0 z-50 border-b border-white/10 bg-black/20 backdrop-blur-xl'>
				<div className='mx-auto flex max-w-7xl items-center justify-between px-4 py-3'>
					<div className='flex items-center gap-3'>
						<button
							onClick={() => router.back()}
							className='rounded-full p-2 hover:bg-white/5 transition-colors'
						>
							<ArrowLeft className='h-5 w-5' />
						</button>
						<h1 className='text-lg font-semibold'>Приватность</h1>
					</div>
					<button
						onClick={() => router.push('/feed/settings')}
						className='rounded-full p-2 hover:bg-white/5 transition-colors'
						title='Настройки'
					>
						<Settings className='h-5 w-5' />
					</button>
				</div>
			</header>

			<main className='mx-auto max-w-2xl px-4 py-6 space-y-6'>
				<div className='rounded-2xl bg-white/5 border border-white/10 p-6 space-y-4'>
					<h2 className='text-lg font-semibold mb-4'>Настройки приватности</h2>

					<div className='flex items-center justify-between'>
						<div>
							<div className='font-medium'>Показывать email</div>
							<div className='text-sm text-gray-400'>Ваш email будет виден другим пользователям</div>
						</div>
						<button
							onClick={() =>
								setPrivacySettings(prev => ({ ...prev, show_email: !prev.show_email }))
							}
							className={`relative w-12 h-6 rounded-full transition-colors ${
								privacySettings.show_email ? 'bg-indigo-600' : 'bg-gray-600'
							}`}
						>
							<div
								className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
									privacySettings.show_email ? 'left-6.5' : 'left-0.5'
								}`}
							/>
						</button>
					</div>

					<div className='flex items-center justify-between'>
						<div>
							<div className='font-medium'>Статус в сети</div>
							<div className='text-sm text-gray-400'>Показывать, когда вы онлайн</div>
						</div>
						<button
							onClick={() =>
								setPrivacySettings(prev => ({ ...prev, show_online_status: !prev.show_online_status }))
							}
							className={`relative w-12 h-6 rounded-full transition-colors ${
								privacySettings.show_online_status ? 'bg-indigo-600' : 'bg-gray-600'
							}`}
						>
							<div
								className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
									privacySettings.show_online_status ? 'left-6.5' : 'left-0.5'
								}`}
							/>
						</button>
					</div>

					<div className='flex items-center justify-between'>
						<div>
							<div className='font-medium'>Последний раз в сети</div>
							<div className='text-sm text-gray-400'>Показывать время последнего посещения</div>
						</div>
						<button
							onClick={() =>
								setPrivacySettings(prev => ({ ...prev, show_last_seen: !prev.show_last_seen }))
							}
							className={`relative w-12 h-6 rounded-full transition-colors ${
								privacySettings.show_last_seen ? 'bg-indigo-600' : 'bg-gray-600'
							}`}
						>
							<div
								className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
									privacySettings.show_last_seen ? 'left-6.5' : 'left-0.5'
								}`}
							/>
						</button>
					</div>

					<div className='flex items-center justify-between'>
						<div>
							<div className='font-medium'>Запросы в друзья</div>
							<div className='text-sm text-gray-400'>Разрешить другим отправлять запросы в друзья</div>
						</div>
						<button
							onClick={() =>
								setPrivacySettings(prev => ({ ...prev, allow_friend_requests: !prev.allow_friend_requests }))
							}
							className={`relative w-12 h-6 rounded-full transition-colors ${
								privacySettings.allow_friend_requests ? 'bg-indigo-600' : 'bg-gray-600'
							}`}
						>
							<div
								className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
									privacySettings.allow_friend_requests ? 'left-6.5' : 'left-0.5'
								}`}
							/>
						</button>
					</div>
				</div>

				<button
					onClick={handleSave}
					className='w-full rounded-xl bg-indigo-600 py-3 font-semibold text-white hover:bg-indigo-500 transition-colors'
				>
					Сохранить
				</button>

				<Link
					href='/feed/settings'
					className='block text-center text-sm text-indigo-400 hover:text-indigo-300 transition-colors'
				>
					Все настройки
				</Link>
			</main>
		</div>
	)
}
