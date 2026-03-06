import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const { query } = await req.json()
		const token = await getAccessToken(req)

		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5000'

		const response = await fetch(`${socketUrl}/chats/search`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				token,
				query,
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			// If 404 or other errors, return empty array or propagate error
			// For search, usually empty array is better if not found, but let's propagate status
			return NextResponse.json(
				{ error: 'Failed to search chats', details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('Chat search proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
