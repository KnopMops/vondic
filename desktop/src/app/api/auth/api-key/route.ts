import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const backendUrl = getBackendUrl()

		const res = await fetch(`${backendUrl}/api/public/v1/account/api-key`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify({ access_token: token }),
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

export async function GET(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const backendUrl = getBackendUrl()

		const res = await fetch(`${backendUrl}/api/public/v1/account/api-key`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			cache: 'no-store',
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
