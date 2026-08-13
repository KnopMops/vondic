'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useMusicPlayerStore } from '@/lib/stores/musicPlayerStore'

export default function MusicPage() {
	const router = useRouter()
	const { setIsPlaylistModalOpen } = useMusicPlayerStore()

	useEffect(() => {
		setIsPlaylistModalOpen(true)
		router.replace('/feed/messages')
	}, [router, setIsPlaylistModalOpen])

	return null
}
