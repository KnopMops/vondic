import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl, getWebrtcUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
  try {
    let body: any = {}
    try {
      body = await req.json()
    } catch {
      body = {}
    }
    const { channel_id, limit = 50, offset = 0, access_token: tokenFromBody, token: tokenAlt } = body || {}
    const token = (await getAccessToken(req)) || tokenFromBody || tokenAlt

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!channel_id) {
      return NextResponse.json({ error: 'channel_id required' }, { status: 400 })
    }

    const backendUrl = getWebrtcUrl()

    const response = await fetch(`${backendUrl}/channels/history`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        channel_id,
        limit,
        offset,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: 'Failed to fetch channel history', details: errorText },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Channel history proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
