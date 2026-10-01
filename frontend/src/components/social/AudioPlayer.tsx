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
  const [playbackRate, setPlaybackRate] = useState<number>(1)

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    const onLoaded = () => setDuration(a.duration || 0)
    const onTime = () => setCurrentTime(a.currentTime || 0)
    const onEnded = () => setIsPlaying(false)
    a.addEventListener('loadedmetadata', onLoaded)
    a.addEventListener('timeupdate', onTime)
    a.addEventListener('ended', onEnded)
    a.volume = volume
    a.muted = isMuted
    a.playbackRate = playbackRate

    const handleSeekEvent = (e: any) => {
      const timeStr = e.detail?.timeStr
      if (!timeStr || !audioRef.current) return
      const parts = timeStr.split(':').map(Number)
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const secs = parts[0] * 60 + parts[1]
        audioRef.current.currentTime = secs
        setCurrentTime(secs)
        audioRef.current.play()
        setIsPlaying(true)
      }
    }
    window.addEventListener('vondic-seek-media', handleSeekEvent)

    return () => {
      a.removeEventListener('loadedmetadata', onLoaded)
      a.removeEventListener('timeupdate', onTime)
      a.removeEventListener('ended', onEnded)
      window.removeEventListener('vondic-seek-media', handleSeekEvent)
    }
  }, [])

  useEffect(() => {
    const a = audioRef.current
    if (!a) return
    a.playbackRate = playbackRate
  }, [playbackRate])

  const cyclePlaybackRate = () => {
    const rates = [1, 1.5, 2]
    const nextIdx = (rates.indexOf(playbackRate) + 1) % rates.length
    setPlaybackRate(rates[nextIdx])
  }

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
    <div className={`w-full rounded-xl bg-black/30 border border-white/10 px-3 py-2 backdrop-blur-sm ${className || ''}`}>
      <audio ref={audioRef} src={getAttachmentUrl(src)} />
      <div className='flex items-center gap-2'>
        <button
          onClick={togglePlay}
          className='rounded-lg p-2 text-white bg-indigo-600 hover:bg-indigo-500 transition shadow-sm shrink-0'
          type='button'
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause size={15} /> : <Play size={15} />}
        </button>
        <button
          type='button'
          onClick={cyclePlaybackRate}
          className='rounded-lg px-1.5 py-1 text-[11px] font-bold text-indigo-300 hover:text-white bg-white/5 hover:bg-white/15 transition select-none shrink-0'
          title='Скорость воспроизведения'
        >
          {playbackRate}x
        </button>
        <input
          type='range'
          min={0}
          max={Math.max(1, duration)}
          step={0.1}
          value={currentTime}
          onChange={handleSeek}
          className='flex-1 h-1 accent-indigo-500 cursor-pointer'
        />
        <span className='text-[10px] text-gray-300 whitespace-nowrap font-mono'>
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>
        <button
          onClick={toggleMute}
          className='rounded-md p-1 text-white/70 hover:text-white hover:bg-white/10 transition shrink-0'
          type='button'
          aria-label={isMuted ? 'Unmute' : 'Mute'}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </button>
        <input
          type='range'
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={handleVolume}
          className='w-16 h-1 accent-indigo-500 cursor-pointer hidden sm:block'
        />
      </div>
    </div>
  )
}
