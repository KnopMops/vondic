import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/qr/generate`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
		})
		const data = await res.json()
		return NextResponse.json(data, { status: res.status })
	} catch {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
