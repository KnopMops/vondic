import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
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
		let response = await fetch(
			`${backendUrl}/api/v1/support/admin/escalations`,
			{
				method: 'GET',
				headers: {
					Authorization: `Bearer ${token}`,
				},
			},
		)
		// If backend route not found or not OK, fallback immediately to legacy
		if (!response.ok) {
			const legacyUrl =
				process.env.NEXT_PUBLIC_SUPPORT_API_URL || 'http://127.0.0.1:8000'
			response = await fetch(`${legacyUrl}/admin/updates`, { method: 'GET' })
		}
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
