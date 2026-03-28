'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MoreVertical, Pin, PinOff, Bell, BellOff, Phone, Video, Archive, Trash2 } from 'lucide-react'

interface ChatMenuProps {
    chatId: string
    chatType?: 'user' | 'group' | 'channel'
    isPinned?: boolean
    isMuted?: boolean
    isOnline?: boolean
    onPin?: () => void
    onMute?: () => void
    onCall?: () => void
    onVideoCall?: () => void
    onArchive?: () => void
    onDelete?: () => void
}

export const ChatMenu: React.FC<ChatMenuProps> = ({
    chatId,
    chatType = 'user',
    isPinned = false,
    isMuted = false,
    isOnline = false,
    onPin,
    onMute,
    onCall,
    onVideoCall,
    onArchive,
    onDelete,
}) => {
    const [isOpen, setIsOpen] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false)
            }
        }

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside)
        }
    }, [isOpen])

    return (
        <div className='relative' ref={menuRef}>
            {/* Three Dots Button */}
            <button
                onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    console.log('Three dots clicked, isOpen:', isOpen)
                    setIsOpen(!isOpen)
                }}
                className='p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer'
                title='Действия с чатом'
                type='button'
            >
                <MoreVertical className='w-4 h-4' />
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className='absolute right-0 top-full mt-1 w-56 bg-[#2b2d31] border border-[#1e1f22] rounded-xl shadow-2xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200'>
                    {/* Pin/Unpin */}
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onPin?.()
                            setIsOpen(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#35373c] transition-colors ${
                            isPinned ? 'text-emerald-400' : 'text-gray-300'
                        }`}
                        type='button'
                    >
                        {isPinned ? (
                            <>
                                <PinOff className='w-4 h-4' />
                                <span>Открепить чат</span>
                            </>
                        ) : (
                            <>
                                <Pin className='w-4 h-4' />
                                <span>Закрепить чат</span>
                            </>
                        )}
                    </button>

                    {/* Mute/Unmute */}
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onMute?.()
                            setIsOpen(false)
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-[#35373c] transition-colors ${
                            isMuted ? 'text-amber-400' : 'text-gray-300'
                        }`}
                        type='button'
                    >
                        {isMuted ? (
                            <>
                                <BellOff className='w-4 h-4' />
                                <span>Включить уведомления</span>
                            </>
                        ) : (
                            <>
                                <Bell className='w-4 h-4' />
                                <span>Отключить уведомления</span>
                            </>
                        )}
                    </button>

                    {/* Divider */}
                    <div className='my-2 border-t border-[#1e1f22]' />

                    {/* Call Actions (for users) */}
                    {chatType === 'user' && (
                        <>
                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onCall?.()
                                    setIsOpen(false)
                                }}
                                className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#35373c] transition-colors'
                                type='button'
                            >
                                <Phone className='w-4 h-4' />
                                <span>Аудиозвонок</span>
                            </button>

                            <button
                                onClick={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    onVideoCall?.()
                                    setIsOpen(false)
                                }}
                                className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#35373c] transition-colors'
                                type='button'
                            >
                                <Video className='w-4 h-4' />
                                <span>Видеозвонок</span>
                            </button>

                            <div className='my-2 border-t border-[#1e1f22]' />
                        </>
                    )}

                    {/* Archive */}
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onArchive?.()
                            setIsOpen(false)
                        }}
                        className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-[#35373c] transition-colors'
                        type='button'
                    >
                        <Archive className='w-4 h-4' />
                        <span>Архивировать</span>
                    </button>

                    {/* Delete */}
                    <button
                        onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            onDelete?.()
                            setIsOpen(false)
                        }}
                        className='w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors'
                        type='button'
                    >
                        <Trash2 className='w-4 h-4' />
                        <span>Удалить чат</span>
                    </button>

                    {/* Online Status Indicator */}
                    {chatType === 'user' && (
                        <>
                            <div className='my-2 border-t border-[#1e1f22]' />
                            <div className='px-4 py-2 text-xs text-gray-500'>
                                <div className='flex items-center gap-2'>
                                    <div className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500' : 'bg-gray-500'}`} />
                                    <span>{isOnline ? 'В сети' : 'Не в сети'}</span>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    )
}
