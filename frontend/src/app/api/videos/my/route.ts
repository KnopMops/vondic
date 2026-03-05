import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

const BACKEND_URL = getBackendUrl()

export async function GET(req: NextRequest) {
  try {
    const token = await getAccessToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { searchParams } = new URL(req.url)
    const sort = searchParams.get('sort') || 'created_at'
    const order = searchParams.get('order') || 'desc'
    const limit = searchParams.get('limit') || '100'
    const offset = searchParams.get('offset') || '0'
    const url = new URL(`${BACKEND_URL}/api/v1/videos/my`)
    url.searchParams.set('sort', sort)
    url.searchParams.set('order', order)
    url.searchParams.set('limit', limit)
    url.searchParams.set('offset', offset)
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
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
      { error: e?.message || 'Failed to load videos' },
      { status: 500 },
    )
  }
}
