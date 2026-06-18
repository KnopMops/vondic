import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(
	request: NextRequest,
	{ params }: { params: Promise<{ bot_id: string; game_id: string; path?: string[] }> }
) {
	const { bot_id, game_id, path } = await params
	const backendUrl = getBackendUrl()
	const assetPath = path ? path.join('/') : ''
	const url = `${backendUrl}/api/v1/bots/${bot_id}/games/${game_id}/asset/${assetPath}`

	try {
		const res = await fetch(url)
		const buffer = Buffer.from(await res.arrayBuffer())
		return new NextResponse(buffer, {
			status: res.status,
			headers: {
				'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
			},
		})
	} catch (error: any) {
		console.error('[Asset Proxy] Error:', error)
		return NextResponse.json(
			{ error: error.message || 'Failed to fetch asset' },
			{ status: 500 }
		)
	}
}
