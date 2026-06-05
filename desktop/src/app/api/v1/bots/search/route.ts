import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}))
		
		
		let token = body?.access_token
		
		
		if (!token) {
			token = await getAccessToken(req)
		}
		
		
		if (!token) {
			const authHeader = req.headers.get('authorization') || ''
			if (authHeader.startsWith('Bearer ')) {
				token = authHeader.slice(7).trim()
			}
		}
		
		if (!token) {
			console.error('[Bots Search] No access token found')
			return NextResponse.json({ error: 'access_token is missing' }, { status: 401 })
		}

		const backendUrl = getBackendUrl()
		const payload = { ...body, access_token: token }

		const response = await fetch(`${backendUrl}/api/v1/bots/search`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})

		const text = await response.text()
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
		console.error('Bots search proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
