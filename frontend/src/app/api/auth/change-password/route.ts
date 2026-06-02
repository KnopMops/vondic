import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/url-fallback'

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const accessToken = await getAccessToken(request)
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/change-password`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
			},
			body: JSON.stringify(body),
		})

		const data = await res.json()

		if (!res.ok) {
			return NextResponse.json(
				{ error: data.error || 'Ошибка смены пароля' },
				{ status: res.status },
			)
		}

		return NextResponse.json(
			{ message: data.message || 'Пароль изменён' },
			{ status: 200 },
		)
	} catch (error) {
		console.error('Change password error:', error)
		return NextResponse.json(
			{ error: 'Произошла ошибка при соединении с сервером' },
			{ status: 500 },
		)
	}
}
