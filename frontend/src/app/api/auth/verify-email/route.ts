import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
	const token = request.nextUrl.searchParams.get('token')

	if (!token) {
		return NextResponse.json(
			{ error: 'Token is required' },
			{ status: 400 },
		)
	}

	try {
		const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'
		const res = await fetch(`${backendUrl}/api/v1/auth/verify-email?token=${encodeURIComponent(token)}`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
			},
		})

		const data = await res.json()

		if (!res.ok) {
			return NextResponse.json(
				{ error: data.error || 'Ошибка подтверждения' },
				{ status: res.status },
			)
		}

		return NextResponse.json(
			{ message: data.message || 'Email успешно подтвержден!' },
			{ status: 200 },
		)
	} catch (error) {
		console.error('Verify email error:', error)
		return NextResponse.json(
			{ error: 'Произошла ошибка при соединении с сервером' },
			{ status: 500 },
		)
	}
}
