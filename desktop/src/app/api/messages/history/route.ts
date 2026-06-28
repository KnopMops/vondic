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

export async function DELETE(req: NextRequest) {
	try {
		let body: Record<string, unknown> = {}
		try {
			body = await req.json()
		} catch {
			body = {}
		}
		const target_id = body.target_id as string | undefined
		const scope = (body.scope as string | undefined) || 'for_all'
		const token =
			(await getAccessToken(req)) ||
			(body.access_token as string | undefined) ||
			(body.token as string | undefined)

		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!target_id) {
			return NextResponse.json({ error: 'target_id required' }, { status: 400 })
		}

		const socketUrl = getWebrtcUrl()
		const response = await fetch(`${socketUrl}/messages/history`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token, target_id, scope }),
		})

		if (!response.ok) {
			const errorText = await response.text()
			return NextResponse.json(
				{ error: 'Failed to delete history', details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('History delete proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
