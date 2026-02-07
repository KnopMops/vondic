import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
	process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

export async function PUT(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const accessToken = await getAccessToken(req)
		if (!accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const body = await req.json()
		const { title, content } = body

		// Backend expects PUT at /api/v1/posts/ with post_id in body
		const response = await fetch(`${BACKEND_URL}/api/v1/posts/`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				access_token: accessToken,
				post_id: id,
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
		return NextResponse.json(data)
	} catch (error) {
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
		const accessToken = await getAccessToken(req)
		if (!accessToken) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const body = await req.json()
		const { user_id, reason } = body

		if (!user_id) {
			return NextResponse.json(
				{ error: 'user_id is required' },
				{ status: 400 },
			)
		}

		let url = `${BACKEND_URL}/api/v1/posts/`
		const requestBody: any = {
			access_token: accessToken,
			post_id: id,
			user_id,
		}

		if (reason) {
			url = `${BACKEND_URL}/api/v1/posts/admin`
			requestBody.reason = reason
		}

		const response = await fetch(url, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(requestBody),
		})

		if (!response.ok) {
			const errorText = await response.text()
			return NextResponse.json(
				{ error: errorText },
				{ status: response.status },
			)
		}

		return NextResponse.json({ message: 'Post deleted' })
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
