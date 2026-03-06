import { getAccessToken, getRefreshToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/verify']
const ROOT_ROUTE = '/'
const FEED_ROUTE = '/feed'

export default async function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl

	// 1. Пропускаем статические файлы и API
	if (
		pathname.startsWith('/_next') ||
		pathname.startsWith('/api') ||
		pathname.startsWith('/static') ||
		pathname.includes('.') // файлы с расширениями (изображения и т.д.)
	) {
		return NextResponse.next()
	}

	const accessToken = await getAccessToken(req)
	const refreshToken = await getRefreshToken(req)

	const isPublicRoute = PUBLIC_ROUTES.includes(pathname)
	const isRootRoute = pathname === ROOT_ROUTE

	// 2. Логика для неавторизованных пользователей
	if (!accessToken && !refreshToken) {
		// Разрешаем доступ к публичным страницам и корню
		if (isPublicRoute || isRootRoute) {
			return NextResponse.next()
		}
		// Иначе редирект на логин
		const url = req.nextUrl.clone()
		url.pathname = '/login'
		url.searchParams.set('from', pathname)
		return NextResponse.redirect(url)
	}

	// 3. Логика для авторизованных пользователей (есть токены)
	let response = NextResponse.next()

	// Если авторизован - редирект с логина/регистрации на фид
	if (isPublicRoute && pathname !== '/verify') {
		const url = req.nextUrl.clone()
		url.pathname = FEED_ROUTE
		return NextResponse.redirect(url)
	}

	return response
}

export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - api (API routes)
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico (favicon file)
		 */
		'/((?!api|_next/static|_next/image|favicon.ico).*)',
	],
}
