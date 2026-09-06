import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(
	req: NextRequest,
	{ params }: { params: { bot_id: string } },
) {
	const { bot_id } = params
	const authHeader = req.headers.get('Authorization') || ''
	const body = await req.json()
	const backendUrl = getBackendUrl()

	const res = await fetch(`${backendUrl}/api/v1/bots/${bot_id}/verify`, {
		method: 'POST',
		headers: {
			Authorization: authHeader,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
	})

	const data = await res.json()
	return NextResponse.json(data, { status: res.status })
}
