"use client"
import { useAuth } from '@/lib/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LuSettings as Settings, LuArrowLeft as ArrowLeft, LuShieldCheck as Shield } from 'react-icons/lu'
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

		if (user.privacy_settings) {
			try {
				const parsed =
					typeof user.privacy_settings === 'string'
						? JSON.parse(user.privacy_settings)
						: user.privacy_settings
				if (parsed && typeof parsed === 'object') {
					setPrivacySettings(prev => ({ ...prev, ...parsed }))
				}
			} catch {}
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
				alert('Настройки приватности сохранены')
			}
		} catch (error) {
			console.error('Failed to save privacy settings:', error)
		}
	}

	return (
		<div className='min-h-screen bg-[#0e1117] text-[#e6edf3] selection:bg-[#0077FF] selection:text-white font-sans'>
			<header className='sticky top-0 z-50 border-b border-[#30363d] bg-[#161b22]/90 backdrop-blur-xl'>
				<div className='mx-auto flex max-w-4xl items-center justify-between px-4 py-3.5'>
					<div className='flex items-center gap-3'>
						<button
							onClick={() => router.back()}
							className='rounded-xl p-2 text-[#8b949e] hover:bg-[#21262d] hover:text-white transition-colors'
						>
							<ArrowLeft className='h-5 w-5' />
						</button>
						<h1 className='text-base font-bold text-white tracking-tight flex items-center gap-2'>
							<Shield className='w-4 h-4 text-[#0077FF]' />
							Приватность и безопасность
						</h1>
					</div>
					<button
						onClick={() => router.push('/feed/settings')}
						className='rounded-xl p-2 text-[#8b949e] hover:bg-[#21262d] hover:text-white transition-colors'
						title='Настройки'
					>
						<Settings className='h-5 w-5' />
					</button>
				</div>
			</header>

			<main className='mx-auto max-w-2xl px-4 py-8 space-y-6'>
				<div className='rounded-2xl bg-[#161b22] border border-[#30363d] p-6 space-y-5 shadow-sm'>
					<div>
						<h2 className='text-base font-semibold text-white'>Настройки видимости</h2>
						<p className='text-xs text-[#8b949e] mt-0.5'>
							Управляйте отображением вашей активности и контактных данных
						</p>
					</div>

					<div className='divide-y divide-[#30363d]'>
						<div className='flex items-center justify-between py-3.5'>
							<div>
								<div className='text-sm font-medium text-white'>Показывать email</div>
								<div className='text-xs text-[#8b949e] mt-0.5'>Ваш email будет виден другим пользователям</div>
							</div>
							<button
								onClick={() =>
									setPrivacySettings(prev => ({ ...prev, show_email: !prev.show_email }))
								}
								className={`relative w-11 h-6 rounded-full transition-colors ${
									privacySettings.show_email ? 'bg-[#0077FF]' : 'bg-[#21262d] border border-[#30363d]'
								}`}
							>
								<div
									className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
										privacySettings.show_email ? 'left-5.5' : 'left-0.5'
									}`}
								/>
							</button>
						</div>

						<div className='flex items-center justify-between py-3.5'>
							<div>
								<div className='text-sm font-medium text-white'>Статус в сети</div>
								<div className='text-xs text-[#8b949e] mt-0.5'>Показывать индикатор онлайн в профиле и сообщениях</div>
							</div>
							<button
								onClick={() =>
									setPrivacySettings(prev => ({ ...prev, show_online_status: !prev.show_online_status }))
								}
								className={`relative w-11 h-6 rounded-full transition-colors ${
									privacySettings.show_online_status ? 'bg-[#0077FF]' : 'bg-[#21262d] border border-[#30363d]'
								}`}
							>
								<div
									className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
										privacySettings.show_online_status ? 'left-5.5' : 'left-0.5'
									}`}
								/>
							</button>
						</div>

						<div className='flex items-center justify-between py-3.5'>
							<div>
								<div className='text-sm font-medium text-white'>Время последнего посещения</div>
								<div className='text-xs text-[#8b949e] mt-0.5'>Показывать дату и время вашей последней активности</div>
							</div>
							<button
								onClick={() =>
									setPrivacySettings(prev => ({ ...prev, show_last_seen: !prev.show_last_seen }))
								}
								className={`relative w-11 h-6 rounded-full transition-colors ${
									privacySettings.show_last_seen ? 'bg-[#0077FF]' : 'bg-[#21262d] border border-[#30363d]'
								}`}
							>
								<div
									className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
										privacySettings.show_last_seen ? 'left-5.5' : 'left-0.5'
									}`}
								/>
							</button>
						</div>

						<div className='flex items-center justify-between py-3.5'>
							<div>
								<div className='text-sm font-medium text-white'>Заявки в друзья</div>
								<div className='text-xs text-[#8b949e] mt-0.5'>Разрешить другим пользователям отправлять вам приглашения</div>
							</div>
							<button
								onClick={() =>
									setPrivacySettings(prev => ({ ...prev, allow_friend_requests: !prev.allow_friend_requests }))
								}
								className={`relative w-11 h-6 rounded-full transition-colors ${
									privacySettings.allow_friend_requests ? 'bg-[#0077FF]' : 'bg-[#21262d] border border-[#30363d]'
								}`}
							>
								<div
									className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${
										privacySettings.allow_friend_requests ? 'left-5.5' : 'left-0.5'
									}`}
								/>
							</button>
						</div>
					</div>
				</div>

				<div className='space-y-3'>
					<button
						onClick={handleSave}
						className='w-full rounded-xl bg-[#0077FF] py-2.5 font-semibold text-xs text-white hover:bg-[#0066dd] transition-colors shadow-sm'
					>
						Сохранить изменения
					</button>

					<Link
						href='/feed/settings'
						className='block text-center text-xs text-[#58a6ff] hover:underline'
					>
						Все настройки профиля →
					</Link>
				</div>
			</main>
		</div>
	)
}
