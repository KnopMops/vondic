import { NextRequest, NextResponse } from 'next/server'
import { getWebrtcUrl } from '@/lib/server-urls'

type RouteParams = {
	params: Promise<{
		path: string[]
	}>
}

async function proxyToWebRTC(req: NextRequest, params: { path: string[] }) {
	const webrtcUrl = getWebrtcUrl()
	const path = Array.isArray(params.path) ? params.path.join('/') : ''
	const targetUrl = `${webrtcUrl}/${path}`
	const contentType = req.headers.get('content-type') || 'application/json'
	
	// Forward important headers from the request
	const authorization = req.headers.get('authorization')
	const origin = req.headers.get('origin')
	
	const headers: Record<string, string> = {
		'Content-Type': contentType,
	}
	
	if (authorization) {
		headers['Authorization'] = authorization
	}
	
	const response = await fetch(targetUrl, {
		method: req.method,
		headers,
		body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
	})

	const text = await response.text()
	
	// Build response headers with CORS
	const responseHeaders: Record<string, string> = {
		'Content-Type': response.headers.get('Content-Type') || 'application/json',
	}
	
	// Forward CORS headers from backend if present
	const allowOrigin = response.headers.get('Access-Control-Allow-Origin')
	if (allowOrigin) {
		responseHeaders['Access-Control-Allow-Origin'] = allowOrigin
	}
	
	const allowCredentials = response.headers.get('Access-Control-Allow-Credentials')
	if (allowCredentials) {
		responseHeaders['Access-Control-Allow-Credentials'] = allowCredentials
	}
	
	try {
		const data = JSON.parse(text)
		return new NextResponse(JSON.stringify(data), {
			status: response.status,
			headers: responseHeaders,
		})
	} catch {
		return new NextResponse(text, {
			status: response.status,
			headers: responseHeaders,
		})
	}
}

export async function POST(req: NextRequest, ctx: RouteParams) {
	try {
		const params = await ctx.params
		return await proxyToWebRTC(req, params)
	} catch {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function GET(req: NextRequest, ctx: RouteParams) {
	try {
		const params = await ctx.params
		return await proxyToWebRTC(req, params)
	} catch {
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function OPTIONS(req: NextRequest, ctx: RouteParams) {
	// Handle CORS preflight
	return new NextResponse(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type, Authorization',
		},
	})
}
