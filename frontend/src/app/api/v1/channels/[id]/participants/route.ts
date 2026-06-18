import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const backendUrl = getBackendUrl()

		return await withAccessTokenRefresh(req, async token => {
			const { id } = await params

			const response = await fetch(
				`${backendUrl}/api/v1/channels/${id}/participants`,
				{
					method: 'GET',
					headers: {
						Authorization: `Bearer ${token}`,
					},
				},
			)

			if (!response.ok) {
				const errorText = await response.text()
				return NextResponse.json(
					{ error: 'Failed to fetch participants', details: errorText },
					{ status: response.status },
				)
			}

			const data = await response.json()
			return NextResponse.json(data)
		})
	} catch (error) {
		console.error('Get channel participants proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
