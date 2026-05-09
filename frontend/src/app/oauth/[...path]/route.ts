import { NextRequest, NextResponse } from 'next/server'

import { getBackendUrl } from '@/lib/server-urls'

export const runtime = 'nodejs'

type RouteCtx = {
	params: Promise<{ path?: string[] }>
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

async function proxyOAuth(req: NextRequest, pathSegments: string[] | undefined) {
	const backend = getBackendUrl().replace(/\/$/, '')
	const sub = Array.isArray(pathSegments) && pathSegments.length ? pathSegments.join('/') : ''
	const upstreamPath = sub ? `/oauth/${sub}` : '/oauth'
	const url = `${backend}${upstreamPath}${req.nextUrl.search}`

	const forwardHeaders = new Headers()
	const passRequest = ['cookie', 'authorization', 'content-type', 'accept', 'accept-language']
	for (const name of passRequest) {
		const v = req.headers.get(name)
		if (v) forwardHeaders.set(name, v)
	}

	let body: ArrayBuffer | undefined
	if (!['GET', 'HEAD'].includes(req.method)) {
		body = await req.arrayBuffer()
	}

	let upstream: Response
	try {
		upstream = await fetch(url, {
			method: req.method,
			headers: forwardHeaders,
			body,
			redirect: 'manual',
		})
	} catch (e) {
		console.error('[oauth proxy] upstream fetch failed:', e)
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
	return proxyOAuth(req, path)
}

export async function POST(req: NextRequest, ctx: RouteCtx) {
	const { path } = await ctx.params
	return proxyOAuth(req, path)
}

export async function HEAD(req: NextRequest, ctx: RouteCtx) {
	const { path } = await ctx.params
	return proxyOAuth(req, path)
}

export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
			'Access-Control-Allow-Headers':
				'Content-Type, Authorization, Cookie, Accept, Accept-Language',
		},
	})
}
