import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
	process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

export async function GET(req: NextRequest) {
	try {
		const accessToken = await getAccessToken(req)
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
		}
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`
		}

		// 1. Fetch posts
		const postsResponse = await fetch(`${BACKEND_URL}/api/v1/posts/`, {
			method: 'GET',
			headers,
		})

		if (!postsResponse.ok) {
			const errorText = await postsResponse.text()
			return NextResponse.json(
				{ error: errorText },
				{ status: postsResponse.status },
			)
		}

		const posts = await postsResponse.json()

		// 2. Fetch users (to map authors)
		// We try to fetch all users to map names/avatars.
		// In a real production app, this should be paginated or optimized (e.g. fetch by IDs).
		const usersResponse = await fetch(`${BACKEND_URL}/api/v1/users/`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
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

		// 3. Merge data
		const enrichedPosts = Array.isArray(posts)
			? posts.map((post: any) => {
					const author = usersMap[post.posted_by]
					return {
						...post,
						author_name: author?.username || 'Unknown User',
						author_avatar: author?.avatar_url || null,
						// Ensure we keep original fields but mapped for frontend convenience if needed
					}
				})
			: []

		return NextResponse.json(enrichedPosts)
	} catch (error) {
		console.error('Error fetching posts:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function POST(req: NextRequest) {
	try {
		const accessToken = await getAccessToken(req)
		if (!accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json()
		const { title, content } = body

		const response = await fetch(`${BACKEND_URL}/api/v1/posts/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				access_token: accessToken,
				title,
				content,
			}),
		})

		if (!response.ok) {
			const errorText = await response.text()
			return NextResponse.json(
				{ error: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data, { status: 201 })
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
