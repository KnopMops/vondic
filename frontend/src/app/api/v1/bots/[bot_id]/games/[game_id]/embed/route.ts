import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ bot_id: string; game_id: string }> }
) {
	const { bot_id, game_id } = await params
	const backendUrl = getBackendUrl()
	const url = `${backendUrl}/api/v1/bots/${bot_id}/games/${game_id}/embed`

	try {
		const res = await fetch(url, {
			headers: {
				'Accept': 'text/html',
			},
		})
		const body = await res.text()
		return new NextResponse(body, {
			status: res.status,
			headers: {
				'Content-Type': res.headers.get('Content-Type') || 'text/html',
			},
		})
	} catch (error: any) {
		console.error('[Embed Proxy] Error:', error)
		return NextResponse.json(
			{ error: error.message || 'Failed to fetch embed' },
			{ status: 500 }
		)
	}
}
