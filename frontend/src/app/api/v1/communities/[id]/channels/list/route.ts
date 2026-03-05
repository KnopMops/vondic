import { getAccessToken } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const token = await getAccessToken(req)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const { id } = await params
    const backendUrl = getBackendUrl()
    const response = await fetch(`${backendUrl}/api/v1/communities/${id}/channels`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json(
        { error: 'Failed to list community channels', details: errorText },
        { status: response.status },
      )
    }
    const data = await response.json()
    return NextResponse.json(data)
  } catch (error) {
    console.error('List community channels proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
