'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import BrandLogo from './social/BrandLogo'
import { FiArrowLeft as ArrowLeft, FiHome as Home } from 'react-icons/fi'

interface ErrorPageProps {
    code: number
    title: string
    message: string
    showRedirect?: boolean
}

export const ErrorPage: React.FC<ErrorPageProps> = ({
    code,
    title,
    message,
    showRedirect = true,
}) => {
    const router = useRouter()
    const [timeLeft, setTimeLeft] = useState(10)

    useEffect(() => {
        if (!showRedirect) return

        const timer = setInterval(() => {
            setTimeLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer)
                    router.push('/')
                    return 0
                }
                return prev - 1
            })
        }, 1000)

        return () => clearInterval(timer)
    }, [showRedirect, router])

    const goBack = () => {
        router.back()
    }

    return (
        <div className="min-h-screen bg-[#0b0c0d] flex flex-col items-center justify-center p-4 text-white">
            <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
                
                <div className="relative inline-block">
                    <div className="w-32 h-32 bg-indigo-500/20 rounded-full flex items-center justify-center animate-pulse">
                        <BrandLogo size={64} />
                    </div>
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full border-2 border-[#0b0c0d]">
                        {code}
                    </div>
                </div>

                <div className="space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">
                        {title}
                    </h1>
                    <p className="text-gray-400 text-lg">
                        {message}
                    </p>
                </div>

                {showRedirect && (
                    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                        <p className="text-sm text-gray-500">
                            Автоматический возврат на главную через <span className="text-indigo-400 font-mono font-bold">{timeLeft}</span> сек.
                        </p>
                    </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={goBack}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/10 rounded-full transition-all text-sm font-medium"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Вернуться назад
                    </button>
                    <button
                        onClick={() => router.push('/')}
                        className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 rounded-full transition-all text-sm font-medium shadow-lg shadow-indigo-500/20"
                    >
                        <Home className="w-4 h-4" />
                        На главную
                    </button>
                </div>
            </div>
        </div>
    )
}
