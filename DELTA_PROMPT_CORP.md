# ТЕХНИЧЕСКОЕ ЗАДАНИЕ: Полная доработка мессенджера корпоративного Vondic (vondic_corp)

## 1. Контекст и архитектурные рамки

Корпоративная версия Vondic (`vondic_corp`) развёрнута и функционирует:
- **Backend**: Flask API + Flask-SocketIO (WebRTC signaling, MTProto-подобное шифрование, регистрация корпоративного инстанса) + PostgreSQL.
- **Frontend**: Next.js 14 (App Router), TailwindCSS, Redux Toolkit, Socket.IO Client.
- **SSO/Auth**: Keycloak SSO + email/password.

### ⛔ ЧТО УЖЕ РАБОТАЕТ — КАТЕГОРИЧЕСКИ НЕ ТРОГАТЬ:
1. Авторизация и сессии (Keycloak SSO, токены, email/пароль).
2. Базовые DM, групповые чаты и каналы через WebSocket (`send_message`, `receive_message`).
3. Базовые 1-to-1 и групповые WebRTC-звонки (`WebRTCProvider`, `ActiveCall`, `ActiveGroupCall`).
4. Список друзей, входящие/исходящие заявки, добавление участников.
5. Шифрование сообщений (MTProto-like), reactions, edit, delete, reply.
6. Бэкенд корпоративной регистрации (`backend/app/api/v1/corporate.py`, `backend/app/services/corporate_registration_service.py`).
7. **В БЭКЕНДЕ НИЧЕГО НЕ МЕНЯТЬ** — все эндпоинты, таблицы БД и сокет-события уже готовы и работают.

---

## 2. Сводка работ по фронтенду

- **Создать 11 файлов**:
  1. `frontend/src/lib/chatFolderTypes.ts`
  2. `frontend/src/lib/chatFolders.ts`
  3. `frontend/src/lib/scheduledMessages.ts`
  4. `frontend/src/lib/api/scheduledMessages.ts`
  5. `frontend/src/lib/inviteLinks.ts`
  6. `frontend/src/lib/features/presenceSlice.ts`
  7. `frontend/src/app/feed/messages/ScheduleMessageModal.tsx`
  8. `frontend/src/app/feed/messages/ForwardModal.tsx`
  9. `frontend/src/app/feed/messages/DeleteChatHistoryModal.tsx`
  10. `frontend/src/components/calls/ActiveVoiceChannel.tsx`
  11. `frontend/src/components/calls/DiscordCallModal.tsx`

- **Изменить 6 файлов**:
  1. `frontend/src/lib/types.ts`
  2. `frontend/src/lib/store.ts`
  3. `frontend/src/lib/SocketContext.tsx`
  4. `frontend/src/components/calls/index.ts`
  5. `frontend/src/app/feed/messages/MessageBubble.tsx`
  6. `frontend/src/app/feed/messages/page.tsx`

---

## 3. ПОЛНЫЙ КОД 11 СОЗДАВАЕМЫХ ФАЙЛОВ

### Файл 1: `frontend/src/lib/chatFolderTypes.ts`
```typescript
export type ChatRefType = 'user' | 'group' | 'channel'

export type ChatRef = {
  type: ChatRefType
  id: string
}

export type ChatFolder = {
  id: string
  name: string
  icon?: string
  color?: string
  chats: ChatRef[]
}
```

### Файл 2: `frontend/src/lib/chatFolders.ts`
```typescript
import { ChatFolder, ChatRef } from './chatFolderTypes'

const ACTIVE_KEY = 'vondic_active_chat_folder_v1'
const FOLDERS_KEY = 'vondic_chat_folders_v1'

export function chatRefKey(ref: ChatRef): string {
  return `${ref.type}:${ref.id}`
}

export function parseChatRefKey(key: string): ChatRef | null {
  const [type, ...rest] = key.split(':')
  const id = rest.join(':')
  if (!id) return null
  if (type === 'user' || type === 'group' || type === 'channel') {
    return { type, id }
  }
  return null
}

export function loadChatFolders(): ChatFolder[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(FOLDERS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveChatFolders(folders: ChatFolder[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders))
}

export function loadActiveFolderId(): string {
  if (typeof window === 'undefined') return 'all'
  return localStorage.getItem(ACTIVE_KEY) || 'all'
}

export function saveActiveFolderId(folderId: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(ACTIVE_KEY, folderId)
}

export function createFolderId(): string {
  return `folder_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function chatInFolder(folders: ChatFolder[], ref: ChatRef): string | null {
  const key = chatRefKey(ref)
  for (const folder of folders) {
    if (folder.chats.some(c => chatRefKey(c) === key)) return folder.id
  }
  return null
}

