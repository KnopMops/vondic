import { NextResponse } from 'next/server'
import { withVondicProxyHeaders } from '@/lib/proxy-headers'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET() {
	try {
		const backendUrl = getBackendUrl().replace(/\/$/, '')
		const res = await fetch(`${backendUrl}/api/v1/app-downloads/`, {
			headers: withVondicProxyHeaders(),
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
		console.error('[app-downloads proxy]', error)
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : 'Internal Server Error',
			},
			{ status: 500 },
		)
	}
}
