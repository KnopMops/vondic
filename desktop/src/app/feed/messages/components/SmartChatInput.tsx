'use client'

import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { getAvatarUrl } from '@/lib/utils'
import { Message } from '@/lib/types'

interface MentionUser {
  id: string
  username: string
  avatar_url?: string | null
}

interface SmartChatInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend?: () => void
  inputRef?: React.RefObject<HTMLTextAreaElement | null> | React.MutableRefObject<HTMLTextAreaElement | null>
  disabled?: boolean
  placeholder?: string
  users?: MentionUser[]
  messages?: Message[]
  onScrollToMessage?: (messageId: string) => void
  className?: string
}

type SuggestionType = 'mention' | 'media' | null

export default function SmartChatInput({
  value,
  onChange,
  onKeyDown,
  onSend,
  inputRef,
  disabled,
  placeholder,
  users = [],
  messages = [],
  onScrollToMessage,
  className,
}: SmartChatInputProps) {
  const [suggestionType, setSuggestionType] = useState<SuggestionType>(null)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [cursorPos, setCursorPos] = useState(0)
  const localRef = useRef<HTMLTextAreaElement | null>(null)
  const textareaRef = inputRef || localRef
  const popupRef = useRef<HTMLDivElement>(null)
  const triggerIndexRef = useRef(-1)

  const mediaMessages = useMemo(() => {
    return (messages || []).filter(
      m =>
        m.type === 'image' ||
        m.type === 'file' ||
        m.type === 'voice' ||
        m.type === 'video' ||
        (m.attachments && m.attachments.length > 0),
    )
  }, [messages])

  const filteredUsers = useMemo(() => {
    if (suggestionType !== 'mention') return []
    const q = query.toLowerCase()
    return (users || []).filter(
      u =>
        u.username?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
    )
  }, [suggestionType, query, users])

  const filteredMedia = useMemo(() => {
    if (suggestionType !== 'media') return []
    const q = query.toLowerCase()
    let items = mediaMessages
    if (q) {
      items = items.filter(m => {
        const content = (m.content || '').toLowerCase()
        const type = m.type || 'text'
        return content.includes(q) || type.includes(q)
      })
    }
    // Limit to recent 20
    return items.slice(-20).reverse()
  }, [suggestionType, query, mediaMessages])

  const suggestions = suggestionType === 'mention' ? filteredUsers : filteredMedia

  const getTriggerIndex = useCallback(() => {
    const el = textareaRef.current
    if (!el) return -1
    const pos = el.selectionStart
    const text = el.value.slice(0, pos)
    const atIndex = text.lastIndexOf('@')
    const hashIndex = text.lastIndexOf('#')
    const lastIndex = Math.max(atIndex, hashIndex)
    if (lastIndex === -1) return -1
    // Check there's a space or start before the trigger
    const charBefore = text[lastIndex - 1]
    if (lastIndex > 0 && charBefore !== ' ' && charBefore !== '\n') return -1
    // Determine which trigger is closest to cursor (and after any space)
    if (atIndex > hashIndex) {
      const afterAt = text.slice(atIndex + 1)
      // If there's a space after @, cancel
      if (afterAt.includes(' ') || afterAt.includes('\n')) return -1
      return atIndex
    }
    if (hashIndex > atIndex) {
      const afterHash = text.slice(hashIndex + 1)
      if (afterHash.includes(' ') || afterHash.includes('\n')) return -1
      return hashIndex
    }
    return -1
  }, [textareaRef])

  const detectSuggestion = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    const pos = el.selectionStart
    const text = el.value.slice(0, pos)
    const atIndex = text.lastIndexOf('@')
    const hashIndex = text.lastIndexOf('#')
    const lastTrigger = Math.max(atIndex, hashIndex)

    if (lastTrigger === -1) {
      setSuggestionType(null)
      return
    }

    const charBefore = text[lastTrigger - 1]
    if (lastTrigger > 0 && charBefore !== ' ' && charBefore !== '\n') {
      setSuggestionType(null)
      return
    }

    const afterTrigger = text.slice(lastTrigger + 1)
    if (afterTrigger.includes(' ') || afterTrigger.includes('\n')) {
      setSuggestionType(null)
      return
    }

    triggerIndexRef.current = lastTrigger
    setQuery(afterTrigger)
    setSelectedIndex(0)

    if (lastTrigger === atIndex) {
      setSuggestionType('mention')
    } else {
      setSuggestionType('media')
    }
  }, [textareaRef])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e)
    // Defer detection so value updates
    setTimeout(detectSuggestion, 0)
  }

  const insertSuggestion = useCallback(
    (item: MentionUser | Message) => {
      const el = textareaRef.current
      if (!el) return
      const pos = el.selectionStart
      const text = el.value
      const triggerIdx = triggerIndexRef.current
      if (triggerIdx === -1) return

      let insertText = ''
      if (suggestionType === 'mention' && 'username' in item) {
        insertText = `@${item.username} `
      } else if (suggestionType === 'media' && 'id' in item) {
        insertText = `#media:${item.id} `
        if (onScrollToMessage) {
          onScrollToMessage(item.id)
        }
      }

      const before = text.slice(0, triggerIdx)
      const after = text.slice(pos)
      const newValue = before + insertText + after

      // We need to update the textarea value and cursor
      // Since this component doesn't own state, we simulate change
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLTextAreaElement.prototype,
        'value',
      )?.set
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(el, newValue)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }

      onChange({
        target: el,
        currentTarget: el,
      } as React.ChangeEvent<HTMLTextAreaElement>)

      setSuggestionType(null)
      triggerIndexRef.current = -1

      setTimeout(() => {
        const newCursor = before.length + insertText.length
        el.setSelectionRange(newCursor, newCursor)
        el.focus()
      }, 0)
    },
    [textareaRef, suggestionType, onChange, onScrollToMessage],
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (suggestionType && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertSuggestion(suggestions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        setSuggestionType(null)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend?.()
      return
    }

    onKeyDown?.(e)
  }

  // Auto resize
  const handleInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement
    target.style.height = 'auto'
    target.style.height = `${Math.min(target.scrollHeight, 128)}px`
  }

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target as Node) &&
        !textareaRef.current?.contains(e.target as Node)
      ) {
        setSuggestionType(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [textareaRef])

  const showPopup = suggestionType && suggestions.length > 0

  return (
    <div className="relative flex-1">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        rows={1}
        disabled={disabled}
        className={
          className ||
          'w-full flex-1 bg-transparent border-none text-white placeholder-gray-500 focus:ring-0 resize-none py-2.5 max-h-32 min-h-[44px] custom-scrollbar'
        }
        placeholder={placeholder}
        style={{ height: 'auto', minHeight: '44px' }}
      />

      {showPopup && (
        <div
          ref={popupRef}
          className="absolute bottom-full left-0 mb-2 w-full max-w-xs bg-gray-900 border border-gray-700 rounded-xl shadow-2xl z-50 max-h-60 overflow-y-auto custom-scrollbar"
        >
          <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-800">
            {suggestionType === 'mention'
              ? 'Упомянуть пользователя'
              : 'Медиа в чате'}
          </div>
          {suggestionType === 'mention' &&
            (suggestions as MentionUser[]).map((u, idx) => (
              <button
                key={u.id}
                onClick={() => insertSuggestion(u)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                  idx === selectedIndex ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                }`}
              >
                <img
                  src={getAvatarUrl(u.avatar_url)}
                  alt={u.username}
                  className="w-8 h-8 rounded-full object-cover bg-gray-800"
                />
                <div>
                  <div className="text-sm text-white font-medium">{u.username}</div>
                  <div className="text-xs text-gray-500">{u.id.slice(0, 8)}...</div>
                </div>
              </button>
            ))}
          {suggestionType === 'media' &&
            (suggestions as Message[]).map((m, idx) => {
              let label = ''
              if (m.type === 'image') label = '🖼 Фото'
              else if (m.type === 'video') label = '🎬 Видео'
              else if (m.type === 'voice') label = '🎤 Голосовое'
              else if (m.type === 'file') label = '📎 Файл'
              else label = '📎 Вложение'
              const preview =
                m.content?.length > 30
                  ? m.content.slice(0, 30) + '...'
                  : m.content || label

              return (
                <button
                  key={m.id}
                  onClick={() => insertSuggestion(m)}
                  className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                    idx === selectedIndex ? 'bg-gray-800' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-sm shrink-0">
                    {label.split(' ')[0]}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm text-white truncate">{label}</div>
                    <div className="text-xs text-gray-500 truncate">{preview}</div>
                  </div>
                </button>
              )
            })}
        </div>
      )}
    </div>
  )
}