export function matchesActiveFolder(
  folders: ChatFolder[],
  activeFolderId: string,
  ref: ChatRef
): boolean {
  if (!activeFolderId || activeFolderId === 'all') return true
  return chatInFolder(folders, ref) === activeFolderId
}

export function assignChatToFolder(
  folders: ChatFolder[],
  ref: ChatRef,
  targetFolderId: string | null
): ChatFolder[] {
  const key = chatRefKey(ref)
  const updated = folders.map(folder => ({
    ...folder,
    chats: folder.chats.filter(c => chatRefKey(c) !== key),
  }))

  if (targetFolderId && targetFolderId !== 'all') {
    const target = updated.find(f => f.id === targetFolderId)
    if (target) {
      target.chats.push(ref)
    }
  }

  saveChatFolders(updated)
  return updated
}
```

### Файл 3: `frontend/src/lib/scheduledMessages.ts`
```typescript
export type ScheduledMessageTarget = {
  type: 'user' | 'group' | 'channel'
  id: string
}

export type ScheduledMessage = {
  id: string
  scheduledAt: string
  content: string
  target: ScheduledMessageTarget
  replyToId?: string
}

const STORAGE_KEY = 'vondic_scheduled_messages_v1'

export function loadScheduledMessages(): ScheduledMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveScheduledMessages(items: ScheduledMessage[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

export function createScheduledMessageId(): string {
  return `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function getDueScheduledMessages(
  items: ScheduledMessage[],
  now = Date.now()
): ScheduledMessage[] {
  return items.filter(item => {
    const at = new Date(item.scheduledAt).getTime()
    return Number.isFinite(at) && at <= now
  })
}

export function getPendingForTarget(
  items: ScheduledMessage[],
  target: ScheduledMessageTarget
): ScheduledMessage[] {
  return items
    .filter(
      item => item.target.type === target.type && item.target.id === target.id
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    )
}
```

### Файл 4: `frontend/src/lib/api/scheduledMessages.ts`
```typescript
export interface CreateScheduledParams {
  content: string
  target_user_id?: string
  channel_id?: string
  group_id?: string
  scheduled_at: string
  type?: string
}

export interface ScheduledMessageApi {
  id: string
  content: string
  target_user_id?: string
  channel_id?: string
  group_id?: string
  scheduled_at: string
  type?: string
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/auth/me')
    const data = await res.json()
    const token = data?.user?.access_token || data?.access_token
    if (token) {
      return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    }
  } catch {}
  return { 'Content-Type': 'application/json' }
}

export async function createScheduled(
  params: CreateScheduledParams
): Promise<ScheduledMessageApi | null> {
  try {
    const headers = await authHeaders()
    const res = await fetch('/api/v1/scheduled-messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export async function listScheduled(): Promise<ScheduledMessageApi[]> {
  try {
    const headers = await authHeaders()
    const res = await fetch('/api/v1/scheduled-messages', { headers })
    if (!res.ok) return []
    const data = await res.json()
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}
```

### Файл 5: `frontend/src/lib/inviteLinks.ts`
```typescript
export type InviteEntity = 'server' | 'channel' | 'group'

export type ParsedInviteLink = {
  entity: InviteEntity
  code: string
  path: string
  url: string
}

export function appOrigin(): string {
  if (typeof window !== 'undefined') return window.location.origin
  return process.env.NEXT_PUBLIC_APP_URL || ''
}

function _resolveCode(input: any): string {
  if (!input) return ''
  if (typeof input === 'string') return input
  if (typeof input === 'object') {
    return input.invite_code || input.code || input.inviteCode || input.id || ''
  }
  return String(input)
}

export function channelJoinPath(codeOrId: string): string {
  const code = _resolveCode(codeOrId)
  return `/feed/messages/join/channel/${encodeURIComponent(code)}`
}

export function channelJoinUrl(codeOrId: string): string {
  return `${appOrigin()}${channelJoinPath(codeOrId)}`
}

export function groupJoinPath(codeOrId: string): string {
  const code = _resolveCode(codeOrId)
  return `/feed/messages/join/group/${encodeURIComponent(code)}`
}

export function groupJoinUrl(codeOrId: string): string {
  return `${appOrigin()}${groupJoinPath(codeOrId)}`
}

export function serverJoinPath(codeOrId: string): string {
  const code = _resolveCode(codeOrId)
  return `/feed/messages/join/${encodeURIComponent(code)}`
}

export function serverJoinUrl(codeOrId: string): string {
  return `${appOrigin()}${serverJoinPath(codeOrId)}`
}

export function parseInviteToken(raw: string): { entity: InviteEntity; code: string } | null {
  if (!raw) return null
  const cleaned = raw.trim()
  const channelMatch = cleaned.match(/\/join\/channel\/([^/?#]+)/)
  if (channelMatch) return { entity: 'channel', code: decodeURIComponent(channelMatch[1]) }

  const groupMatch = cleaned.match(/\/join\/group\/([^/?#]+)/)
  if (groupMatch) return { entity: 'group', code: decodeURIComponent(groupMatch[1]) }

  const serverMatch = cleaned.match(/\/join\/([^/?#]+)/)
  if (serverMatch) return { entity: 'server', code: decodeURIComponent(serverMatch[1]) }

  return null
}
```

### Файл 6: `frontend/src/lib/features/presenceSlice.ts`
```typescript
import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export interface UserPresence {
  status: 'online' | 'offline' | string
  lastSeen?: string | null
}

export interface PresenceState {
  statuses: Record<string, UserPresence>
}

const initialState: PresenceState = {
  statuses: {},
}

export const presenceSlice = createSlice({
  name: 'presence',
  initialState,
  reducers: {
    updateUserStatus: (
      state,
      action: PayloadAction<{ userId: string; status: string; lastSeen?: string | null }>
    ) => {
      const { userId, status, lastSeen } = action.payload
      state.statuses[userId] = {
        status,
        lastSeen: lastSeen !== undefined ? lastSeen : state.statuses[userId]?.lastSeen || null,
      }
    },
    bulkUpdateStatuses: (
      state,
      action: PayloadAction<Array<{ user_id: string; status: string; last_seen?: string | null }>>
    ) => {
      for (const item of action.payload) {
        state.statuses[item.user_id] = {
          status: item.status,
          lastSeen: item.last_seen || null,
        }
      }
    },
  },
})

export const { updateUserStatus, bulkUpdateStatuses } = presenceSlice.actions
export default presenceSlice.reducer
```

### Файл 7: `frontend/src/app/feed/messages/ScheduleMessageModal.tsx`
```tsx
'use client'

import React, { useEffect, useState } from 'react'
import { LuX, LuClock } from 'react-icons/lu'

type ScheduleMessageModalProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (scheduledAt: string) => void
  chatLabel?: string
}

function getDefaultDatetimeLocal(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function ScheduleMessageModal({
  isOpen,
  onClose,
  onConfirm,
  chatLabel,
}: ScheduleMessageModalProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setValue(getDefaultDatetimeLocal())
      setError('')
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = () => {
    if (!value) {
      setError('Укажите дату и время')
      return
    }
    const at = new Date(value).getTime()
    if (!Number.isFinite(at)) {
      setError('Неверный формат даты')
      return
    }
    if (at <= Date.now()) {
      setError('Время должно быть в будущем')
      return
    }
    onConfirm(new Date(value).toISOString())
  }

  return (
    <div
      className='fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'
      onClick={onClose}
    >
      <div
        className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200'
        onClick={e => e.stopPropagation()}
      >
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-bold text-white flex items-center gap-2'>
            <LuClock className='w-5 h-5 text-blue-500' />
            Отложить сообщение
          </h3>
          <button
            onClick={onClose}
            className='p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition'
          >
            <LuX className='w-5 h-5' />
          </button>
        </div>

        {chatLabel && (
          <p className='text-sm text-gray-400 mb-4'>
            Получатель: <span className='text-gray-200 font-medium'>{chatLabel}</span>
          </p>
        )}

        <div className='space-y-3 mb-5'>
          <label className='block text-xs uppercase font-semibold text-gray-400 tracking-wider'>
            Дата и время отправки
          </label>
          <input
            type='datetime-local'
            value={value}
            onChange={e => {
              setValue(e.target.value)
              setError('')
            }}
            className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50'
          />
          {error && <p className='text-xs text-red-400'>{error}</p>}
        </div>

        <div className='flex gap-3 justify-end'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition'
          >
            Отмена
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            className='px-5 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition shadow-lg shadow-blue-600/20'
          >
            Запланировать
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Файл 8: `frontend/src/app/feed/messages/ForwardModal.tsx`
```tsx
'use client'

import React, { useState } from 'react'
import { LuX, LuSearch, LuUser, LuUsers, LuRadio } from 'react-icons/lu'

export interface ForwardTarget {
  id: string
  kind: 'user' | 'group' | 'channel'
  label: string
  sub?: string
  avatarUrl?: string
}

interface ForwardModalProps {
  isOpen: boolean
  onClose: () => void
  onForward: (target: ForwardTarget) => void
  targets: ForwardTarget[]
  previewText?: string
  count?: number
}

export default function ForwardModal({
  isOpen,
  onClose,
  onForward,
  targets,
  previewText,
  count = 1,
}: ForwardModalProps) {
  const [query, setQuery] = useState('')

  if (!isOpen) return null

  const filtered = targets.filter(t =>
    t.label.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div
      className='fixed inset-0 bg-black/70 backdrop-blur-sm z-[99999] flex items-center justify-center p-4'
      onClick={onClose}
    >
      <div
        className='bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]'
        onClick={e => e.stopPropagation()}
      >
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-bold text-white'>
            Переслать {count > 1 ? `${count} сообщений` : 'сообщение'}
          </h3>
          <button
            onClick={onClose}
            className='p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition'
          >
            <LuX className='w-5 h-5' />
          </button>
        </div>

        <div className='relative mb-3'>
          <LuSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400' />
          <input
            type='text'
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Поиск чатов, групп, каналов...'
            autoFocus
            className='w-full bg-gray-800 border border-gray-700 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50'
          />
        </div>

        {previewText && (
          <div className='mb-3 p-2.5 rounded-xl bg-gray-800/40 border border-gray-800 text-xs text-gray-300 truncate'>
            <span className='text-gray-500 uppercase tracking-wider block text-[10px] mb-0.5'>
              Содержимое
            </span>
            {previewText}
          </div>
        )}

        <div className='flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-1'>
          {filtered.length === 0 ? (
            <div className='text-center py-8 text-sm text-gray-500'>
              Ничего не найдено
            </div>
          ) : (
            filtered.map(target => (
              <button
                key={`${target.kind}:${target.id}`}
                onClick={() => {
                  onForward(target)
                  onClose()
                }}
                className='w-full flex items-center gap-3 p-3 rounded-xl bg-gray-800/30 hover:bg-gray-800 border border-transparent hover:border-gray-700 text-left transition group'
              >
                <div className='w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center shrink-0 text-gray-300 overflow-hidden'>
                  {target.avatarUrl ? (
                    <img
                      src={target.avatarUrl}
                      alt={target.label}
                      className='w-full h-full object-cover'
                    />
                  ) : target.kind === 'channel' ? (
                    <LuRadio className='w-5 h-5 text-sky-400' />
                  ) : target.kind === 'group' ? (
                    <LuUsers className='w-5 h-5 text-indigo-400' />
                  ) : (
                    <LuUser className='w-5 h-5 text-blue-400' />
                  )}
                </div>
                <div className='flex-1 min-w-0'>
                  <div className='text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors'>
                    {target.label}
                  </div>
                  <div className='text-xs text-gray-500 uppercase tracking-wider text-[10px]'>
                    {target.sub || (target.kind === 'user' ? 'Личный чат' : target.kind === 'group' ? 'Группа' : 'Канал')}
                  </div>
                </div>
                <span className='text-xs text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity'>
                  Отправить
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
```

### Файл 9: `frontend/src/app/feed/messages/DeleteChatHistoryModal.tsx`
```tsx
'use client'

import React from 'react'
import { LuTrash2, LuX } from 'react-icons/lu'

export type DeleteHistoryScope = 'for_me' | 'for_all'

type Props = {
  isOpen: boolean
  isLoading?: boolean
  chatLabel?: string
  canDeleteForAll?: boolean
  onClose: () => void
  onConfirm: (scope: DeleteHistoryScope) => void
}

export default function DeleteChatHistoryModal({
  isOpen,
  isLoading = false,
  chatLabel,
  canDeleteForAll = true,
  onClose,
  onConfirm,
}: Props) {
  if (!isOpen) return null

  return (
    <div
      className='fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
      onClick={onClose}
    >
      <div
        className='w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200'
        onClick={e => e.stopPropagation()}
      >
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-bold text-white flex items-center gap-2'>
            <LuTrash2 className='w-5 h-5 text-red-500' />
            Очистить историю сообщений
          </h3>
          <button
            onClick={onClose}
            className='p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition'
          >
            <LuX className='w-5 h-5' />
          </button>
        </div>

        <p className='text-sm text-gray-400 mb-6 leading-relaxed'>
          {chatLabel ? (
            <>
              Чат с <span className='text-gray-200 font-medium'>{chatLabel}</span>.
              <br />
            </>
          ) : null}
          Это действие необратимо. Выберите способ удаления истории.
        </p>

        <div className='flex flex-col gap-2.5 mb-6'>
          <button
            type='button'
            disabled={isLoading}
            onClick={() => onConfirm('for_me')}
            className='w-full rounded-xl border border-gray-700 bg-gray-800/60 p-3.5 text-left text-sm text-gray-200 hover:bg-gray-800 transition disabled:opacity-50'
          >
            <div className='font-medium text-white'>Удалить только у себя</div>
            <div className='text-xs text-gray-400 mt-0.5'>
              Сообщения останутся у других участников
            </div>
          </button>

          {canDeleteForAll && (
            <button
              type='button'
              disabled={isLoading}
              onClick={() => onConfirm('for_all')}
              className='w-full rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 text-left text-sm text-red-300 hover:bg-red-500/20 transition disabled:opacity-50'
            >
              <div className='font-medium text-red-200'>Удалить для всех</div>
              <div className='text-xs text-red-400/80 mt-0.5'>
                История будет удалена безвозвратно для всех участников
              </div>
            </button>
          )}
        </div>

        <div className='flex justify-end'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm text-gray-300 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition'
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Файл 10: `frontend/src/components/calls/ActiveVoiceChannel.tsx`
```tsx
'use client'

import React from 'react'
import { LuMic, LuMicOff, LuPhoneOff, LuUsers } from 'react-icons/lu'

export interface VoiceParticipant {
  userId: string
  username: string
  avatarUrl?: string
  socketId: string
  isSpeaking?: boolean
}

export interface ActiveVoiceChannelProps {
  channelId: string
  channelName?: string
  participants: VoiceParticipant[]
  isMuted: boolean
  onMuteToggle: () => void
  onLeave: () => void
}

export default function ActiveVoiceChannel({
  channelId,
  channelName = 'Голосовой канал',
  participants,
  isMuted,
  onMuteToggle,
  onLeave,
}: ActiveVoiceChannelProps) {
  return (
    <div className='fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2'>
      <div className='bg-gray-900/95 border border-gray-700 rounded-2xl px-4 py-3 shadow-2xl backdrop-blur-md min-w-[280px] max-w-[90vw]'>
        <div className='flex items-center justify-between mb-3'>
          <div className='flex items-center gap-2'>
            <LuUsers className='w-4 h-4 text-emerald-400' />
            <span className='text-sm font-semibold text-white truncate max-w-[180px]'>
              {channelName}
            </span>
            <span className='text-xs text-gray-400 px-1.5 py-0.5 rounded bg-gray-800'>
              {participants.length + 1}
            </span>
          </div>
        </div>

        <div className='flex items-center gap-2 mb-3 overflow-x-auto pb-1 custom-scrollbar'>
          {/* Local User */}
          <div className='flex flex-col items-center gap-1 shrink-0'>
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ${
                isMuted ? 'bg-gray-700 ring-gray-600' : 'bg-emerald-600 ring-emerald-400'
              }`}
            >
              Вы
            </div>
            <span className='text-[10px] text-gray-300 truncate max-w-[48px]'>Вы</span>
          </div>

          {/* Remote Participants */}
          {participants.map(p => (
            <div key={p.socketId} className='flex flex-col items-center gap-1 shrink-0'>
              {p.avatarUrl ? (
                <img
                  src={p.avatarUrl}
                  alt={p.username}
                  className={`w-10 h-10 rounded-full object-cover ring-2 ${
                    p.isSpeaking ? 'ring-emerald-400 animate-pulse' : 'ring-gray-700'
                  }`}
                />
              ) : (
                <div
                  className={`w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center text-white text-xs font-medium ring-2 ${
                    p.isSpeaking ? 'ring-emerald-400 animate-pulse' : 'ring-gray-700'
                  }`}
                >
                  {p.username[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <span className='text-[10px] text-gray-300 truncate max-w-[48px]'>
                {p.username}
              </span>
            </div>
          ))}
        </div>

        <div className='flex items-center justify-center gap-3 pt-2 border-t border-gray-800'>
          <button
            onClick={onMuteToggle}
            className={`p-2.5 rounded-full transition ${
              isMuted
                ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                : 'bg-gray-800 text-gray-200 hover:bg-gray-700'
            }`}
            title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
          >
            {isMuted ? <LuMicOff className='w-4 h-4' /> : <LuMic className='w-4 h-4' />}
          </button>
          <button
            onClick={onLeave}
            className='p-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition'
            title='Выйти из канала'
          >
            <LuPhoneOff className='w-4 h-4' />
          </button>
        </div>
      </div>
    </div>
  )
}
```

### Файл 11: `frontend/src/components/calls/DiscordCallModal.tsx`
```tsx
'use client'

import React, { useRef, useEffect } from 'react'
import { LuMic, LuMicOff, LuVideo, LuVideoOff, LuScreenShare, LuPhoneOff } from 'react-icons/lu'

export interface CallParticipantStream {
  userId: string
  username: string
  stream?: MediaStream
  isMuted?: boolean
  isVideoOff?: boolean
}

export interface DiscordCallModalProps {
  isOpen: boolean
  onClose: () => void
  participants: CallParticipantStream[]
  localStream: MediaStream | null
  isMuted: boolean
  isVideoOff: boolean
  isScreenSharing: boolean
  onToggleMute: () => void
  onToggleVideo: () => void
  onToggleScreenShare: () => void
  title?: string
}

function VideoTile({ stream, username, isLocal = false }: { stream?: MediaStream; username: string; isLocal?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (ref.current && stream) {
      ref.current.srcObject = stream
    }
  }, [stream])

  return (
    <div className='relative w-full h-full rounded-2xl overflow-hidden bg-gray-900 border border-gray-800 flex items-center justify-center shadow-lg'>
      {stream ? (
        <video
          ref={ref}
          autoPlay
          playsInline
          muted={isLocal}
          className='w-full h-full object-cover'
        />
      ) : (
        <div className='w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center text-white text-2xl font-bold'>
          {username[0]?.toUpperCase() || 'U'}
        </div>
      )}
      <div className='absolute bottom-3 left-3 bg-black/60 backdrop-blur-md px-3 py-1 rounded-lg text-xs font-medium text-white'>
        {username} {isLocal && '(Вы)'}
      </div>
    </div>
  )
}

export default function DiscordCallModal({
  isOpen,
  onClose,
  participants,
  localStream,
  isMuted,
  isVideoOff,
  isScreenSharing,
  onToggleMute,
  onToggleVideo,
  onToggleScreenShare,
  title = 'Групповой звонок',
}: DiscordCallModalProps) {
  if (!isOpen) return null

  const gridCols =
    participants.length <= 1
      ? 'grid-cols-1 md:grid-cols-2'
      : participants.length <= 4
      ? 'grid-cols-2'
      : 'grid-cols-3'

  return (
    <div className='fixed inset-0 z-[100000] bg-black/90 backdrop-blur-md flex flex-col'>
      <div className='h-14 px-6 border-b border-gray-800 flex items-center justify-between'>
        <div className='text-sm font-semibold text-white'>{title}</div>
        <div className='text-xs text-gray-400'>
          Участников: {participants.length + 1}
        </div>
      </div>

      <div className={`flex-1 p-6 grid ${gridCols} gap-4 overflow-hidden relative`}>
        {participants.map(p => (
          <VideoTile
            key={p.userId}
            stream={p.stream}
            username={p.username}
          />
        ))}

        <VideoTile
          stream={localStream || undefined}
          username='Вы'
          isLocal
        />
      </div>

      <div className='h-20 border-t border-gray-800 flex items-center justify-center gap-4 bg-gray-950/80'>
        <button
          onClick={onToggleMute}
          className={`p-3.5 rounded-full transition ${
            isMuted ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
          title={isMuted ? 'Включить звук' : 'Выключить звук'}
        >
          {isMuted ? <LuMicOff className='w-5 h-5' /> : <LuMic className='w-5 h-5' />}
        </button>

        <button
          onClick={onToggleVideo}
          className={`p-3.5 rounded-full transition ${
            isVideoOff ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
          title={isVideoOff ? 'Включить видео' : 'Выключить видео'}
        >
          {isVideoOff ? <LuVideoOff className='w-5 h-5' /> : <LuVideo className='w-5 h-5' />}
        </button>

        <button
          onClick={onToggleScreenShare}
          className={`p-3.5 rounded-full transition ${
            isScreenSharing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
          title='Демонстрация экрана'
        >
          <LuScreenShare className='w-5 h-5' />
        </button>

        <button
          onClick={onClose}
          className='p-3.5 rounded-full bg-red-600 hover:bg-red-500 text-white transition'
          title='Завершить звонок'
        >
          <LuPhoneOff className='w-5 h-5' />
        </button>
      </div>
    </div>
  )
}
```

---

## 4. ДЕТАЛЬНЫЕ ИЗМЕНЕНИЯ В 6 СУЩЕСТВУЮЩИХ ФАЙЛАХ

### 4.1. `frontend/src/lib/types.ts`
Добавить типы пересылки в интерфейс `Message`:
```typescript
export interface Message {
  id: string
  sender_id: string
  content: string
  timestamp: string
  isOwn: boolean
  is_read?: boolean
  channel_id?: string
  group_id?: string
  reply_to?: string
  type?: 'text' | 'voice' | 'image' | 'file' | 'game' | 'poll'
  attachments?: any[] | string
  is_deleted?: boolean
  is_edited?: boolean
  sender_username?: string
  sender_avatar?: string | null
  forwarded_from?: {
    sender_id: string
    sender_name: string
    sender_avatar?: string | null
    chat_name?: string
  }
}
```

### 4.2. `frontend/src/lib/store.ts`
Подключить `presenceReducer`:
```typescript
import { configureStore } from '@reduxjs/toolkit'
import authReducer from './features/authSlice'
import postsReducer from './features/postsSlice'
import presenceReducer from './features/presenceSlice'

export const makeStore = () => {
  return configureStore({
    reducer: {
      auth: authReducer,
      posts: postsReducer,
      presence: presenceReducer,
    },
  })
}

export type AppStore = ReturnType<typeof makeStore>
export type RootState = ReturnType<AppStore['getState']>
export type AppDispatch = AppStore['dispatch']
```

### 4.3. `frontend/src/lib/SocketContext.tsx`
В районе строки 215 заменить `console.log` на диспатч в Redux:
```typescript
import { updateUserStatus } from './features/presenceSlice'

// Внутри функции инициализации сокета:
socketInstance.on('user_status_changed', (data: { user_id: string; status: string }) => {
  dispatch(updateUserStatus({ userId: data.user_id, status: data.status }))
})
```

### 4.4. `frontend/src/components/calls/index.ts`
Экспортировать новые компоненты:
```typescript
export { default as ActiveCall } from './ActiveCall'
export { default as ActiveGroupCall } from './ActiveGroupCall'
export { default as CallButton } from './CallButton'
export { default as IncomingCallModal } from './IncomingCallModal'
export { WebRTCProvider } from './WebRTCProvider'
export { GlobalCallUI } from './GlobalCallUI'
export { IntegratedCallPanel } from './IntegratedCallPanel'
export { ScreenShareViewer } from './ScreenShareViewer'
export { ChatMenu } from './ChatMenu'
export { default as ActiveVoiceChannel } from './ActiveVoiceChannel'
export { default as DiscordCallModal } from './DiscordCallModal'
```

### 4.5. `frontend/src/app/feed/messages/MessageBubble.tsx`
1. **Контекстное меню по ПКМ**:
   - На внешний контейнер сообщения навесить `onContextMenu`:
     ```tsx
     onContextMenu={(e) => {
       e.preventDefault()
       setIsMenuOpen(true)
     }}
     ```
   - В выпадающее меню включить действия: «Ответить», «Переслать», «Копировать текст», «Закрепить/Открепить», «Реакция», для собственных сообщений — «Изменить» и «Удалить».

2. **Waveform плеер голосовых сообщений**:
   - Заменить блок `<audio controls>` при `msg.type === 'voice'` на плеер с круглой кнопкой play/pause, массивом полос SVG/Flex высотой `24px` и таймером.

3. **Отображение пересылки**:
   - При наличии `msg.forwarded_from` выводить плашку:
     ```tsx
     {msg.forwarded_from && (
       <div className='text-xs text-blue-400/90 mb-1 flex items-center gap-1 font-medium'>
         <LuRepeat2 className='w-3.5 h-3.5' />
         <span>Переслано от {msg.forwarded_from.sender_name}</span>
       </div>
     )}
     ```

### 4.6. `frontend/src/app/feed/messages/page.tsx`
1. **Папки чатов**:
   - Подключить `loadChatFolders`, `saveChatFolders`, `loadActiveFolderId`, `saveActiveFolderId`, `matchesActiveFolder`.
   - Добавить таб-бар папок `[Все] [Работа] [Личные] [+]` над сайдбаром.
   - Фильтровать список чатов `sidebarList` с помощью `matchesActiveFolder(chatFolders, activeFolderId, chatRef)`.

2. **Отложенные сообщения**:
   - Добавить иконку часов рядом с кнопкой отправки сообщения.
   - По клику открывать `ScheduleMessageModal`.
   - При подтверждении вызывать `createScheduled(...)` и сохранять в локальное состояние.

3. **Панель закреплённого сообщения**:
   - При наличии закрепленного сообщения рендерить в шапке чата:
     `📌 Закреплено: {previewText} [Клик -> jumpToMessage] [× Открепить]`.

4. **Поиск в чате (Chat Search)**:
   - Кнопка 🔍 в шапке открывает поисковую строку.
   - При вводе фильтровать сообщения, подсвечивать совпадения и навигировать стрелками ↑ / ↓.

5. **Предпросмотр файлов перед отправкой**:
   - Если `files.length > 0`, рендерить над инпутом горизонтальную панель карточек файлов:
     - Для изображений: миниатюра `URL.createObjectURL(file)`.
     - Для прочих файлов: иконка документа, имя, размер.
     - Кнопка ✕ для удаления файла из списка.

6. **Меню чата в сайдбаре (⋮)**:
   - При hover на чат показывать кнопку `⋮`.
   - Интегрировать компонент `ChatMenu` с пунктами: «Закрепить», «Отключить уведомления», «В папку...», «Очистить историю».

7. **Модалка пересылки (Forward Modal)**:
   - При клике «Переслать» открывать `ForwardModal`.
   - При выборе адресата отправлять сокет-событие `send_message` с объектом `forwarded_from`.

8. **Удаление истории (DeleteChatHistoryModal)**:
   - Открытие модалки по пункту «Удалить историю».
   - Вызов API `DELETE /api/v1/messages/history` с `target_id` и выбранным скоупом (`for_me` или `for_all`).

---

## 5. ЧЕК-ЛИСТ ПРОВЕРКИ РЕАЛИЗАЦИИ

1. [ ] Папки чатов создаются, сохраняются в `localStorage`, переключение вкладки корректно фильтрует список чатов.
2. [ ] Отложенные сообщения: модалка валидирует время и отправляет запрос на планирование.
3. [ ] Контекстное меню по правому клику мыши открывается и содержит все заявленные действия.
4. [ ] Пересылка: модалка позволяет найти получателя, в отправленном сообщении видна плашка «Переслано от».
5. [ ] Закрепленное сообщение отображается в шапке чата, клик плавно прокручивает список к нему.
6. [ ] Поиск по сообщениям находит совпадения и осуществляет навигацию с подсветкой.
7. [ ] Голосовые сообщения отображаются в виде waveform с корректным воспроизведением.
8. [ ] Выбранные файлы отображаются в виде миниатюр над инпутом перед отправкой.
9. [ ] Очистка истории запрашивает подтверждение и корректно удаляет сообщения.
10. [ ] Redux presence: статус пользователей меняется на `online`/`offline` при сокет-событии `user_status_changed`.
11. [ ] Компоненты звонков `ActiveVoiceChannel` и `DiscordCallModal` компилируются без ошибок TypeScript.
