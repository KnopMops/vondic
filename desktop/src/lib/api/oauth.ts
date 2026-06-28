export interface OAuthClient {
  id: string
  client_id: string
  name: string
  description: string
  logo_url?: string
  default_scopes?: string[]
  redirect_uris: string[]
  is_active: boolean
  created_at: string
  client_secret?: string // Only returned on creation
}

async function oauthFetch(
  path: string,
  options: RequestInit,
): Promise<Response> {
  // Primary: Next.js proxy routes
  const primary = await fetch(`/api/oauth${path}`, options)
  if (primary.status !== 404) return primary

  // Fallback: backend routes on same origin
  return fetch(`/oauth${path}`, options)
}

export async function createOAuthClient(
  name: string,
  description: string,
  redirect_uris: string[],
  logo_url: string,
  default_scopes: string[],
  token: string
): Promise<OAuthClient> {
  const res = await oauthFetch(`/clients`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      description,
      redirect_uris,
      logo_url,
      default_scopes,
    }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to create OAuth client')
  }

  return res.json()
}

export async function getOAuthClients(token: string): Promise<OAuthClient[]> {
  const res = await oauthFetch(`/clients`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to fetch OAuth clients')
  }

  return res.json()
}

export async function deleteOAuthClient(
  clientId: string,
  token: string
): Promise<void> {
  const res = await oauthFetch(`/clients/${clientId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Failed to delete OAuth client')
  }
}

export async function updateOAuthClient(
  clientId: string,
  payload: {
    name?: string
    description?: string
    logo_url?: string
    default_scopes?: string[]
    redirect_uris?: string[]
  },
  token: string
): Promise<OAuthClient> {
  const res = await oauthFetch(`/clients/${clientId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const error = await res.json().catch(() => ({}))
    throw new Error(error.error || 'Failed to update OAuth client')
  }

  return res.json()
}
