import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const token = await getAccessToken(req)
		// Allowing public access to posts if token is missing?
		// Usually posts might be public, but let's send token if available.
		// User didn't specify auth requirement for this GET, but usually needed for 'is_liked' status etc.

		const { id } = await params
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		}
		if (token) {
			headers['Authorization'] = `Bearer ${token}`
		}

		const response = await fetch(`${backendUrl}/api/v1/posts/${id}`, {
			method: 'GET',
			headers: headers,
		})

		if (!response.ok) {
			const text = await response.text()
			try {
				const data = JSON.parse(text)
				return NextResponse.json(data, { status: response.status })
			} catch {
				return NextResponse.json(
					{ error: text || 'Error fetching post' },
					{ status: response.status },
				)
			}
		}

		const data = await response.json()

		// Enrich with author info if needed (like avatar)
		// If author details are missing but we have posted_by, fetch the user.
		if (data && data.posted_by && (!data.author_name || !data.author_avatar)) {
			try {
				// Use the correct backend endpoint for fetching user details: POST /api/v1/users/get
				const userRes = await fetch(`${backendUrl}/api/v1/users/get`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						user_id: data.posted_by,
						access_token: token,
					}),
				})
				if (userRes.ok) {
					const userData = await userRes.json()
					// API might return { user: ... } or just user object.
					const author = userData.user || userData

					// Merge author details
					if (author) {
						data.author_details = author
						data.author_name = author.username || data.author_name
						data.author_avatar = author.avatar_url || data.author_avatar
					}
				}
			} catch (e) {
				console.error('Failed to enrich post author', e)
			}
		}

		return NextResponse.json(data)
	} catch (error) {
		console.error('Get post proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
