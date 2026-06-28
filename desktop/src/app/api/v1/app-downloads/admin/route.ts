import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { withVondicProxyHeaders } from '@/lib/proxy-headers'
import { getBackendUrl } from '@/lib/server-urls'

async function authHeaders(req: NextRequest): Promise<Record<string, string>> {
	let token = await getAccessToken(req)
	if (!token) {
		const auth = req.headers.get('authorization') || ''
		if (auth.startsWith('Bearer ')) token = auth.slice(7).trim()
	}
	const headers: Record<string, string> = {}
	if (token) headers.Authorization = `Bearer ${token}`
	return headers
}

export async function GET(req: NextRequest) {
	try {
		const backendUrl = getBackendUrl().replace(/\/$/, '')
		const res = await fetch(`${backendUrl}/api/v1/app-downloads/admin`, {
			headers: withVondicProxyHeaders(await authHeaders(req)),
			cache: 'no-store',
		})
		const text = await res.text()
		try {
			return NextResponse.json(JSON.parse(text), { status: res.status })
		} catch {
			return NextResponse.json(
				{ error: text || 'Invalid backend response' },
				{ status: res.status },
			)
		}
	} catch (error: unknown) {
		console.error('[app-downloads admin GET]', error)
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : 'Internal Server Error',
			},
			{ status: 500 },
		)
	}
}

export async function PUT(req: NextRequest) {
	try {
		const backendUrl = getBackendUrl().replace(/\/$/, '')
		const headers = await authHeaders(req)
		headers['Content-Type'] = 'application/json'
		const res = await fetch(`${backendUrl}/api/v1/app-downloads/admin`, {
			method: 'PUT',
			headers: withVondicProxyHeaders(headers),
			body: await req.text(),
		})
		const text = await res.text()
		try {
			return NextResponse.json(JSON.parse(text), { status: res.status })
		} catch {
			return NextResponse.json(
				{ error: text || 'Invalid backend response' },
				{ status: res.status },
			)
		}
	} catch (error: unknown) {
		console.error('[app-downloads admin PUT]', error)
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : 'Internal Server Error',
			},
			{ status: 500 },
		)
	}
}
