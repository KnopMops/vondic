import { getAccessToken, getRefreshToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

/** Возвращает токены текущей сессии для сохранения при смене аккаунта (только для своего клиента). */
export async function GET(req: NextRequest) {
	const refreshToken = await getRefreshToken(req)
	if (!refreshToken) {
		return NextResponse.json({ error: 'No session' }, { status: 401 })
	}
	const accessToken = await getAccessToken(req)
	return NextResponse.json({
		refresh_token: refreshToken,
		access_token: accessToken ?? undefined,
	})
}
