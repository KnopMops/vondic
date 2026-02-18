import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ groupId: string }> },
) {
	try {
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		return await withAccessTokenRefresh(req, async token => {
			const body = await req.json()
			const { groupId } = await params

			const response = await fetch(
				`${backendUrl}/api/v1/groups/${groupId}/participants`,
				{
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`,
					},
					body: JSON.stringify({ ...body, access_token: token }),
				},
			)

			if (!response.ok) {
				const errorText = await response.text()
				return NextResponse.json(
					{ error: 'Failed to add participant', details: errorText },
					{ status: response.status },
				)
			}

			const data = await response.json()
			return NextResponse.json(data)
		})
	} catch (error) {
		console.error('Add participant proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ groupId: string }> },
) {
	try {
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		return await withAccessTokenRefresh(req, async token => {
			const { groupId } = await params

			const response = await fetch(
				`${backendUrl}/api/v1/groups/${groupId}/participants`,
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
		console.error('Get participants proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
