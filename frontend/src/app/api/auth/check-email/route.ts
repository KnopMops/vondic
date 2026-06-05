import { withVondicProxyHeaders } from '@/lib/proxy-headers'
import { getBackendUrl } from '@/lib/server-urls'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		if (body?.email && typeof body.email === 'string') {
			body.email = body.email.trim().toLowerCase()
		}
		const backendUrl = getBackendUrl().replace(/\/$/, '')
		const res = await fetch(`${backendUrl}/api/v1/auth/check-email`, {
			method: 'POST',
			headers: withVondicProxyHeaders({
				'Content-Type': 'application/json',
			}),
			body: JSON.stringify(body),
		})
		const text = await res.text()
		try {
			return NextResponse.json(JSON.parse(text), { status: res.status })
		} catch {
			return NextResponse.json(
				{ error: text || 'Invalid response' },
				{ status: res.status },
			)
		}
	} catch (error) {
		console.error('check-email proxy error:', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
