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
		const page = body.page || 1
		const perPage = body.per_page || 20

		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/files/list`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				access_token: token,
				page,
				per_page: perPage,
			}),
		})

		if (!res.ok) {
			const errorText = await res.text()
			return NextResponse.json(
				{ error: 'Failed to fetch files', details: errorText },
				{ status: res.status },
			)
		}

		const data = await res.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('Files list proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
