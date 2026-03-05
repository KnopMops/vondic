import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getWebrtcUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		let body: any = {}
		try {
			body = await req.json()
		} catch {
			body = {}
		}
		const { target_id, limit = 50, offset = 0, access_token: tokenFromBody, token: tokenAlt } = body
		const token = (await getAccessToken(req)) || tokenFromBody || tokenAlt

		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		// The user mentioned "webrtc server/messages/history".
        // Assuming the WebRTC server is running on port 5000 based on previous context (socket connection).
        // If it's the main backend, it would be port 5050.
        // Given "webrtc server" phrasing and socket usage, port 5000 is likely correct for this specific service.
        // However, standard backend is 5050. Let's use 5000 as per "webrtc server" hint or fallback to env.

        const socketUrl = getWebrtcUrl()

		const response = await fetch(`${socketUrl}/messages/history`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				token,
				target_id,
				limit,
				offset,
			}),
		})

		if (!response.ok) {
            const errorText = await response.text()
			return NextResponse.json(
				{ error: 'Failed to fetch history', details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('History proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
