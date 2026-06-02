import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

type RouteCtx = {
	params: Promise<{ path: string[] }>
}

/** Hop-by-hop and Next-incompatible headers not forwarded from upstream. */
const DROP_RESPONSE_HEADERS = new Set([
	'connection',
	'keep-alive',
	'proxy-connection',
	'transfer-encoding',
	'te',
	'trailer',
	'upgrade',
])

async function proxyApiV1(req: NextRequest, pathSegments: string[] | undefined, method: string) {
	const backend = getBackendUrl().replace(/\/$/, '')
	const sub = Array.isArray(pathSegments) && pathSegments.length ? pathSegments.join('/') : ''
	const upstreamPath = sub ? `/api/v1/${sub}` : '/api/v1'
	const url = `${backend}${upstreamPath}${req.nextUrl.search}`

	const forwardHeaders = new Headers()
	const passRequest = ['content-type', 'accept', 'accept-language', 'x-requested-with']
	for (const name of passRequest) {
		const v = req.headers.get(name)
		if (v) forwardHeaders.set(name, v)
	}

	// Auth: cookies (desktop) or Bearer header (mobile)
	let token = await getAccessToken(req)
	if (token) {
		forwardHeaders.set('Authorization', `Bearer ${token}`)
	}

	let body: ArrayBuffer | undefined
	if (!['GET', 'HEAD'].includes(method)) {
		body = await req.arrayBuffer()
	}

	let upstream: Response
	try {
		upstream = await fetch(url, {
			method,
			headers: forwardHeaders,
			body,
			redirect: 'manual',
		})
	} catch (e) {
		console.error('[api/v1 proxy] upstream fetch failed:', e)
		return NextResponse.json({ error: 'Upstream unavailable' }, { status: 502 })
	}

	const resHeaders = new Headers()
	upstream.headers.forEach((value, key) => {
		const k = key.toLowerCase()
		if (k === 'set-cookie' || DROP_RESPONSE_HEADERS.has(k)) return
		resHeaders.append(key, value)
	})
	for (const c of upstream.headers.getSetCookie()) {
		resHeaders.append('Set-Cookie', c)
	}

	const buf = await upstream.arrayBuffer()
	return new NextResponse(buf, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: resHeaders,
	})
}

export async function GET(req: NextRequest, ctx: RouteCtx) {
	const { path } = await ctx.params
	return proxyApiV1(req, path, 'GET')
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
	const { path } = await ctx.params
	return proxyApiV1(req, path, 'POST')
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
	const { path } = await ctx.params
	return proxyApiV1(req, path, 'PUT')
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
	const { path } = await ctx.params
	return proxyApiV1(req, path, 'DELETE')
}

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
	const { path } = await ctx.params
	return proxyApiV1(req, path, 'PATCH')
}

export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
			'Access-Control-Allow-Headers':
				'Content-Type, Authorization, Cookie, Accept, Accept-Language, X-Requested-With',
		},
	})
}
