import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const body = await req.json().catch(() => ({}))
		const backendUrl = getBackendUrl()
		const payload = { ...body, access_token: token }
		const res = await fetch(`${backendUrl}/api/v1/storis/friends`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})
		if (!res.ok) {
			const text = await res.text()
			return NextResponse.json({ error: text }, { status: res.status })
		}
		const data = await res.json()
		return NextResponse.json(Array.isArray(data) ? data : [])
	} catch (e) {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
