import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function DELETE(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const backendUrl = getBackendUrl()

		const payload = { ...body, access_token: token }

		const response = await fetch(`${backendUrl}/api/v1/users/delete`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(payload),
		})

		const text = await response.text()
		let data: any = {}
		try {
			data = JSON.parse(text)
		} catch {
			data = { message: text }
		}

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status })
		}

		return NextResponse.json(data, { status: 200 })
	} catch (error) {
		console.error('Delete account proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
