import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const backendUrl = getBackendUrl()

		return await withAccessTokenRefresh(req, async token => {
			const body = await req.json().catch(() => ({}))

			const response = await fetch(`${backendUrl}/api/v1/users/status`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ ...body, access_token: token }),
			})

			const text = await response.text()
			let data: Record<string, unknown> = {}
			try {
				data = JSON.parse(text) as Record<string, unknown>
			} catch {
				data = { error: text || 'Status update failed' }
			}

			if (!response.ok) {
				return NextResponse.json(data, { status: response.status })
			}

			return NextResponse.json(data)
		})
	} catch (error) {
		console.error('User status proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
