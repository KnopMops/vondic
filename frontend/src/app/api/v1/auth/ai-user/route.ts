import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	try {
		const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
		const response = await fetch(`${backendUrl}/api/v1/auth/ai-user`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		})

		if (!response.ok) {
			const errorText = await response.text()
			return NextResponse.json(
				{ error: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('[API] Internal error fetching AI user:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
