import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	try {
		console.log('[API] GET /api/auth/me called')
		const accessToken = await getAccessToken(req)

		if (!accessToken) {
			console.log('[API] No access token')
			return NextResponse.json({ user: null }, { status: 401 })
		}

		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
		console.log(`[API] Fetching user from ${backendUrl}/api/v1/auth/me`)

		const response = await fetch(`${backendUrl}/api/v1/auth/me`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ access_token: accessToken }),
		})

		console.log('[API] Backend response status:', response.status)

		if (!response.ok) {
			const errorText = await response.text()
			console.log('[API] Backend error:', errorText)
			return NextResponse.json(
				{ user: null, debug_error: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('[API] Internal error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
