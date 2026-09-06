import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ bot_id: string; game_id: string; path?: string[] }> }
) {
	const { bot_id, game_id, path } = await params
	const backendUrl = getBackendUrl()
	const subPath = (path || []).join('/')
	const url = subPath
		? `${backendUrl}/api/v1/bots/${bot_id}/games/${game_id}/embed/${subPath}`
		: `${backendUrl}/api/v1/bots/${bot_id}/games/${game_id}/embed`

	try {
		const res = await fetch(url)
		const contentType = res.headers.get('Content-Type') || 'application/octet-stream'

		if (contentType.startsWith('text/html')) {
			const body = await res.text()
			return new NextResponse(body, {
				status: res.status,
				headers: { 'Content-Type': 'text/html' },
			})
		}

		const body = await res.arrayBuffer()
		return new NextResponse(body, {
			status: res.status,
			headers: { 'Content-Type': contentType },
		})
	} catch (error: any) {
		console.error('[Embed Proxy] Error:', error)
		return NextResponse.json(
			{ error: error.message || 'Failed to fetch embed' },
			{ status: 500 }
		)
	}
}
