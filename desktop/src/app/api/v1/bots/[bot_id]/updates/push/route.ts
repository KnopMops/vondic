import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bot_id: string }> }
) {
  try {
    const { bot_id } = await params
    const body = await request.json().catch(() => ({}))
    let token = await getAccessToken(request)
    if (!token) {
      const authHeader = request.headers.get('authorization') || ''
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim()
      }
    }
    if (!token && body?.access_token) {
      token = body.access_token
    }
    if (!token) {
      return NextResponse.json({ error: 'access_token is missing' }, { status: 401 })
    }

    const backendUrl = getBackendUrl()
    const response = await fetch(`${backendUrl}/api/v1/bots/${bot_id}/updates/push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ...body, access_token: token }),
    })

    const text = await response.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: response.status })
    } catch {
      return NextResponse.json(
        { error: text || 'Invalid backend response' },
        { status: response.status }
      )
    }
  } catch (error: any) {
    console.error('[API v1 Bots Updates Push] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to push bot update' },
      { status: 500 }
    )
  }
}
