import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	try {
		const accessToken = await getAccessToken(req)

		if (!accessToken) {
			return NextResponse.json({ user: null }, { status: 401 })
		}

		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		const response = await fetch(`${backendUrl}/api/v1/users/me`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${accessToken}`,
				'Content-Type': 'application/json',
			},
		})

		if (!response.ok) {
			const errorText = await response.text()
			return NextResponse.json(
				{ user: null, debug_error: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
