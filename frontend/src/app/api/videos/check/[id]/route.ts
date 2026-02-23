import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
	process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

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
