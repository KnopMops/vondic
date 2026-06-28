import { fetchBackend, getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		let body: any = {}
		try {
			body = await req.json()
		} catch (e) {
			
		}

		const payload = { ...body, access_token: token }

		const response = await fetchBackend('/api/v1/friends/list', {
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

		const sanitized = friends.map((friend: any) => {
			if (friend.privacy_settings?.show_email === true) {
				return friend
			}
			const { email: _e, ...rest } = friend
			return rest
		})

		return NextResponse.json(sanitized)
	} catch (error) {
		console.error('Friends list proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
