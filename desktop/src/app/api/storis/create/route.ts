import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const body = await req.json()
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/storis/create`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
				'X-Client-Time': new Date().toISOString(),
			},
			body: JSON.stringify({ ...body, access_token: token }),
		})
		const text = await res.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: res.status })
		} catch {
			return NextResponse.json({ error: text || 'Error' }, { status: res.status })
		}
	} catch (e) {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
