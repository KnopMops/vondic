import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

async function handleProxy(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
	try {
		const token = await getAccessToken(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const { id } = await params
		const backendUrl = getBackendUrl()

		let body = {}
		try {
			body = await req.json()
		} catch (e) {}

		const response = await fetch(`${backendUrl}/api/v1/channels/${id}`, {
			method: req.method,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`,
			},
			body: req.method !== 'GET' ? JSON.stringify({ ...body, access_token: token }) : undefined,
		})

		if (!response.ok) {
			const errorText = await response.text()
			return NextResponse.json(
				{ error: 'Failed channel operation', details: errorText },
				{ status: response.status },
			)
		}

		const data = await response.json()
		return NextResponse.json(data)
	} catch (error) {
		console.error('Channel proxy error:', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return handleProxy(req, ctx)
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return handleProxy(req, ctx)
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return handleProxy(req, ctx)
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
	return handleProxy(req, ctx)
}
