import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	const q = req.nextUrl.searchParams.get('q') || ''
	const authHeader = req.headers.get('Authorization') || ''
	const backendUrl = getBackendUrl()
	const res = await fetch(`${backendUrl}/api/v1/users/admin/search?q=${encodeURIComponent(q)}`, {
		headers: { Authorization: authHeader },
	})
	const data = await res.json()
	return NextResponse.json(data)
}
