import { NextRequest, NextResponse } from 'next/server'

type RouteParams = {
	params: Promise<{
		path: string[]
	}>
}

async function proxyToWebRTC(req: NextRequest, params: { path: string[] }) {
	const webrtcUrl =
		process.env.NEXT_PUBLIC_WEBRTC_URL || 'http://localhost:5000'
	const path = Array.isArray(params.path) ? params.path.join('/') : ''
	const targetUrl = `${webrtcUrl}/${path}`
	const contentType = req.headers.get('content-type') || 'application/json'
	const body = await req.text()

	const response = await fetch(targetUrl, {
		method: req.method,
		headers: {
			'Content-Type': contentType,
		},
		body: body.length ? body : undefined,
	})

	const text = await response.text()
	try {
		const data = JSON.parse(text)
		return NextResponse.json(data, { status: response.status })
	} catch {
		return NextResponse.json({ raw: text }, { status: response.status })
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
