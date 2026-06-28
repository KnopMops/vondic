'use client'

import { useAuth } from '@/lib/AuthContext'
import { storePostLoginRedirect } from '@/lib/authRedirect'
import {
	channelJoinPath,
	groupJoinPath,
	messengerChannelPath,
	messengerGroupPath,
	messengerServerPath,
	serverJoinPath,
} from '@/lib/inviteLinks'
import AppLoader from '@/components/ui/AppLoader'
import { useToast } from '@/lib/ToastContext'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type JoinKind = 'server' | 'channel' | 'group'

type Props = {
	kind: JoinKind
	code: string
}

export default function JoinByInvite({ kind, code }: Props) {
	const { user, authReady } = useAuth()
	const { showToast } = useToast()
	const router = useRouter()
	const [status, setStatus] = useState<'loading' | 'error' | 'done'>('loading')
	const [message, setMessage] = useState('Подключаем…')

	useEffect(() => {
		if (!authReady) return
		if (!user) {
			const returnTo =
				kind === 'server'
					? serverJoinPath(code)
					: kind === 'channel'
						? channelJoinPath(code)
						: groupJoinPath(code)
			storePostLoginRedirect(returnTo)
			router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`)
			return
		}

		const run = async () => {
			setStatus('loading')
			const token =
				user.access_token ||
				(typeof window !== 'undefined'
					? localStorage.getItem('access_token')
					: null)
			if (!token) {
				setStatus('error')
				setMessage('Войдите в аккаунт')
				return
			}

			try {
				if (kind === 'server') {
					const res = await fetch('/api/v1/communities/join', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							invite_code: code,
							access_token: token,
						}),
					})
					if (!res.ok) {
						const err = await res.json().catch(() => ({}))
						throw new Error(err.error || 'Не удалось вступить в сервер')
					}
					const community = await res.json()
					showToast('Добро пожаловать на сервер!', 'success')
					router.replace(messengerServerPath(community.id))
					setStatus('done')
					return
				}

				if (kind === 'group') {
					const res = await fetch('/api/v1/groups/join', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							invite_code: code,
							access_token: token,
						}),
					})
					if (!res.ok) {
						const err = await res.json().catch(() => ({}))
						throw new Error(err.error || 'Не удалось вступить в группу')
					}
					const group = await res.json()
					showToast('Вы вступили в группу', 'success')
					router.replace(messengerGroupPath(group.id))
					setStatus('done')
					return
				}

				const res = await fetch('/api/v1/channels/join', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						invite_code: code,
						access_token: token,
					}),
				})
				if (!res.ok) {
					const err = await res.json().catch(() => ({}))
					throw new Error(err.error || 'Не удалось вступить в канал')
				}
				const channel = await res.json()
				showToast('Вы вступили в канал', 'success')
				router.replace(messengerChannelPath(channel.id))
				setStatus('done')
			} catch (e: unknown) {
				setStatus('error')
				setMessage(e instanceof Error ? e.message : 'Ошибка')
			}
		}

		run()
	}, [authReady, user, kind, code, router, showToast])

	return (
		<div className='flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0f] px-4 text-center text-white'>
			{status === 'loading' && (
				<>
					<AppLoader size='lg' label={message} />
				</>
			)}
			{status === 'error' && (
				<>
					<p className='text-lg font-medium text-white'>Не удалось присоединиться</p>
					<p className='max-w-sm text-sm text-gray-400'>{message}</p>
					<Link
						href='/feed/messages'
						className='rounded-xl bg-indigo-600 px-4 py-2 text-sm hover:bg-indigo-500'
					>
						В мессенджер
					</Link>
				</>
			)}
		</div>
	)
}
