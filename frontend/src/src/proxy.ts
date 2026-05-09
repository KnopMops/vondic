import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.vondic.knopusmedia.ru'
const INTERNAL_BACKEND_URL = process.env.NEXT_PUBLIC_INTERNAL_BACKEND_URL || 'https://in.api.vondic.knopusmedia.ru'

export async function proxy(req: NextRequest) {
    const url = new URL(req.url)
    let pathname = url.pathname
    const search = url.search

    // Rewrite /api/* to /api/v1/* if not already versioned and not public
    if (!pathname.startsWith('/api/v1/') && !pathname.startsWith('/api/public/')) {
        pathname = pathname.replace(/^\/api\//, '/api/v1/')
    }

    const path = pathname + search

    // Determine which backend to use and which auth to use
    const isPublicApi = pathname.startsWith('/api/public/')
    const backendUrl = isPublicApi ? INTERNAL_BACKEND_URL : BACKEND_URL

    // Forward the request to the backend
    const headers = new Headers(req.headers)

    // For public API: use API key
    // For regular API: use access token
    if (isPublicApi) {
        const apiKey = req.cookies.get('api_key')?.value
        if (apiKey) {
            headers.set('X-API-Key', apiKey)
        }
    } else {
        const accessToken = req.cookies.get('access_token')?.value
        if (accessToken) {
            headers.set('Authorization', `Bearer ${accessToken}`)
        }
    }

    // Remove cookies from headers to avoid sending them to backend
    headers.delete('cookie')
    headers.delete('Cookie')

    try {
        const response = await fetch(`${backendUrl}${path}`, {
            method: req.method,
            headers: headers,
            body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined,
            redirect: 'manual',
        })

        // Create a new response with the backend's response
        const responseHeaders = new Headers(response.headers)

        // Ensure CORS headers are set correctly
        responseHeaders.set('Access-Control-Allow-Origin', req.headers.get('origin') || '*')
        responseHeaders.set('Access-Control-Allow-Credentials', 'true')

        return new NextResponse(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
        })
    } catch (error) {
        console.error('Proxy error:', error)
        return new NextResponse(
            JSON.stringify({ error: 'Proxy error', details: String(error) }),
            { status: 502, headers: { 'Content-Type': 'application/json' } }
        )
    }
}

export const config = {
    matcher: ['/api/:path*'],
}
