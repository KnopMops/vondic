import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
		// role guard
		const meRes = await fetch(`${backendUrl}/api/v1/auth/me`, {
			method: 'GET',
			headers: { Authorization: `Bearer ${token}` },
		})
		const me = await meRes.json().catch(() => ({}))
		const role = me?.user?.role || me?.role
		if (role !== 'Admin' && role !== 'Support') {
			return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
		}
		const body = await req.json().catch(() => ({}))
		const response = await fetch(
			`${backendUrl}/api/v1/support/admin/post-reports/action`,
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify(body),
			},
		)
		const text = await response.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: response.status })
		} catch {
			return NextResponse.json(
				{ error: 'Invalid backend response', raw: text },
				{ status: 500 },
			)
		}
	} catch (error) {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
