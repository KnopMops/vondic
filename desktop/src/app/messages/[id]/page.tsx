'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useAuth } from '@/lib/AuthContext'
import { useChat } from '@/lib/hooks/useChat'
import MessengerPage from '@/app/feed/messages/page'

export default function MessagePage() {
  const params = useParams()
  const router = useRouter()
  const { user, loading } = useAuth()
  const { openChat, chats } = useChat()

  const chatId = params.id as string

  useEffect(() => {
    if (loading) return
    if (!user) {
      router.push('/login')
      return
    }

    // Try to find existing chat or open new one
    const existingChat = chats.find(c => 
      c.target_id === chatId || c.sender_id === chatId
    )

    if (existingChat) {
      // Chat exists, it will be opened automatically via the chat store
      return
    }

    // Open new chat with this user/bot
    openChat(chatId)
  }, [chatId, user, loading, openChat, chats, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center">
        <div className="text-white">Загрузка...</div>
      </div>
    )
  }

  // Render the main messenger page which will show the chat
  return <MessengerPage />
}
