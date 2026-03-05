import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

const BACKEND_URL = getBackendUrl()

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const sort = searchParams.get('sort') || 'created_at'
  const order = searchParams.get('order') || 'desc'
  const limit = searchParams.get('limit') || '24'
  const offset = searchParams.get('offset') || '0'
  const userId = searchParams.get('user_id')
  const shorts = searchParams.get('shorts')
  const url = new URL(`${BACKEND_URL}/api/v1/videos/`)
  url.searchParams.set('sort', sort)
  url.searchParams.set('order', order)
  url.searchParams.set('limit', limit)
  url.searchParams.set('offset', offset)
  if (userId) url.searchParams.set('user_id', userId)
  if (shorts) url.searchParams.set('shorts', shorts)
  const res = await fetch(url.toString(), { method: 'GET', cache: 'no-store' })
  const text = await res.text()
  try {
    const data = JSON.parse(text)
    return NextResponse.json(data, { status: res.status })
  } catch {
    return NextResponse.json({ error: text }, { status: res.status })
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getAccessToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const body = await req.json()
    const res = await fetch(`${BACKEND_URL}/api/v1/videos/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const text = await res.text()
    try {
      const data = JSON.parse(text)
      return NextResponse.json(data, { status: res.status })
    } catch {
      return NextResponse.json({ error: text }, { status: res.status })
    }
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || 'Failed to create video' },
      { status: 500 },
    )
  }
}
