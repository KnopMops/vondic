import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url)
        const limit = searchParams.get('limit') || '50'
        
        // Получаем токен
        let token = await getAccessToken(req)
        if (!token) {
            const authHeader = req.headers.get('authorization') || ''
            if (authHeader.startsWith('Bearer ')) {
                token = authHeader.slice(7).trim()
            }
        }
        
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
        
        const backendUrl = getBackendUrl()
        const url = new URL(`${backendUrl}/api/v1/dm/recent`)
        url.searchParams.set('limit', limit)
        
        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
        })
        
        const text = await response.text()
        try {
            const data = JSON.parse(text)
            return NextResponse.json(data, { status: response.status })
        } catch {
            return NextResponse.json(
                { error: text || 'Invalid backend response' },
                { status: response.status },
            )
        }
    } catch (error) {
        console.error('DM recent proxy error:', error)
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
        )
    }
}

export async function OPTIONS(req: NextRequest) {
    return new NextResponse(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        },
    })
}
