import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
	try {
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

		// Call the backend to get the Yandex auth URL
		const response = await fetch(`${backendUrl}/api/v1/auth/yandex/login`, {
			method: 'GET',
			headers: { 'Content-Type': 'application/json' },
		})

		const responseText = await response.text()
		let data

		try {
			data = JSON.parse(responseText)
		} catch (e) {
			console.error('Failed to parse JSON from backend:', responseText)
			return NextResponse.json(
				{ error: 'Invalid response from backend' },
				{ status: 502 },
			)
		}

		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error || 'Yandex login init failed' },
				{ status: response.status },
			)
		}

		// Expecting { auth_url: "..." }
		// Подменяем redirect_uri на наш локальный
		if (data.auth_url) {
			try {
				const authUrl = new URL(data.auth_url)
				// Определяем текущий хост. В серверном окружении req.headers.get('host') должен работать.
				const host = req.headers.get('host') || 'localhost:3000'
				const protocol = req.headers.get('x-forwarded-proto') || 'http'
				const newRedirectUri = `${protocol}://${host}/api/auth/yandex/callback`

				authUrl.searchParams.set('redirect_uri', newRedirectUri)
				data.auth_url = authUrl.toString()
			} catch (e) {
				console.error('Failed to parse/modify auth_url:', e)
				// Если не вышло, оставляем как есть, но скорее всего это приведет к редиректу на бэкенд
			}
		}

		return NextResponse.json(data)
	} catch (error) {
		console.error('Yandex login proxy error:', error)
		return NextResponse.json(
			{ error: 'Internal Server Error' },
			{ status: 500 },
		)
	}
}
