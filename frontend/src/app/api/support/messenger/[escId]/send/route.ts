import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(
	req: NextRequest,
	{ params }: { params: Promise<{ escId: string }> },
) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const { escId } = await params
		const body = await req.json().catch(() => ({}))
		const backendUrl = getBackendUrl()
		const response = await fetch(
			`${backendUrl}/api/v1/support/messenger/${escId}/send`,
			{
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			},
		)
		const text = await response.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: response.status })
		} catch {
			return NextResponse.json({ error: 'Invalid backend response', raw: text }, { status: 500 })
		}
	} catch (error) {
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
