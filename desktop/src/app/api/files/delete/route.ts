import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function DELETE(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const fileId = body.file_id

		if (!fileId) {
			return NextResponse.json(
				{ error: 'File ID is required' },
				{ status: 400 },
			)
		}

		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/files/delete`, {
			method: 'DELETE',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({
				access_token: token,
				file_id: fileId,
			}),
		})

		if (!res.ok) {
			const errorText = await res.text()
			return NextResponse.json(
				{ error: 'Failed to delete file', details: errorText },
				{ status: res.status },
			)
		}

		const data = await res.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('File delete proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
