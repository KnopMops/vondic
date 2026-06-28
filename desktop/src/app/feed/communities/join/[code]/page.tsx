'use client'

import AppLoader from '@/components/ui/AppLoader'
import FeedPageShell from '@/components/social/FeedPageShell'
import { useAuth } from '@/lib/AuthContext'
import { storePostLoginRedirect } from '@/lib/authRedirect'
import { useSocialCommunities } from '@/lib/hooks/useSocialCommunities'
import { useToast } from '@/lib/ToastContext'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

/** Вступление в публичное сообщество (стена VK), не сервер мессенджера. */
export default function JoinSocialCommunityPage() {
	const { code } = useParams()
	const inviteCode = decodeURIComponent(String(code || ''))
	const { user, logout, authReady } = useAuth()
	const { joinCommunity } = useSocialCommunities()
	const { showToast } = useToast()
	const router = useRouter()
	const [error, setError] = useState('')
	const joinStarted = useRef(false)

	useEffect(() => {
		if (!authReady) return

		if (!user) {
			const returnTo = `/feed/communities/join/${inviteCode}`
			storePostLoginRedirect(returnTo)
			router.replace(`/login?returnTo=${encodeURIComponent(returnTo)}`)
			return
		}

		if (joinStarted.current) return
		joinStarted.current = true

		let cancelled = false

		const run = async () => {
			try {
				const c = await joinCommunity(inviteCode)
				if (cancelled) return
				showToast('Вы вступили в сообщество', 'success')
				router.replace(`/feed/communities/${c.id}`)
			} catch (e: unknown) {
				if (cancelled) return
				joinStarted.current = false
				setError(e instanceof Error ? e.message : 'Ошибка')
			}
		}

		run()

		return () => {
			cancelled = true
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- один запуск после authReady + user
	}, [authReady, user?.id, inviteCode])

	return (
		<FeedPageShell email={user?.email} onLogout={logout} withTopPadding={false}>
			<main className='flex flex-1 flex-col items-center justify-center gap-4 p-8'>
				{error ? (
					<>
						<p className='text-gray-300'>{error}</p>
						<Link href='/feed/communities' className='text-indigo-400'>
							← К сообществам
						</Link>
					</>
				) : (
					<AppLoader size='lg' label='Вступаем в сообщество…' />
				)}
			</main>
		</FeedPageShell>
	)
}
