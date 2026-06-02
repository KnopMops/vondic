import { getBackendUrl } from '@/lib/server-urls'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
	try {
		const body = await request.json()
		const backendUrl = getBackendUrl()
		const res = await fetch(`${backendUrl}/api/v1/auth/reset-password`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(body),
		})

		const data = await res.json()

		if (!res.ok) {
			return NextResponse.json(
				{ error: data.error || 'Ошибка сброса пароля' },
				{ status: res.status },
			)
		}

		return NextResponse.json(
			{ message: data.message || 'Пароль успешно изменён' },
			{ status: 200 },
		)
	} catch (error) {
		console.error('Reset password error:', error)
		return NextResponse.json(
			{ error: 'Произошла ошибка при соединении с сервером' },
			{ status: 500 },
		)
	}
}
