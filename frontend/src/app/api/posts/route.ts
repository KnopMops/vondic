import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
	process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const page = searchParams.get('page')
		const perPage = searchParams.get('per_page')
		const userId = searchParams.get('user_id')

		const accessToken = await getAccessToken(req)
		const headers: HeadersInit = {
			'Content-Type': 'application/json',
		}
		if (accessToken) {
			headers['Authorization'] = `Bearer ${accessToken}`
		}

		// 1. Fetch posts
		const backendUrl = new URL(`${BACKEND_URL}/api/v1/posts/`)
		if (page) backendUrl.searchParams.set('page', page)
		if (perPage) backendUrl.searchParams.set('per_page', perPage)
		if (userId) backendUrl.searchParams.set('user_id', userId)

		const postsResponse = await fetch(backendUrl.toString(), {
			method: 'GET',
			headers,
			cache: 'no-store',
		})

		if (!postsResponse.ok) {
			const errorText = await postsResponse.text()
			return NextResponse.json(
				{ error: errorText },
				{ status: postsResponse.status },
			)
		}

		const postsPayload = await postsResponse.json()
		const items = Array.isArray(postsPayload)
			? postsPayload
			: postsPayload.items || postsPayload.posts || []

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
		const enrichedPosts = Array.isArray(items)
			? items.map((post: any) => {
					const author = usersMap[post.posted_by]
					return {
						...post,
						author_name: author?.username || 'Unknown User',
						author_avatar: author?.avatar_url || null,
						author_premium: !!author?.premium,
						is_liked: post.is_liked || post.liked || post.has_liked || false,
						likes: post.likes || post.like_count || 0,
					}
				})
			: []

		return NextResponse.json({
			items: enrichedPosts,
			total: postsPayload.total ?? enrichedPosts.length,
			pages: postsPayload.pages ?? 1,
			page: postsPayload.page ?? Number(page || 1),
			per_page: postsPayload.per_page ?? Number(perPage || enrichedPosts.length || 0),
		})
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
		const { title, content, attachments } = body

		const response = await fetch(`${BACKEND_URL}/api/v1/posts/`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				access_token: accessToken,
				title,
				content,
				attachments,
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
