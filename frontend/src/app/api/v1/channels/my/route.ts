import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const backendUrl = getBackendUrl()

		return await withAccessTokenRefresh(req, async token => {
			let body = {}
			try {
				body = await req.json()
			} catch (e) {
				// ignore
			}

			const response = await fetch(`${backendUrl}/api/v1/channels/my`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ ...body, access_token: token }),
			})

			if (!response.ok) {
				const errorText = await response.text()
				return NextResponse.json(
					{ error: 'Failed to fetch my channels', details: errorText },
					{ status: response.status },
				)
			}

			const data = await response.json()
			return NextResponse.json(data)
		})
	} catch (error) {
		console.error('Fetch my channels proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
