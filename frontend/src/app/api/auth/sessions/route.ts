import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/sessions`, {
			method: 'GET',
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
