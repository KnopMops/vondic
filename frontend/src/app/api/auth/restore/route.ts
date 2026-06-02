import { NextRequest, NextResponse } from 'next/server'
import { setTokens } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		const refreshToken = body?.refresh_token
		if (!refreshToken) {
			return NextResponse.json({ error: 'refresh_token required' }, { status: 400 })
		}

		const backendUrl = getBackendUrl()
		const response = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${refreshToken}`,
			},
		})

		const text = await response.text()
		let data: any = {}
		try {
			data = JSON.parse(text)
		} catch {
			data = { error: text || 'Refresh failed' }
		}

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || 'Refresh failed' },
				{ status: response.status },
			)
		}

		const nextResponse = NextResponse.json(data)
		if (data.access_token && data.refresh_token) {
			return setTokens(nextResponse, data.access_token, data.refresh_token)
		}
		return nextResponse
	} catch (error) {
		console.error('Restore proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
