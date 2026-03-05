import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

const BACKEND_URL = getBackendUrl()

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const body = await req.json()
		const res = await fetch(`${BACKEND_URL}/api/v1/videos/check`, {
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
			return NextResponse.json({ error: text }, { status: res.status })
		}
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Check failed' },
			{ status: 500 },
		)
	}
}
