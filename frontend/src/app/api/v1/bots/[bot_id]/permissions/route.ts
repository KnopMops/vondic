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

    const backendUrl = getBackendUrl()
    const response = await fetch(
      `${backendUrl}/api/v1/bots/${bot_id}/permissions`,
      {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
    console.error('[API v1 Bots Permissions] Error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get bot permissions' },
      { status: 500 }
    )
  }
}
