import { setTokens } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url)
		const code = searchParams.get('code')
		const cid = searchParams.get('cid')

		if (!code) {
			return NextResponse.json({ error: 'No code provided' }, { status: 400 })
		}

		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		// Формируем URL для запроса к бэкенду
		const backendCallbackUrl = new URL(
			`${backendUrl}/api/v1/auth/yandex/callback`,
		)
		backendCallbackUrl.searchParams.set('code', code)
		if (cid) backendCallbackUrl.searchParams.set('cid', cid)

		// Делаем запрос к бэкенду
		const response = await fetch(backendCallbackUrl.toString(), {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		})

		const data = await response.json()

		if (!response.ok) {
			const loginUrl = new URL('/login', req.url)
			loginUrl.searchParams.set('error', data.error || 'Yandex login failed')
			return NextResponse.redirect(loginUrl)
		}

		// Если успех, устанавливаем токены и редиректим на главную
		const nextResponse = NextResponse.redirect(new URL('/', req.url))

		// Устанавливаем токены
		const responseWithTokens = setTokens(
			nextResponse,
			data.access_token,
			data.refresh_token,
		)

		// Устанавливаем временную cookie с данными пользователя (не httpOnly, чтобы JS мог прочитать)
		// Кодируем в base64 или URI encoded JSON
		if (data.user) {
			responseWithTokens.cookies.set({
				name: 'temp_user_data',
				value: JSON.stringify(data.user),
				httpOnly: false, // Разрешаем доступ из JS
				secure: process.env.NODE_ENV === 'production',
				path: '/',
				maxAge: 60, // Живет всего минуту, пока клиент не прочитает
				sameSite: 'lax',
			})
		}

		return responseWithTokens
	} catch (error) {
		console.error('Yandex callback proxy error:', error)
		const loginUrl = new URL('/login', req.url)
		loginUrl.searchParams.set('error', 'Internal Server Error')
		return NextResponse.redirect(loginUrl)
	}
}
