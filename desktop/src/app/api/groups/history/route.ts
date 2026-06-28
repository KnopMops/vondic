import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getWebrtcUrl } from '@/lib/server-urls'

export async function DELETE(req: NextRequest) {
	try {
		let body: Record<string, unknown> = {}
		try {
			body = await req.json()
		} catch {
			body = {}
		}
		const group_id = body.group_id as string | undefined
		const scope = (body.scope as string | undefined) || 'for_all'
		const token =
			(await getAccessToken(req)) ||
			(body.access_token as string | undefined) ||
			(body.token as string | undefined)

		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		if (!group_id) {
			return NextResponse.json({ error: 'group_id required' }, { status: 400 })
		}

		const socketUrl = getWebrtcUrl()
		const response = await fetch(`${socketUrl}/groups/history`, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token, group_id, scope }),
		})

		if (!response.ok) {
			const errorText = await response.text()
			return NextResponse.json(
				{ error: 'Failed to delete group history', details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('Group history delete proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
