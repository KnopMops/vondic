import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { withVondicProxyHeaders } from '@/lib/proxy-headers'
import { getBackendUrl } from '@/lib/server-urls'

async function proxyV1(
	request: NextRequest,
	path: string[],
	method: string,
) {
	try {
		const backendUrl = getBackendUrl().replace(/\/$/, '')
		const sub = path.join('/')
		const targetUrl = new URL(`${backendUrl}/api/v1/${sub}`)

		request.nextUrl.searchParams.forEach((value, key) => {
			targetUrl.searchParams.set(key, value)
		})

		let token = await getAccessToken(request)
		if (!token) {
			const auth = request.headers.get('authorization') || ''
			if (auth.startsWith('Bearer ')) token = auth.slice(7).trim()
		}

		const headers: Record<string, string> = {}
		if (token) headers.Authorization = `Bearer ${token}`
		if (method !== 'GET' && method !== 'HEAD') {
			const ct = request.headers.get('content-type')
			if (ct) headers['Content-Type'] = ct
		}

		const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
			|| request.headers.get('x-real-ip')
			|| request.headers.get('x-forwarded-for')
		if (clientIp) {
			headers['X-Forwarded-For'] = clientIp
			headers['X-Real-IP'] = clientIp
		}

		const response = await fetch(targetUrl.toString(), {
			method,
			headers: withVondicProxyHeaders(headers) as Record<string, string>,
			body:
				method === 'GET' || method === 'HEAD'
					? undefined
					: await request.text(),
		})

		const text = await response.text()
		try {
			return NextResponse.json(JSON.parse(text), { status: response.status })
		} catch {
			return NextResponse.json(
				{ error: text || 'Invalid backend response' },
				{ status: response.status },
			)
		}
	} catch (error: unknown) {
		console.error('[API v1 proxy]', path.join('/'), error)
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : 'Internal Server Error',
			},
			{ status: 500 },
		)
	}
}

type Ctx = { params: Promise<{ path?: string[] }> }

export async function GET(req: NextRequest, ctx: Ctx) {
	const { path } = await ctx.params
	return proxyV1(req, path || [], 'GET')
}

export async function POST(req: NextRequest, ctx: Ctx) {
	const { path } = await ctx.params
	return proxyV1(req, path || [], 'POST')
}

export async function PUT(req: NextRequest, ctx: Ctx) {
	const { path } = await ctx.params
	return proxyV1(req, path || [], 'PUT')
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
	const { path } = await ctx.params
	return proxyV1(req, path || [], 'DELETE')
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
	const { path } = await ctx.params
	return proxyV1(req, path || [], 'PATCH')
}
