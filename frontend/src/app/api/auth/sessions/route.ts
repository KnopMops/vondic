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
		const res = await fetch(`${backendUrl}/api/v1/auth/device-sessions`, {
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

export async function POST(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/device-sessions/terminate-others`, {
			method: 'POST',
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

export async function DELETE(req: NextRequest) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const { searchParams } = new URL(req.url)
		const sessionId = searchParams.get('id')
		if (!sessionId) {
			return NextResponse.json({ error: 'Session ID is required' }, { status: 400 })
		}
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/device-sessions/${sessionId}`, {
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
