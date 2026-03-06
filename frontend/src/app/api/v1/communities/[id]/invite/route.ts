import { withAccessTokenRefresh } from '@/lib/auth.utils'
import { NextRequest, NextResponse } from 'next/server'
import { getBackendUrl } from '@/lib/server-urls'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const backendUrl = getBackendUrl()

    console.log(`Fetching community details for invite code: ${id}`)

    return await withAccessTokenRefresh(req, async token => {
      // Используем тот же endpoint что и для деталей сообщества
      const response = await fetch(`${backendUrl}/api/v1/communities/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ access_token: token }),
      })

      console.log(`Backend response status: ${response.status}`)

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Backend response error:', errorText)
        return NextResponse.json(
          { error: 'Failed to get community details', details: errorText },
          { status: response.status },
        )
      }

      const data = await response.json()
      console.log('Backend response data:', data)
      
      // Возвращаем только invite_code
      return NextResponse.json({ 
        invite_code: data.invite_code 
      })
    })
  } catch (error) {
    console.error('Get community invite code proxy error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 },
    )
  }
}
