import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bot_id: string }> }
) {
  try {
    const { bot_id } = await params
    let token = await getAccessToken(request)
    if (!token) {
      const authHeader = request.headers.get('authorization') || ''
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim()
      }
    }
    if (!token) {
      return NextResponse.json({ error: 'access_token is missing' }, { status: 401 })
    }

    const chatId = request.nextUrl.searchParams.get('chat_id') || ''
    const backendUrl = getBackendUrl()
    const response = await fetch(
      `${backendUrl}/api/v1/bots/${bot_id}/outbox?chat_id=${encodeURIComponent(chatId)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

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
    console.error('[API v1 Bots Outbox] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get bot outbox' },
      { status: 500 }
    )
  }
}
