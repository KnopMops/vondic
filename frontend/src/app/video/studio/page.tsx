'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import VideoPlayer from '@/components/social/VideoPlayer'
import { useAuth } from '@/lib/AuthContext'

type VideoItem = {
  id: string
  title: string
  url: string
  poster?: string | null
  views?: number
  likes?: number
}

export default function StudioPage() {
  const { user } = useAuth()
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const fetchMyVideos = async () => {
    if (!user?.id) return
    const params = new URLSearchParams({
      user_id: String(user.id),
      sort: 'created_at',
      order: 'desc',
      limit: '100',
    })
    const res = await fetch(`/api/videos?${params.toString()}`, {
      cache: 'no-store',
    })
    if (res.ok) {
      const data = await res.json()
      setVideos(Array.isArray(data) ? data : [])
    }
  }

  useEffect(() => {
    fetchMyVideos()
  }, [user?.id])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIsUploading(true)
    try {
      const ext = (file.name.split('.').pop() || '').toLowerCase()
      const buf = await file.arrayBuffer()
      const base64 = Buffer.from(buf).toString('base64')
      const dataUrl = `data:video/${ext};base64,${base64}`
      const upRes = await fetch('/api/upload/video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: dataUrl, filename: file.name }),
      })
      if (!upRes.ok) throw new Error(await upRes.text())
      const up = await upRes.json()
      const url = up.url
      const createRes = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: file.name,
          url,
        }),
      })
      if (!createRes.ok) throw new Error(await createRes.text())
      await fetchMyVideos()
    } catch {
    } finally {
      setIsUploading(false)
      e.target.value = ''
    }
  }

  return (
    <div className='min-h-screen bg-black text-gray-100'>
      <header className='sticky top-0 z-20 flex h-14 items-center border-b border-gray-800 bg-[#0f0f0f]/95 px-4'>
        <div className='flex items-center gap-4 w-full max-w-7xl mx-auto'>
          <Link
            href='/video'
            className='flex h-8 items-center rounded-full px-3 text-sm hover:bg-white/5'
          >
            Моя студия
          </Link>
          <div className='ml-auto flex items-center gap-2'>
            <label className='h-9 rounded-full border border-gray-700 bg-[#222] px-4 text-xs font-semibold text-gray-100 hover:bg-[#333] cursor-pointer'>
              {isUploading ? 'Загрузка...' : 'Загрузить видео'}
              <input
                type='file'
                accept='video/*'
                onChange={handleUpload}
                className='hidden'
              />
            </label>
            <Link
              href='/video'
              className='hidden sm:inline-flex h-9 items-center rounded-full border border-gray-700 bg-[#222] px-4 text-xs font-semibold text-gray-100 hover:bg-[#333]'
            >
              Главная
            </Link>
          </div>
        </div>
      </header>
      <main className='mx-auto w-full max-w-7xl px-4 py-4'>
        <h1 className='text-xl font-semibold mb-4'>Ваши видео</h1>
        <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
          {videos.map(v => (
            <div
              key={v.id}
              className='overflow-hidden rounded-xl bg-[#181818]'
            >
              <VideoPlayer src={v.url} poster={v.poster || null} className='w-full' />
              <div className='flex gap-3 p-3 text-sm'>
                <div className='mt-1 h-8 w-8 flex-shrink-0 rounded-full bg-gray-700' />
                <div className='min-w-0 space-y-1'>
                  <div className='font-semibold line-clamp-2'>{v.title}</div>
                  <div className='text-xs text-gray-400'>
                    {(v.views || 0)} просмотров · {(v.likes || 0)} лайков
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
