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
		const following = Array.isArray(followingData)
			? followingData
			: Array.isArray(followingData?.following)
				? followingData.following
				: []

		const sanitized = following.map((item: any) => {
			if (item.privacy_settings?.show_email === true) {
				return item
			}
			const { email: _e, ...rest } = item
			return rest
		})

		return NextResponse.json(sanitized)
	} catch (error) {
		console.error('Subscriptions following proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
