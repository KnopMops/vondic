import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

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
		const backendUrl = getBackendUrl()

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

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params
		const accessToken = await getAccessToken(req)
		if (!accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const { user_id, reason } = body || {}

		if (!user_id) {
			return NextResponse.json(
				{ error: 'user_id is required' },
				{ status: 400 },
			)
		}

		const backendUrl = getBackendUrl()

		const isAdminDelete = typeof reason === 'string' && reason.trim().length > 0
		const endpoint = isAdminDelete
			? `${backendUrl}/api/v1/posts/admin`
			: `${backendUrl}/api/v1/posts/`

		const payload = isAdminDelete
			? {
					access_token: accessToken,
					post_id: id,
					user_id,
					reason,
				}
			: {
					access_token: accessToken,
					post_id: id,
					user_id,
				}

		const res = await fetch(endpoint, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(payload),
		})

		const text = await res.text()
		let data: any = {}
		try {
			data = JSON.parse(text)
		} catch {
			data = { message: text }
		}

		if (!res.ok) {
			return NextResponse.json(data, { status: res.status })
		}

		return NextResponse.json(data, { status: 200 })
	} catch (error) {
		console.error('Delete post proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params
		const accessToken = await getAccessToken(req)
		if (!accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const { content, attachments, is_blog } = body || {}

		const payload: Record<string, any> = {
			access_token: accessToken,
			post_id: id,
		}

		if (typeof content === 'string') {
			payload.content = content
		}
		if (Array.isArray(attachments)) {
			payload.attachments = attachments
		}
		if (typeof is_blog !== 'undefined') {
			payload.is_blog = is_blog
		}

		const backendUrl = getBackendUrl()

		const res = await fetch(`${backendUrl}/api/v1/posts/`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(payload),
		})

		const text = await res.text()
		let data: any = {}
		try {
			data = JSON.parse(text)
		} catch {
			data = { message: text }
		}

		if (!res.ok) {
			return NextResponse.json(data, { status: res.status })
		}

		return NextResponse.json(data, { status: 200 })
	} catch (error) {
		console.error('Update post proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
