import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		// Using POST /friends/list for requests based on user instructions if they meant list=requests?
		// Or maybe they meant requests is still requests but POST.
		// The user said: "теперь получить заявки в друзья ... это POST ... /friends/list"
		// This strongly suggests using /friends/list for "getting requests".
		// But "list" usually implies friends.
		// I'll try to use /api/v1/friends/list FIRST as requested.
		// Wait, if /friends/list returns FRIENDS, and I need REQUESTS, this is wrong.
		// But the user mapped "получить заявки в друзья" (get requests) to "/friends/list".
		// I will assume the user knows their backend.
		// But I'll double check if there's a separate requests endpoint.
		// If I look at the text: "получить заявки в друзья (get requests) ... /friends/list".
		// Maybe the list endpoint returns both or filters?
		// I'll use /api/v1/friends/list for now. If it returns friends instead of requests, I'll switch back.
		// Actually, I'll create a NEW route file for "list" and update the "requests" file to point to "requests" (POST).
		// Wait, the user listed "/friends/list" under "получить заявки в друзья".
		// Let's assume the user made a mistake in naming or the endpoint is indeed /friends/list.
		// I will target /api/v1/friends/list.

		const response = await fetch(`${backendUrl}/api/v1/friends/list`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({ access_token: token }),
		})

		if (!response.ok) {
			const text = await response.text()
			try {
				const data = JSON.parse(text)
				return NextResponse.json(data, { status: response.status })
			} catch {
				return NextResponse.json(
					{ error: text || 'Error fetching requests' },
					{ status: response.status },
				)
			}
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('Friends requests proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
