import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

const BACKEND_URL = getBackendUrl()

export async function POST(
	request: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	const { id } = await params

	// Get token from cookies
	const accessToken = await getAccessToken(request)
	if (!accessToken) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { action } = body // 'like' or 'unlike'

		const endpoint =
			action === 'unlike' ? '/api/v1/posts/unlike' : '/api/v1/posts/like'

		const res = await fetch(`${BACKEND_URL}${endpoint}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				access_token: accessToken,
				post_id: id,
			}),
		})

		if (res.ok) {
			return NextResponse.json({ success: true })
		} else {
			// If 404, post not found. If 400, maybe already liked?
			// Backend docs say 400 for invalid params.
			const errorText = await res.text()
			// If we try to like and it's already liked, backend might return error or success.
			// We'll just return what backend says.
			return NextResponse.json({ error: errorText }, { status: res.status })
		}
	} catch (error) {
		console.error('Error toggling like:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
