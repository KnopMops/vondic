import { useEffect, useRef, useState } from 'react'
import { getAttachmentUrl } from '@/lib/utils'
import {
	LuPause as Pause,
	LuPlay as Play,
	LuVolume2 as Volume2,
	LuVolumeX as VolumeX,
} from 'react-icons/lu'

type Props = {
  src: string
  className?: string
}

export default function AudioPlayer({ src, className }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onLoaded = () => setDuration(a.duration || 0)
    const onTime = () => setCurrentTime(a.currentTime || 0)
    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('timeupdate', onTime)
    a.volume = volume
    a.muted = isMuted
    return () => {
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('timeupdate', onTime)
    }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.volume = volume
  }, [volume])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.muted = isMuted
  }, [isMuted])

  const togglePlay = () => {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      a.play()
      setIsPlaying(true)
    } else {
      a.pause()
      setIsPlaying(false)
    }
  }

  const formatTime = (t: number) => {
    const s = Math.floor(t % 60)
    const m = Math.floor((t / 60) % 60)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(m)}:${pad(s)}`
  }

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const a = audioRef.current
    if (!a) return
    const val = Number(e.target.value)
    a.currentTime = val
    setCurrentTime(val)
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value)
    setVolume(val)
    setIsMuted(val === 0)
  }

  const toggleMute = () => setIsMuted(x => !x)

  return (
    <div className={`w-full rounded-lg bg-black/20 border border-white/10 px-3 py-2 ${className || ''}`}>
      <audio ref={audioRef} src={getAttachmentUrl(src)} />
      <div className='flex items-center gap-2'>
        <button
          onClick={togglePlay}
          className='rounded-md p-1.5 text-white bg-white/10 hover:bg-white/20 transition'
          type='button'
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <input
          type='range'
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className='flex-1 h-1 accent-indigo-500'
        />
        <span className='text-[10px] text-gray-300 whitespace-nowrap'>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button
          onClick={toggleMute}
          className='rounded-md p-1.5 text-white bg-white/10 hover:bg-white/20 transition'
          type='button'
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type='range'
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={handleVolume}
          className='w-20 h-1 accent-indigo-500'
        />
      </div>
    </div>
  )
}
