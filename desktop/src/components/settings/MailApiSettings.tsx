'use client'

import { useToast } from '@/lib/ToastContext'
import { useCallback, useEffect, useState } from 'react'

type MailPermissions = {
	send: boolean
	read: boolean
	delete: boolean
}

const PERM_LABELS: { key: keyof MailPermissions; label: string; hint: string }[] = [
	{
		key: 'send',
		label: 'Отправка',
		hint: 'POST /api/public/v1/mail/send',
	},
	{
		key: 'read',
		label: 'Чтение',
		hint: 'GET /api/public/v1/mail/messages',
	},
	{
		key: 'delete',
		label: 'Удаление',
		hint: 'POST /api/public/v1/mail/messages/{uid}/trash',
	},
]

export default function MailApiSettings() {
	const { showToast } = useToast()
	const [permissions, setPermissions] = useState<MailPermissions>({
		send: false,
		read: false,
		delete: false,
	})
	const [loading, setLoading] = useState(true)
	const [saving, setSaving] = useState(false)

	const load = useCallback(async () => {
		setLoading(true)
		try {
			const res = await fetch('/api/v1/mail/api-permissions', {
				credentials: 'include',
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка загрузки')
			if (data.permissions) setPermissions(data.permissions)
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Ошибка', 'error')
		} finally {
			setLoading(false)
		}
	}, [showToast])

	useEffect(() => {
		load()
	}, [load])

	const save = async () => {
		setSaving(true)
		try {
			const res = await fetch('/api/v1/mail/api-permissions', {
				method: 'PUT',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(permissions),
			})
			const data = await res.json()
			if (!res.ok) throw new Error(data.error || 'Ошибка сохранения')
			if (data.permissions) setPermissions(data.permissions)
			showToast('Права Mail API сохранены', 'success')
		} catch (e: unknown) {
			showToast(e instanceof Error ? e.message : 'Ошибка', 'error')
		} finally {
			setSaving(false)
		}
	}

	const toggle = (key: keyof MailPermissions) => {
		setPermissions(prev => ({ ...prev, [key]: !prev[key] }))
	}

	return (
		<div className='space-y-4'>
			<p className='text-sm text-gray-400'>
				Права применяются к вашему API-ключу из раздела «Разработчик». Заголовок:{' '}
				<code className='text-indigo-300'>X-API-Key</code>
			</p>
			{loading ? (
				<p className='text-sm text-gray-500'>Загрузка…</p>
			) : (
				<ul className='space-y-3'>
					{PERM_LABELS.map(({ key, label, hint }) => (
						<li
							key={key}
							className='flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3'
						>
							<div>
								<p className='text-sm font-medium text-white'>{label}</p>
								<p className='text-xs text-gray-500 font-mono'>{hint}</p>
							</div>
							<button
								type='button'
								onClick={() => toggle(key)}
								className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${permissions[key] ? 'bg-indigo-500/60' : 'bg-white/10'}`}
							>
								<span
									className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${permissions[key] ? 'translate-x-6' : 'translate-x-1'}`}
								/>
							</button>
						</li>
					))}
				</ul>
			)}
			<button
				type='button'
				onClick={save}
				disabled={saving || loading}
				className='rounded-lg bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500 transition disabled:opacity-50'
			>
				{saving ? 'Сохранение…' : 'Сохранить права'}
			</button>
		</div>
	)
}
