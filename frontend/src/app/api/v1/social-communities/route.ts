import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
  try {
    const backendUrl = getBackendUrl()
    const body = await req.json().catch(() => ({}))

    return await withAccessTokenRefresh(req, async token => {
      const response = await fetch(`${backendUrl}/api/v1/social-communities`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ...body, access_token: token }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: 'Failed to create community', details: errorText },
          { status: response.status },
        )
      }

      return NextResponse.json(await response.json(), { status: 201 })
    })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
