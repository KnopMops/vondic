import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function DELETE(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const { id } = await params
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/device-sessions/${id}`, {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}` },
		})
		const text = await res.text()
		let data: any = {}
		try {
			data = JSON.parse(text)
		} catch {
			data = { error: text }
		}
		return NextResponse.json(data, { status: res.status })
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
