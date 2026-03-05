import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const backendUrl = getBackendUrl()

		const payload = { ...body, access_token: token }

		// 1. Fetch followers list
		const response = await fetch(
			`${backendUrl}/api/v1/subscriptions/followers`,
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
					{ error: text || 'Error fetching followers' },
					{ status: response.status },
				)
			}
		}

		const followersData = await response.json()
		const followers = Array.isArray(followersData) ? followersData : []

		// 2. Fetch all users to enrich data (since followers list might miss avatar/details)
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

		// 3. Enrich followers list
		const enrichedFollowers = followers.map((item: any) => {
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

		return NextResponse.json(enrichedFollowers)
	} catch (error) {
		console.error('Subscriptions followers proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
