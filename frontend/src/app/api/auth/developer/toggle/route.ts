import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const body = await req.json().catch(() => ({}))
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		const res = await fetch(
			`${backendUrl}/api/public/v1/account/developer/toggle`,
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ ...body, access_token: token }),
			},
		)

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
