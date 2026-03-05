import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

const BACKEND_URL = getBackendUrl()

export async function GET(
	req: NextRequest,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const { id } = await params
		const res = await fetch(`${BACKEND_URL}/api/v1/videos/check/${id}`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
		const text = await res.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: res.status })
		} catch {
			return NextResponse.json({ error: text }, { status: res.status })
		}
	} catch (e: any) {
		return NextResponse.json(
			{ error: e?.message || 'Check status failed' },
			{ status: 500 },
		)
	}
}
