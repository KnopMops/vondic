'use client'

import { FiShield } from 'react-icons/fi'
import { useBrowserPermissions } from '@/lib/hooks/useBrowserPermissions'

export default function BrowserPermissions() {
	const { permissions, checkPermissions, requestCameraAndMic, requestNotifications } = useBrowserPermissions()

	const statusLabel = (s: string) =>
		s === 'granted' ? 'Разрешено' : s === 'denied' ? 'Заблокировано' : s === 'prompt' ? 'Не запрошено' : '—'

	const statusClass = (s: string) =>
		s === 'granted'
			? 'bg-emerald-500/20 text-emerald-300'
			: s === 'denied'
				? 'bg-rose-500/20 text-rose-300'
				: 'bg-white/10 text-gray-400'

	return (
		<div className='rounded-2xl bg-white/5 border border-white/10 p-6'>
			<div className='flex items-center gap-3 mb-4'>
				<FiShield className='w-5 h-5 text-emerald-400' />
				<h2 className='text-xl font-semibold'>Разрешения браузера</h2>
			</div>
			<div className='space-y-3'>
				{(['camera', 'microphone', 'notifications'] as const).map(kind => {
					const labels: Record<string, string> = { camera: 'Камера', microphone: 'Микрофон', notifications: 'Уведомления' }
					const descs: Record<string, string> = { camera: 'Для видеозвонков', microphone: 'Для голосовых сообщений', notifications: 'Для оповещений' }
					return (
						<div key={kind} className='flex items-center justify-between'>
							<div>
								<p className='text-sm text-white'>{labels[kind]}</p>
								<p className='text-xs text-white/40'>{descs[kind]}</p>
							</div>
							<span className={`text-xs px-2 py-1 rounded-full ${statusClass(permissions[kind])}`}>
								{statusLabel(permissions[kind])}
							</span>
						</div>
					)
				})}
				<button
					onClick={async () => {
						await requestCameraAndMic()
						await requestNotifications()
						await checkPermissions()
					}}
					className='w-full mt-2 py-2 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-medium transition-colors'
				>
					Запросить разрешения
				</button>
			</div>
		</div>
	)
}
