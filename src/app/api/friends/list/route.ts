import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		const payload = { access_token: token }

		const response = await fetch(`${backendUrl}/api/v1/friends/list`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})

		if (!response.ok) {
			const text = await response.text()
			try {
				const data = JSON.parse(text)
				return NextResponse.json(data, { status: response.status })
			} catch {
				return NextResponse.json(
					{ error: text || 'Error fetching friends' },
					{ status: response.status },
				)
			}
		}

		const friendsData = await response.json()
		const friends = Array.isArray(friendsData) ? friendsData : []

		// Fetch all users to enrich data just in case friends list is also missing details
		// We reuse the token for this request as well
		const usersResponse = await fetch(`${backendUrl}/api/v1/users/`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
		})

		let usersMap: Record<string, any> = {}
		if (usersResponse.ok) {
			const users = await usersResponse.json()
			if (Array.isArray(users)) {
				users.forEach((u: any) => {
					usersMap[u.id] = u
				})
			}
		}

		const enrichedFriends = friends.map((friend: any) => {
			const userId = friend.id || friend.friend_id
			const userDetails = usersMap[userId]

			if (userDetails) {
				return {
					...friend,
					...userDetails,
					avatar_url: userDetails.avatar_url || friend.avatar_url,
					username: userDetails.username || friend.username,
					email: userDetails.email || friend.email,
				}
			}
			return friend
		})

		return NextResponse.json(enrichedFriends)
	} catch (error) {
		console.error('Friends list proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
