import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

const BACKEND_URL = getBackendUrl()

export async function PUT(request: NextRequest) {
	const accessToken = await getAccessToken(request)
	if (!accessToken) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { comment_id, content } = body

		const res = await fetch(`${BACKEND_URL}/api/v1/comments/`, {
			method: 'PUT',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify({
				access_token: accessToken,
				comment_id,
				content,
			}),
		})

		if (res.ok) {
			return NextResponse.json({ success: true })
		} else {
			const errorText = await res.text()
			return NextResponse.json({ error: errorText }, { status: res.status })
		}
	} catch (error) {
		console.error('Error updating comment:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function DELETE(request: NextRequest) {
	const accessToken = await getAccessToken(request)
	if (!accessToken) {
		return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
	}

	try {
		const body = await request.json()
		const { comment_id, reason, user_id, isAdmin } = body

		let url = `${BACKEND_URL}/api/v1/comments/`
		const payload: any = {
			comment_id,
			user_id,
			access_token: accessToken,
		}

		if (isAdmin) {
			url = `${BACKEND_URL}/api/v1/comments/admin`
			payload.reason = reason
		}

		const res = await fetch(url, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${accessToken}`,
			},
			body: JSON.stringify(payload),
		})

		if (res.ok) {
			return NextResponse.json({ success: true })
		} else {
			const errorText = await res.text()
			return NextResponse.json({ error: errorText }, { status: res.status })
		}
	} catch (error) {
		console.error('Error deleting comment:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
