import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const backendUrl = getBackendUrl()

		return await withAccessTokenRefresh(req, async token => {
			const body = await req.json()

			const response = await fetch(`${backendUrl}/api/v1/channels`, {
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
					{ error: 'Failed to create channel', details: errorText },
					{ status: response.status },
				)
			}

			const data = await response.json()
			return NextResponse.json(data)
		})
	} catch (error) {
		console.error('Create channel proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
