import { setTokens } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const body = await req.json()
		let { key } = body
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		let payload = body

		console.log('Telegram auth request received with key:', key)

		// Если пришел ключ, пробуем его распарсить на user_id и secret_key
		if (key && typeof key === 'string') {
			key = key.trim()
			if (key.includes(':')) {
				const [user_id, ...secretParts] = key.split(':')
				const secret_key = secretParts.join(':')
				if (user_id && secret_key) {
					console.log('Parsed key:', { user_id, secret_key })
					payload = { user_id, secret_key, ...body }
				} else {
					console.log('Failed to parse key components')
					return NextResponse.json(
						{ error: 'Invalid key format. Expected user_id:secret_key' },
						{ status: 400 },
					)
				}
			} else {
				console.log('Key does not contain colon')
				return NextResponse.json(
					{ error: 'Invalid key format. Expected user_id:secret_key' },
					{ status: 400 },
				)
			}
		} else {
			console.log('Invalid key format or missing key')
			return NextResponse.json({ error: 'Missing key' }, { status: 400 })
		}

		const response = await fetch(`${backendUrl}/api/v1/auth/telegram-login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		const data = await response.json()

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || 'Telegram login failed' },
				{ status: response.status },
			)
		}

		// Создаем ответ и устанавливаем cookies
		const nextResponse = NextResponse.json(data)

		// Используем утилиту для установки токенов
		return setTokens(nextResponse, data.access_token, data.refresh_token)
	} catch (error) {
		console.error('Telegram login proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
