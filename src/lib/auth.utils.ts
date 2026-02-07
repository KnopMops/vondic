import { decodeJwt } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const ACCESS_TOKEN_KEY = 'access_token'
const REFRESH_TOKEN_KEY = 'refresh_token'

/**
 * Извлекает access_token из cookies запроса.
 * Работает как в Middleware (NextRequest), так и в Server Components/API Routes (cookies()).
 */
export async function getAccessToken(
	req?: NextRequest,
): Promise<string | undefined> {
	if (req) {
		return req.cookies.get(ACCESS_TOKEN_KEY)?.value
	}
	const cookieStore = await cookies()
	return cookieStore.get(ACCESS_TOKEN_KEY)?.value
}

/**
 * Извлекает refresh_token из cookies запроса.
 */
export async function getRefreshToken(
	req?: NextRequest,
): Promise<string | undefined> {
	if (req) {
		return req.cookies.get(REFRESH_TOKEN_KEY)?.value
	}
	const cookieStore = await cookies()
	return cookieStore.get(REFRESH_TOKEN_KEY)?.value
}

/**
 * Устанавливает токены в cookies с флагами secure и httpOnly.
 * Принимает NextResponse для установки cookies в ответе.
 */
export function setTokens(
	res: NextResponse,
	accessToken: string,
	refreshToken: string,
): NextResponse {
	res.cookies.set({
		name: ACCESS_TOKEN_KEY,
		value: accessToken,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		sameSite: 'lax',
		maxAge: 15 * 60, // 15 минут (примерно как на бэкенде)
	})

	res.cookies.set({
		name: REFRESH_TOKEN_KEY,
		value: refreshToken,
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		sameSite: 'lax',
		maxAge: 7 * 24 * 60 * 60, // 7 дней
	})

	return res
}

/**
 * Удаляет токены из cookies (при выходе).
 */
export function clearTokens(res: NextResponse): NextResponse {
	res.cookies.delete(ACCESS_TOKEN_KEY)
	res.cookies.delete(REFRESH_TOKEN_KEY)
	return res
}

/**
 * Проверяет, истек ли срок действия токена.
 */
export function isTokenExpired(token: string): boolean {
	try {
		const decoded = decodeJwt(token)
		if (!decoded.exp) return false // Если нет exp, считаем токен вечным или непрозрачным
		// exp is in seconds, Date.now() is in ms
		return decoded.exp * 1000 < Date.now()
	} catch {
		// Если не удалось декодировать (не JWT), считаем токен валидным
		// (пусть бэкенд разбирается с валидностью при запросе)
		return false
	}
}

/**
 * Обновляет access_token через refresh_token, делая запрос к бэкенду.
 * Возвращает новые токены или null, если обновление не удалось.
 */
export async function refreshAccessToken(
	refreshToken: string,
): Promise<{ access_token: string; refresh_token: string } | null> {
	try {
		const backendUrl =
			process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:5050'
		const response = await fetch(`${backendUrl}/api/v1/auth/refresh`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${refreshToken}`,
			},
		})

		if (!response.ok) {
			return null
		}

		const data = await response.json()
		return {
			access_token: data.access_token,
			refresh_token: data.refresh_token,
		}
	} catch (error) {
		console.error('Token refresh failed:', error)
		return null
	}
}
