import { NextRequest, NextResponse } from 'next/server'
import { getWebrtcUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { user_id, socket_id } = body || {}
    if (!user_id || !socket_id) {
      return NextResponse.json({ error: 'Missing user_id or socket_id' }, { status: 400 })
    }
    const webrtcUrl = getWebrtcUrl()
    const response = await fetch(`${webrtcUrl}/set_socket_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ user_id, socket_id }),
    })
    const text = await response.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: response.status })
    } catch {
      // If WebRTC server returns plain text, wrap it
      return NextResponse.json({ raw: text }, { status: response.status })
    }
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
