import { NextRequest, NextResponse } from 'next/server'
import { getAccessToken } from '@/lib/auth.utils'
import { getBackendUrl } from '@/lib/server-urls'

async function proxyE2EKeys(request: NextRequest, path: string[], method: 'GET' | 'POST') {
  try {
    const backendUrl = getBackendUrl()
    const targetPath = path.join('/')
    const targetUrl = new URL(`${backendUrl}/api/v1/e2e-keys/${targetPath}`)

    request.nextUrl.searchParams.forEach((value, key) => {
      targetUrl.searchParams.set(key, value)
    })

    let token = await getAccessToken(request)
    if (!token) {
      const authHeader = request.headers.get('authorization') || ''
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.slice(7).trim()
      }
    }

    const headers: Record<string, string> = {}
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    if (method === 'POST') {
      headers['Content-Type'] = 'application/json'
    }

    const response = await fetch(targetUrl.toString(), {
      method,
      headers,
      body: method === 'POST' ? await request.text() : undefined,
    })

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
    console.error('[API v1 E2E Keys Proxy] Error:', error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyE2EKeys(request, path || [], 'GET')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params
  return proxyE2EKeys(request, path || [], 'POST')
}
