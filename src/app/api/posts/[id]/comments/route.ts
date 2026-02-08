import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
	process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

export async function GET(
	request: NextRequest,
	{ params }: { params: { id: string } },
) {
	const { id } = await params
	const accessToken = await getAccessToken(request)

	try {
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
		}
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`
		}

		const res = await fetch(`${BACKEND_URL}/api/v1/posts/${id}/comments`, {
			method: 'GET',
			headers,
		})

		if (res.ok) {
			const comments = await res.json()

			// Fetch users to map author info
			const usersResponse = await fetch(`${BACKEND_URL}/api/v1/users/`, {
				method: 'GET',
				headers, // Use the same headers with token if available
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

			// Merge data
			const enrichedComments = Array.isArray(comments)
				? comments.map((comment: any) => {
						const userId =
							comment.user_id || comment.posted_by || comment.author_id
						const author = usersMap[userId]
						return {
							...comment,
							user_id: userId,
							author_name: author?.username || `User ${userId || '?'}`,
							author_avatar: author?.avatar_url || null,
						}
					})
				: []

			return NextResponse.json(enrichedComments)
		} else {
			return NextResponse.json(
				{ error: 'Failed to fetch comments' },
				{ status: res.status },
			)
		}
	} catch (error) {
		console.error('Error fetching comments:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function POST(
	request: NextRequest,
	{ params }: { params: { id: string } },
) {
	const { id } = await params
	const accessToken = await getAccessToken(request)

	if (!accessToken) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { content, parent_id } = body

		const payload: any = {
			access_token: accessToken,
			post_id: id,
			content,
		}

		if (parent_id) {
			payload.parent_id = parent_id
		}

		const res = await fetch(`${BACKEND_URL}/api/v1/posts/comment`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(payload),
		})

		if (res.ok) {
			// Backend might return "Comment created" message or the comment object.
			// Docs say 201 "Comment created".
			// We might want to return success or refetch.
			return NextResponse.json({ success: true }, { status: 201 })
		} else {
			const errorText = await res.text()
			return NextResponse.json({ error: errorText }, { status: res.status })
		}
	} catch (error) {
		console.error('Error creating comment:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
