import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const body = await req.json()
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/qr/scan`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		})
		const data = await res.json()
		return NextResponse.json(data, { status: res.status })
	} catch {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
