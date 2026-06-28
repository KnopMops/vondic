'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import {
  createOAuthClient,
  getOAuthClients,
  deleteOAuthClient,
  updateOAuthClient,
  OAuthClient,
} from '@/lib/api/oauth'
import { useToast } from '@/lib/ToastContext'
import { LuEye as EyeIcon, LuEyeOff as EyeOffIcon } from 'react-icons/lu'

type Props = {
  enabled: boolean
}

const SCOPE_OPTIONS = [
  'basic_profile',
  'read_profile',
  'read_posts',
  'write_posts',
  'read_messages',
  'write_messages',
]

export default function DeveloperSettings({ enabled }: Props) {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [clients, setClients] = useState<OAuthClient[]>([])
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [defaultScopes, setDefaultScopes] = useState('basic_profile')
  const [redirectUris, setRedirectUris] = useState('')
  const [loading, setLoading] = useState(false)
  const [editingClientId, setEditingClientId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editLogoUrl, setEditLogoUrl] = useState('')
  const [editDefaultScopes, setEditDefaultScopes] = useState('basic_profile')
  const [editRedirectUris, setEditRedirectUris] = useState('')
  const [showSecretModal, setShowSecretModal] = useState(false)
  const [showSecret, setShowSecret] = useState(false)
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({})
  const [newClientCredentials, setNewClientCredentials] = useState<{
    client_id: string
    client_secret: string
  } | null>(null)

  const toggleCardSecret = (clientId: string) => {
    setShowSecrets(prev => ({ ...prev, [clientId]: !prev[clientId] }))
  }

  useEffect(() => {
    if (enabled && user) {
      loadClients()
    }
  }, [enabled, user])

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const res = await fetch('/api/auth/me', { method: 'GET' })
      if (!res.ok) return null
      const data = await res.json()
      return data?.user?.access_token || data?.access_token || null
    } catch {
      return null
    }
  }

  const loadClients = async () => {
    try {
      const token = await getAuthToken()
      if (!token) return
      const data = await getOAuthClients(token)
      setClients(data)
    } catch (error: any) {
      showToast(error.message || 'Failed to load clients', 'error')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !redirectUris) {
      showToast('Name and redirect URIs are required', 'error')
      return
    }

    setLoading(true)
    try {
      const token = await getAuthToken()
      if (!token) return
      const uris = redirectUris.split(',').map(uri => uri.trim()).filter(Boolean)
      const scopes = defaultScopes.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
      const client = await createOAuthClient(name, description, uris, logoUrl.trim(), scopes, token)
      setClients([client, ...clients])
      if (client.client_secret) {
        setNewClientCredentials({
          client_id: client.client_id,
          client_secret: client.client_secret,
        })
        setShowSecretModal(true)
      }
      setShowCreateForm(false)
      setName('')
      setDescription('')
      setLogoUrl('')
      setDefaultScopes('basic_profile')
      setRedirectUris('')
      showToast('OAuth application created! Save the client secret now - it won\'t be shown again.', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to create client', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (clientId: string) => {
    if (!confirm('Are you sure you want to delete this application?')) return

    try {
      const token = await getAuthToken()
      if (!token) return
      await deleteOAuthClient(clientId, token)
      setClients(clients.filter(c => c.client_id !== clientId))
      showToast('Application deleted', 'success')
    } catch (error: any) {
      showToast(error.message || 'Failed to delete client', 'error')
    }
  }

  const startEdit = (client: OAuthClient) => {
    setEditingClientId(client.client_id)
    setEditName(client.name || '')
    setEditDescription(client.description || '')
    setEditLogoUrl(client.logo_url || '')
    setEditDefaultScopes((client.default_scopes || ['basic_profile']).join(', '))
    setEditRedirectUris((client.redirect_uris || []).join(', '))
  }

  const cancelEdit = () => {
    setEditingClientId(null)
    setEditName('')
    setEditDescription('')
    setEditLogoUrl('')
    setEditDefaultScopes('basic_profile')
    setEditRedirectUris('')
  }

  const handleUpdate = async (clientId: string) => {
    try {
      const token = await getAuthToken()
      if (!token) return
      const updated = await updateOAuthClient(
        clientId,
        {
          name: editName.trim(),
          description: editDescription.trim(),
          logo_url: editLogoUrl.trim(),
          default_scopes: editDefaultScopes
            .split(/[,\s]+/)
            .map(s => s.trim())
            .filter(Boolean),
          redirect_uris: editRedirectUris
            .split(',')
            .map(uri => uri.trim())
            .filter(Boolean),
        },
        token,
      )
      setClients(prev => prev.map(c => (c.client_id === clientId ? updated : c)))
      showToast('OAuth приложение обновлено', 'success')
      cancelEdit()
    } catch (error: any) {
      showToast(error.message || 'Не удалось обновить приложение', 'error')
    }
  }

  const copyClientId = async (clientId: string) => {
    try {
      await navigator.clipboard.writeText(clientId)
      showToast('Client ID скопирован', 'success')
    } catch {
      showToast('Не удалось скопировать Client ID', 'error')
    }
  }

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(`${label} скопирован`, 'success')
    } catch {
      showToast(`Не удалось скопировать ${label}`, 'error')
    }
  }

  const toggleScopes = (
    current: string,
    scope: string,
    setter: (value: string) => void,
  ) => {
    const set = new Set(current.split(/[,\s]+/).map(s => s.trim()).filter(Boolean))
    if (set.has(scope)) {
      set.delete(scope)
    } else {
      set.add(scope)
    }
    const next = Array.from(set)
    setter(next.join(', '))
  }

  if (!enabled) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-white/60">
          Включите режим разработчика, чтобы получить доступ к OAuth API.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">OAuth Applications</h3>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="py-2 px-4 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-semibold transition-all active:scale-95"
        >
          {showCreateForm ? 'Отмена' : 'Создать приложение'}
        </button>
      </div>

      {showCreateForm && (
        <form onSubmit={handleCreate} className="space-y-4 p-4 rounded-xl bg-white/5 border border-white/10">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Название приложения *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My App"
              className="w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white placeholder:text-white/40"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Описание
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Application description"
              rows={3}
              className="w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white placeholder:text-white/40"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Logo URL
            </label>
            <input
              type="url"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              placeholder="https://example.com/logo.png"
              className="w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white placeholder:text-white/40"
            />
            {logoUrl.trim() && (
              <img
                src={logoUrl}
                alt='logo preview'
                className='mt-2 h-10 w-10 rounded-md object-cover border border-white/20'
              />
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Default scopes (comma or space separated)
            </label>
            <input
              type="text"
              value={defaultScopes}
              onChange={(e) => setDefaultScopes(e.target.value)}
              placeholder="basic_profile read_profile"
              className="w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white placeholder:text-white/40"
            />
            <div className='mt-2 flex flex-wrap gap-2'>
              {SCOPE_OPTIONS.map(scope => {
                const active = defaultScopes.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).includes(scope)
                return (
                  <button
                    key={scope}
                    type='button'
                    onClick={() => toggleScopes(defaultScopes, scope, setDefaultScopes)}
                    className={`rounded-full px-2.5 py-1 text-xs border ${
                      active
                        ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                        : 'border-white/20 bg-black/30 text-gray-300'
                    }`}
                  >
                    {scope}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">
              Redirect URIs (comma-separated) *
            </label>
            <input
              type="text"
              value={redirectUris}
              onChange={(e) => setRedirectUris(e.target.value)}
              placeholder="https://example.com/callback,https://app.com/auth"
              className="w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white placeholder:text-white/40"
              required
            />
            <p className="text-xs text-white/40 mt-1">
              Укажите URI для перенаправления через запятую
            </p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-4 rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white text-sm font-semibold transition-all active:scale-95 disabled:opacity-60"
          >
            {loading ? 'Создание...' : 'Создать'}
          </button>
        </form>
      )}

      <div className="space-y-4">
        {clients.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-4">
            У вас пока нет созданных приложений
          </p>
        ) : (
          clients.map(client => (
            <div key={client.client_id} className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-white">{client.name}</h4>
                <div className='flex items-center gap-3'>
                  <button
                    onClick={() =>
                      editingClientId === client.client_id ? cancelEdit() : startEdit(client)
                    }
                    className='text-xs text-indigo-300 hover:text-indigo-200 transition-colors'
                  >
                    {editingClientId === client.client_id ? 'Отмена' : 'Настроить'}
                  </button>
                  <button
                    onClick={() => handleDelete(client.client_id)}
                    className="text-xs text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
              {client.description && (
                <p className="text-sm text-white/60">{client.description}</p>
              )}
              {client.logo_url && (
                <p className='text-xs text-white/50'>
                  <span className='font-mono'>Logo:</span> {client.logo_url}
                </p>
              )}
              <div className="space-y-1 text-xs text-white/40">
                <p>
                  <span className="font-mono">Client ID:</span> {client.client_id}
                  <button
                    onClick={() => copyClientId(client.client_id)}
                    className='ml-2 text-indigo-300 hover:text-indigo-200'
                  >
                    копировать
                  </button>
                </p>
                {client.client_secret && (
                  <p className="flex items-center gap-1">
                    <span className="font-mono">Client Secret:</span>
                    <span className="font-mono text-white/60">
                      {showSecrets[client.client_id] ? client.client_secret : '••••••••••••••••••••••••••'}
                    </span>
                    <button
                      onClick={() => toggleCardSecret(client.client_id)}
                      className="rounded p-0.5 text-white/40 hover:text-white hover:bg-white/10 transition-colors"
                      title={showSecrets[client.client_id] ? 'Скрыть' : 'Показать'}
                    >
                      {showSecrets[client.client_id] ? <EyeOffIcon size={12} /> : <EyeIcon size={12} />}
                    </button>
                    <button
                      onClick={() => copyText(client.client_secret!, 'Client Secret')}
                      className="ml-1 text-emerald-300/70 hover:text-emerald-200"
                    >
                      копировать
                    </button>
                  </p>
                )}
                <p><span className="font-mono">Redirect URIs:</span> {client.redirect_uris.join(', ')}</p>
                <p><span className="font-mono">Default scopes:</span> {(client.default_scopes || []).join(', ') || 'basic_profile'}</p>
                <p><span className="font-mono">Created:</span> {new Date(client.created_at).toLocaleDateString()}</p>
              </div>
              {editingClientId === client.client_id && (
                <div className='mt-3 space-y-2 rounded-lg border border-white/10 bg-black/30 p-3'>
                  <input
                    type='text'
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder='Название приложения'
                    className='w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white'
                  />
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder='Описание'
                    rows={2}
                    className='w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white'
                  />
                  <input
                    type='url'
                    value={editLogoUrl}
                    onChange={(e) => setEditLogoUrl(e.target.value)}
                    placeholder='https://example.com/logo.png'
                    className='w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white'
                  />
                  {editLogoUrl.trim() && (
                    <img
                      src={editLogoUrl}
                      alt='logo preview'
                      className='h-10 w-10 rounded-md object-cover border border-white/20'
                    />
                  )}
                  <input
                    type='text'
                    value={editDefaultScopes}
                    onChange={(e) => setEditDefaultScopes(e.target.value)}
                    placeholder='basic_profile read_profile'
                    className='w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white'
                  />
                  <div className='flex flex-wrap gap-2'>
                    {SCOPE_OPTIONS.map(scope => {
                      const active = editDefaultScopes.split(/[,\s]+/).map(s => s.trim()).filter(Boolean).includes(scope)
                      return (
                        <button
                          key={scope}
                          type='button'
                          onClick={() => toggleScopes(editDefaultScopes, scope, setEditDefaultScopes)}
                          className={`rounded-full px-2.5 py-1 text-xs border ${
                            active
                              ? 'border-indigo-400 bg-indigo-500/20 text-indigo-200'
                              : 'border-white/20 bg-black/30 text-gray-300'
                          }`}
                        >
                          {scope}
                        </button>
                      )
                    })}
                  </div>
                  <input
                    type='text'
                    value={editRedirectUris}
                    onChange={(e) => setEditRedirectUris(e.target.value)}
                    placeholder='https://app/callback, https://another/callback'
                    className='w-full rounded-lg border border-white/20 bg-black/40 p-2 text-sm text-white'
                  />
                  <button
                    onClick={() => handleUpdate(client.client_id)}
                    className='w-full rounded-lg bg-indigo-600/80 py-2 text-sm font-semibold text-white hover:bg-indigo-600'
                  >
                    Сохранить настройки
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
        <h4 className="text-sm font-semibold text-white mb-2">Документация API</h4>
        <p className="text-xs text-white/60 mb-2">
          Для интеграции в проекте обычно нужен только Client ID/Secret, а redirect URIs
          и остальные OAuth параметры задаются и приоритетно хранятся здесь, в настройках сайта.
        </p>
        <pre className="text-xs text-white/80 bg-black/40 p-3 rounded-lg overflow-x-auto">
{`// 1. Авторизация пользователя
GET /oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=YOUR_URI&response_type=code

// 2. Получение токена
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code&code=CODE&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET&redirect_uri=YOUR_URI

// 3. Использование токена
GET /oauth/userinfo
Authorization: Bearer YOUR_ACCESS_TOKEN`}
        </pre>
      </div>

      {showSecretModal && newClientCredentials && (
        <div className='fixed inset-0 z-[100000] flex items-center justify-center bg-black/70 p-4'>
          <div className='w-full max-w-lg rounded-xl border border-white/10 bg-gray-900 p-5 space-y-4'>
            <div className='flex items-start justify-between gap-4'>
              <div>
                <h4 className='text-lg font-semibold text-white'>
                  Секрет OAuth приложения
                </h4>
                <p className='text-xs text-amber-300 mt-1'>
                  Показывается один раз. Сохраните сейчас.
                </p>
              </div>
              <button
                onClick={() => { setShowSecretModal(false); setShowSecret(false) }}
                className='rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm text-gray-200 hover:bg-white/10'
              >
                Закрыть
              </button>
            </div>
            <div className='space-y-3'>
              <div className='rounded-lg border border-white/10 bg-black/40 p-3'>
                <div className='text-xs text-gray-400 mb-1'>Client ID</div>
                <div className='break-all text-sm text-white font-mono'>
                  {newClientCredentials.client_id}
                </div>
                <button
                  onClick={() => copyText(newClientCredentials.client_id, 'Client ID')}
                  className='mt-2 rounded-md border border-indigo-400/30 bg-indigo-500/20 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/30'
                >
                  Копировать Client ID
                </button>
              </div>
              <div className='rounded-lg border border-white/10 bg-black/40 p-3'>
                <div className='flex items-center justify-between mb-1'>
                  <div className='text-xs text-gray-400'>Client Secret</div>
                  <button
                    onClick={() => setShowSecret(v => !v)}
                    className='rounded-md p-1 text-gray-400 hover:text-white hover:bg-white/10 transition-colors'
                    title={showSecret ? 'Скрыть' : 'Показать'}
                  >
                    {showSecret ? <EyeOffIcon size={14} /> : <EyeIcon size={14} />}
                  </button>
                </div>
                <div className='break-all text-sm text-white font-mono'>
                  {showSecret ? newClientCredentials.client_secret : '••••••••••••••••••••••••••'}
                </div>
                <button
                  onClick={() =>
                    copyText(newClientCredentials.client_secret, 'Client Secret')
                  }
                  className='mt-2 rounded-md border border-emerald-400/30 bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200 hover:bg-emerald-500/30'
                >
                  Копировать Client Secret
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
