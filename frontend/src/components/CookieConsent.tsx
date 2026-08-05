'use client'

import { useState, useEffect } from 'react'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const accepted = localStorage.getItem('cookie_consent')
    if (!accepted) {
      setVisible(true)
    }
  }, [])

  const accept = () => {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem('cookie_consent', 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className='fixed bottom-0 left-0 right-0 z-[99999] p-4 md:p-6 pointer-events-none'>
      <div className='max-w-2xl mx-auto pointer-events-auto bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-5 shadow-2xl shadow-black/40'>
        <div className='flex flex-col sm:flex-row items-start sm:items-center gap-4'>
          <div className='flex-1 min-w-0'>
            <p className='text-sm text-gray-200 leading-relaxed'>
              Мы используем файлы cookie для улучшения работы сайта, анализа трафика и персонализации контента.
              Продолжая использовать сайт, вы соглашаетесь с{' '}
              <a
                href='https://s3.vondic.ru/uploads/docs/privacy_policy.rtf'
                target='_blank'
                rel='noopener'
                className='text-indigo-400 hover:text-indigo-300 underline underline-offset-2'
              >
                Политикой конфиденциальности
              </a>{' '}
              и использованием cookie.
            </p>
          </div>
          <div className='flex gap-2 shrink-0'>
            <button
              onClick={decline}
              className='px-4 py-2 text-sm font-medium text-gray-400 hover:text-white border border-white/10 hover:border-white/20 rounded-lg transition-colors'
            >
              Отклонить
            </button>
            <button
              onClick={accept}
              className='px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition-colors shadow-lg shadow-indigo-500/20'
            >
              Принять
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
