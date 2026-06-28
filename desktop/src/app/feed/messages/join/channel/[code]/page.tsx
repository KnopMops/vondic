'use client'

import JoinByInvite from '@/components/community/JoinByInvite'
import { useParams } from 'next/navigation'

export default function JoinChannelPage() {
	const { code } = useParams()
	return <JoinByInvite kind='channel' code={decodeURIComponent(String(code || ''))} />
}
