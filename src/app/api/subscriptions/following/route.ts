import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		const payload = { ...body, access_token: token }

		// 1. Fetch following list
		const response = await fetch(
			`${backendUrl}/api/v1/subscriptions/following`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(payload),
			},
		)

		if (!response.ok) {
			const text = await response.text()
			try {
				const data = JSON.parse(text)
				return NextResponse.json(data, { status: response.status })
			} catch {
				return NextResponse.json(
					{ error: text || 'Error fetching following' },
					{ status: response.status },
				)
			}
		}

		const followingData = await response.json()
		const following = Array.isArray(followingData) ? followingData : []

		// 2. Fetch all users to enrich data (since following list might miss avatar/details)
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

		// 3. Enrich following list
		const enrichedFollowing = following.map((item: any) => {
			// Assume item is a user object or has an id field
			const userId = item.id
			const userDetails = usersMap[userId]

			if (userDetails) {
				return {
					...item,
					...userDetails, // Overwrite with full user details
					avatar_url: userDetails.avatar_url || item.avatar_url,
					username: userDetails.username || item.username,
					email: userDetails.email || item.email,
				}
			}
			return item
		})

		return NextResponse.json(enrichedFollowing)
	} catch (error) {
		console.error('Subscriptions following proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
