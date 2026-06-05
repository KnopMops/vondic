import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function POST(req: NextRequest) {
  try {
    const backendUrl = getBackendUrl()

    return await withAccessTokenRefresh(req, async token => {
      const response = await fetch(`${backendUrl}/api/v1/social-communities/my`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ access_token: token }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return NextResponse.json(
          { error: 'Failed to fetch communities', details: errorText },
          { status: response.status },
        )
      }

      return NextResponse.json(await response.json())
    })
  } catch {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
