import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest, { params }: { params: { bot_id: string } }) {
	try {
		const body = await req.json().catch(() => ({}))
		const { bot_id } = params
		
		let token = await getAccessToken(req)
		
		if (!token) {
			token = body?.access_token
		}
		
		if (!token) {
			const authHeader = req.headers.get('authorization') || ''
			if (authHeader.startsWith('Bearer ')) {
				token = authHeader.slice(7).trim()
			}
		}

		const backendUrl = getBackendUrl()
		const payload = { ...body, access_token: token }
		
		console.log('[Bots Callback] Forwarding to backend:', `${backendUrl}/api/public/v1/bots/${bot_id}/callback`)
		
		const response = await fetch(`${backendUrl}/api/public/v1/bots/${bot_id}/callback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		const text = await response.text()
		console.log('[Bots Callback] Backend response:', response.status, text)
		
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: response.status })
		} catch {
			return NextResponse.json(
				{ error: text || 'Invalid backend response' },
				{ status: response.status },
			)
		}
	} catch (error) {
		console.error('Bots callback proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
