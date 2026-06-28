import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	try {
		const qrToken = req.nextUrl.searchParams.get('qr_token') || ''
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/qr/status?qr_token=${encodeURIComponent(qrToken)}`)
		const data = await res.json()
		return NextResponse.json(data, { status: res.status })
	} catch {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
