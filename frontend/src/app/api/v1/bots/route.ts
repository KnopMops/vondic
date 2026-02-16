import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}))
		let token = await getAccessToken(req)
		if (!token) {
			token = body?.access_token
		}
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
		const payload = { ...body, access_token: token }
		const response = await fetch(`${backendUrl}/api/v1/bots`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
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
		console.error('Bots create proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
