import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const backendUrl = getBackendUrl()

		const res = await fetch(`${backendUrl}/api/v1/playlists/borrow`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		})

		const text = await res.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: res.status })
		} catch {
			return NextResponse.json(
				{ error: 'Invalid backend response', raw: text },
				{ status: 500 },
			)
		}
	} catch (e) {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}

