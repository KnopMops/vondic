import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const botId = searchParams.get('bot_id')
		if (!botId) {
			return NextResponse.json({ error: 'bot_id is required' }, { status: 400 })
		}
		const mode = searchParams.get('mode')
		const backendUrl = getBackendUrl()
		if (mode === 'outbox') {
			let token = await getAccessToken(req)
			if (!token) {
				const authHeader = req.headers.get('authorization') || ''
				if (authHeader.startsWith('Bearer ')) {
					token = authHeader.slice(7).trim()
				}
			}
			if (!token) {
				const tokenParam = searchParams.get('access_token')
				if (tokenParam) token = tokenParam
			}
			if (!token) {
				return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
			}
			const chatId = searchParams.get('chat_id')
			if (!chatId) {
				return NextResponse.json(
					{ error: 'chat_id is required' },
					{ status: 400 },
				)
			}
			const url = new URL(`${backendUrl}/api/v1/bots/${botId}/outbox`)
			url.searchParams.set('chat_id', chatId)
			const response = await fetch(url.toString(), {
				headers: { Authorization: `Bearer ${token}` },
			})
			const text = await response.text()
			try {
				const data = JSON.parse(text)
				return NextResponse.json(data, { status: response.status })
			} catch {
				return NextResponse.json(
					{ error: text || 'Invalid backend response' },
					{ status: response.status },
				)
			}
		}
		const response = await fetch(`${backendUrl}/api/public/v1/bots/${botId}`, {
			method: 'GET',
		})
		const text = await response.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: response.status })
		} catch {
			return NextResponse.json(
				{ error: text || 'Invalid backend response' },
				{ status: response.status },
			)
		}
	} catch (error) {
		console.error('Bots get proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json().catch(() => ({}))
		let token = await getAccessToken(req)
		if (!token) {
			token = body?.access_token
		}
		if (!token) {
			return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
		}

		const backendUrl = getBackendUrl()
		const payload = { ...body, access_token: token }
		const response = await fetch(`${backendUrl}/api/v1/bots`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		const text = await response.text()
		try {
			const data = JSON.parse(text)
			return NextResponse.json(data, { status: response.status })
		} catch {
			return NextResponse.json(
				{ error: text || 'Invalid backend response' },
				{ status: response.status },
			)
		}
	} catch (error) {
		console.error('Bots create proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
