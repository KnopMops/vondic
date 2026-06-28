import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/playlists/borrow/requests`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		})

		const text = await res.text()
		try {
			return NextResponse.json(JSON.parse(text), { status: res.status })
		} catch {
			return NextResponse.json({ error: 'Invalid backend response', raw: text }, { status: 500 })
		}
	} catch {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}

