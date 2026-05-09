import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'
import { NextRequest, NextResponse } from 'next/server'

const getTokenFromRequest = async (req: NextRequest): Promise<string | null> => {
	const header = req.headers.get('authorization') || req.headers.get('Authorization')
	if (header?.startsWith('Bearer ')) {
		return header.slice(7).trim()
	}
	const cookieToken = await getAccessToken(req)
	return cookieToken || null
}

export async function GET(req: NextRequest) {
	try {
		const token = await getTokenFromRequest(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const backendUrl = getBackendUrl()
		const response = await fetch(`${backendUrl}/oauth/clients`, {
			method: 'GET',
			headers: {
				Authorization: `Bearer ${token}`,
			},
		})
		const text = await response.text()
		try {
			return NextResponse.json(JSON.parse(text), { status: response.status })
		} catch {
			return NextResponse.json({ error: text || 'OAuth clients error' }, { status: response.status })
		}
	} catch (error) {
		console.error('OAuth clients GET proxy error:', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}

export async function POST(req: NextRequest) {
	try {
		const token = await getTokenFromRequest(req)
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}
		const body = await req.json()
		const backendUrl = getBackendUrl()
		const response = await fetch(`${backendUrl}/oauth/clients`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})
		const text = await response.text()
		try {
			return NextResponse.json(JSON.parse(text), { status: response.status })
		} catch {
			return NextResponse.json({ error: text || 'OAuth client create error' }, { status: response.status })
		}
	} catch (error) {
		console.error('OAuth clients POST proxy error:', error)
		return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
	}
}
