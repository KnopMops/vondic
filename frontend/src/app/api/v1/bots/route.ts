import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const botId = searchParams.get('bot_id')
		const backendUrl = getBackendUrl()
		
		// Если есть bot_id - возвращаем конкретного бота
		if (botId) {
			const mode = searchParams.get('mode')
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
			// Получение конкретного бота
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
		}
		
		// Если нет bot_id - возвращаем список всех ботов
		const response = await fetch(`${backendUrl}/api/public/v1/bots/`, {
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
		
		console.log('[Bots API] Incoming request body keys:', Object.keys(body || {}))
		console.log('[Bots API] Body access_token present:', !!body?.access_token)
		console.log('[Bots API] Body access_token length:', body?.access_token?.length)
		
		// Сначала пробуем взять токен из тела запроса (frontend отправляет его там)
		let token = body?.access_token
		
		// Если нет в теле, пробуем получить из cookie/header
		if (!token) {
			token = await getAccessToken(req)
			console.log('[Bots API] Token from getAccessToken:', token ? `${token.length} chars` : 'none')
		}
		
		// Если нет в cookie, пробуем из Authorization header
		if (!token) {
			const authHeader = req.headers.get('authorization') || ''
			if (authHeader.startsWith('Bearer ')) {
				token = authHeader.slice(7).trim()
				console.log('[Bots API] Token from Authorization header:', `${token.length} chars`)
			}
		}
		
		// Если всё ещё нет токена - ошибка
		if (!token) {
			console.error('[Bots API] No access token found. Body:', Object.keys(body || {}))
			return NextResponse.json({ error: 'access_token is missing' }, { status: 401 })
		}

		const backendUrl = getBackendUrl()
		const payload = { ...body, access_token: token }
		
		console.log('[Bots API] Creating bot with token length:', token.length)
		
		const response = await fetch(`${backendUrl}/api/v1/bots`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		const text = await response.text()
		console.log('[Bots API] Backend response status:', response.status)
		console.log('[Bots API] Backend response:', text.substring(0, 200))
		
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
