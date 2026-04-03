import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params
		const token = await getAccessToken(req)

		
		const body: any = { user_id: id }
		if (token) {
			body.access_token = token
		}

		const backendUrl = getBackendUrl()

		const response = await fetch(`${backendUrl}/api/v1/users/get`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		if (!response.ok) {
			const text = await response.text()
			try {
				const data = JSON.parse(text)
				return NextResponse.json(data, { status: response.status })
			} catch {
				return NextResponse.json(
					{ error: text || 'User not found' },
					{ status: response.status },
				)
			}
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('Get user proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
