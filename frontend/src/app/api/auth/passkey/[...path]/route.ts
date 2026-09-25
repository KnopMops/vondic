import { setTokens } from '@/lib/auth.utils'
import { withVondicProxyHeaders } from '@/lib/proxy-headers'
import { getBackendUrl } from '@/lib/server-urls'
import { NextRequest, NextResponse } from 'next/server'

interface RouteParams {
	params: Promise<{ path?: string[] }> | { path?: string[] }
}

async function proxyPasskey(req: NextRequest, params: { path?: string[] }) {
	try {
		const pathSegments = params?.path || []
		const subpath = pathSegments.join('/')
		const backendUrl = getBackendUrl()
		const url = new URL(req.url)
		const targetUrl = `${backendUrl}/api/v1/auth/passkey/${subpath}${url.search}`

		const headers: Record<string, string> = {
			'User-Agent': req.headers.get('user-agent') || '',
			'X-Forwarded-For': req.headers.get('x-forwarded-for') || '',
			'X-Real-IP': req.headers.get('x-real-ip') || '',
		}

		const authHeader = req.headers.get('authorization')
		if (authHeader) {
			headers['Authorization'] = authHeader
		}

		let body: any = null
		if (req.method !== 'GET' && req.method !== 'HEAD') {
			headers['Content-Type'] = 'application/json'
			try {
				body = await req.json()
			} catch {
				body = {}
			}
		}

		const response = await fetch(targetUrl, {
			method: req.method,
			headers: withVondicProxyHeaders(headers),
			body: body ? JSON.stringify(body) : undefined,
		})

		const text = await response.text()
		let data: any = {}
		try {
			data = JSON.parse(text)
		} catch {
			data = { error: text || 'Passkey proxy error' }
		}

		if (!response.ok) {
			return NextResponse.json(data, { status: response.status })
		}

		const nextResponse = NextResponse.json(data)

		// Если выдан токен, сохраняем в cookies
		if (data?.access_token && data?.refresh_token) {
			return setTokens(nextResponse, data.access_token, data.refresh_token)
		}

		return nextResponse
	} catch (error) {
		console.error('Passkey proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function GET(req: NextRequest, ctx: RouteParams) {
	const params = await ctx.params
	return proxyPasskey(req, params)
}

export async function POST(req: NextRequest, ctx: RouteParams) {
	const params = await ctx.params
	return proxyPasskey(req, params)
}

export async function DELETE(req: NextRequest, ctx: RouteParams) {
	const params = await ctx.params
	return proxyPasskey(req, params)
}

export async function OPTIONS() {
	return new NextResponse(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		},
	})
}
