'use client'

import JoinByInvite from '@/components/community/JoinByInvite'
import { useParams } from 'next/navigation'

export default function JoinServerPage() {
	const { code } = useParams()
	return <JoinByInvite kind='server' code={decodeURIComponent(String(code || ''))} />
}
