'use client'

import JoinByInvite from '@/components/community/JoinByInvite'
import { useParams } from 'next/navigation'

export default function JoinGroupPage() {
	const { code } = useParams()
	return (
		<JoinByInvite kind='group' code={decodeURIComponent(String(code || ''))} />
	)
}
