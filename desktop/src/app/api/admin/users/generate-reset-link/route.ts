import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	const body = await req.json()
	const authHeader = req.headers.get('Authorization') || ''
	const backendUrl = getBackendUrl()
	const res = await fetch(`${backendUrl}/api/v1/users/admin/generate-reset-link`, {
		method: 'POST',
		headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	const data = await res.json()
	return NextResponse.json(data)
}
