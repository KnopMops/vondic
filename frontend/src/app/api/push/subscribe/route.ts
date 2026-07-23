import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { subscription, user_id, platform } = body

    if (!subscription?.endpoint || !user_id) {
      return NextResponse.json({ error: 'Missing subscription or user_id' }, { status: 400 })
    }

    const backendUrl = getBackendUrl()

    const res = await fetch(`${backendUrl}/api/v1/users/internal/push-subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys?.p256dh || '',
        auth: subscription.keys?.auth || '',
        platform: platform || 'web',
      }),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('Push subscribe error:', error)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
