import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
	const { action } = await params
	const { searchParams } = req.nextUrl
	const backendUrl = getBackendUrl()

	if (action === 'check') {
		const escId = searchParams.get('id')
		const token = searchParams.get('token')
		if (!escId || !token) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
		const res = await fetch(`${backendUrl}/api/v1/support/anon/${escId}/check?token=${token}`)
		return NextResponse.json(await res.json())
	}

	if (action === 'messages') {
		const escId = searchParams.get('id')
		const token = searchParams.get('token')
		if (!escId || !token) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
		const sinceId = searchParams.get('since_id') || '0'
		const res = await fetch(`${backendUrl}/api/v1/support/anon/${escId}/messages?token=${token}&since_id=${sinceId}`)
		return NextResponse.json(await res.json())
	}

	return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
	const { action } = await params
	const body = await req.json()
	const backendUrl = getBackendUrl()

	if (action === 'create') {
		const res = await fetch(`${backendUrl}/api/v1/support/anon/create`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
		})
		return NextResponse.json(await res.json())
	}

	if (action === 'send') {
		const { id, token, message } = body
		if (!id || !token || !message) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
		const res = await fetch(`${backendUrl}/api/v1/support/anon/${id}/send`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ token, message }),
		})
		return NextResponse.json(await res.json())
	}

	return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
