'use client'

import { useMusicPlayerStore } from '@/lib/stores/musicPlayerStore'
import { audioManager } from '@/lib/services/musicPlayer'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useCallback } from 'react'
import {
  FiMaximize2 as Maximize2,
  FiMusic as Music,
  FiPause as Pause,
  FiPlay as Play,
  FiRepeat as Repeat,
  FiShuffle as Shuffle,
  FiSkipBack as SkipBack,
  FiSkipForward as SkipForward,
  FiVolume2 as Volume2,
  FiVolumeX as VolumeX,
  FiX as X,
} from 'react-icons/fi'
import Link from 'next/link'

export default function GlobalPlayer() {
  const pathname = usePathname()
  const isOnMusicPage = pathname === '/feed/music'

  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isShuffled,
    repeatMode,
    queue,
    queuePosition,
    setIsPlaying,
    setCurrentTime,
    setDuration,
    setVolume,
    setIsMuted,
    nextTrack,
    previousTrack,
    toggleShuffle,
    toggleRepeat,
    seek,
    toggleMute,
  } = useMusicPlayerStore()

  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Initialize audio element
  useEffect(() => {
    if (isOnMusicPage) return

    if (!audioRef.current) {
      audioRef.current = audioManager.getAudio()
    }

    const audio = audioRef.current
    audio.volume = isMuted ? 0 : volume

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
    const handleLoadedMetadata = () => setDuration(audio.duration)
    const handleEnded = () => {
      if (repeatMode === 'one') {
        audio.currentTime = 0
        audio.play().catch(() => setIsPlaying(false))
      } else {
        nextTrack()
      }
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.removeEventListener('ended', handleEnded)
    }
  }, [isOnMusicPage, repeatMode, nextTrack, setCurrentTime, setDuration, setIsPlaying, volume, isMuted])

  // Handle track change
  useEffect(() => {
    if (isOnMusicPage) return
    if (!audioRef.current || !currentTrack) return

    if (audioRef.current.src !== currentTrack.url) {
      audioRef.current.src = currentTrack.url
    }
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    }
  }, [isOnMusicPage, currentTrack, isPlaying, setIsPlaying])

  // Handle play/pause
  useEffect(() => {
    if (isOnMusicPage) return
    if (!audioRef.current || !currentTrack) return

    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    } else {
      audioRef.current.pause()
    }
  }, [isOnMusicPage, isPlaying, currentTrack, setIsPlaying])

  // Handle volume change
  useEffect(() => {
    if (isOnMusicPage) return
    if (!audioRef.current) return
    audioRef.current.volume = isMuted ? 0 : volume
  }, [volume, isMuted])

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value)
      seek(time)
      if (audioRef.current) {
        audioRef.current.currentTime = time
      }
    },
    [seek]
  )

  const handleVolumeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVolume = parseFloat(e.target.value)
      setVolume(newVolume)
      if (newVolume > 0 && isMuted) {
        setIsMuted(false)
      }
      if (audioRef.current) {
        audioRef.current.volume = newVolume
      }
    },
    [setVolume, isMuted, setIsMuted]
  )

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00'
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (!currentTrack) {
    return null
  }

  // If on music page, don't show mini player (the music page has its own player)
  if (isOnMusicPage) {
    return null
  }

  return (
    <div className='fixed top-0 left-0 right-0 z-50 bg-gray-950/90 backdrop-blur-xl border-b border-gray-800/50 shadow-[0_4px_20px_rgba(0,0,0,0.4)]'>
      <div className='max-w-[1600px] mx-auto px-4 py-2'>
        <div className='flex items-center gap-4'>
          {/* Track Info */}
          <div className='flex items-center gap-3 flex-shrink-0'>
            <div className='w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/20'>
              <Music className='w-5 h-5 text-white' />
            </div>
            <div className='min-w-0 max-w-[200px]'>
              <div className='text-sm font-semibold text-white truncate'>
                {currentTrack.title}
              </div>
              <div className='text-xs text-gray-400 truncate'>
                {currentTrack.artist}
              </div>
            </div>
          </div>

          {/* Player Controls */}
          <div className='flex-1 flex flex-col items-center gap-1'>
            <div className='flex items-center gap-3'>
              <button
                onClick={toggleShuffle}
                className={`p-1.5 transition-all hover:scale-110 ${
                  isShuffled
                    ? 'text-emerald-500'
                    : 'text-gray-400 hover:text-white'
                }`}
                title='Перемешать'
              >
                <Shuffle className='w-4 h-4' />
              </button>
              <button
                onClick={previousTrack}
                className='p-1.5 text-gray-400 hover:text-white transition-all hover:scale-110'
                title='Предыдущий'
              >
                <SkipBack className='w-5 h-5 fill-current' />
              </button>
              <button
                onClick={() => setIsPlaying(!isPlaying)}
                className='w-9 h-9 rounded-full bg-white text-black flex items-center justify-center transition-all hover:scale-110 shadow-lg'
                title={isPlaying ? 'Пауза' : 'Играть'}
              >
                {isPlaying ? (
                  <Pause className='w-5 h-5 fill-current' />
                ) : (
                  <Play className='w-5 h-5 fill-current ml-0.5' />
                )}
              </button>
              <button
                onClick={nextTrack}
                className='p-1.5 text-gray-400 hover:text-white transition-all hover:scale-110'
                title='Следующий'
              >
                <SkipForward className='w-5 h-5 fill-current' />
              </button>
              <button
                onClick={toggleRepeat}
                className={`p-1.5 transition-all hover:scale-110 relative ${
                  repeatMode !== 'none'
                    ? 'text-emerald-500'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={
                  repeatMode === 'none'
                    ? 'Повтор'
                    : repeatMode === 'all'
                    ? 'Повтор всех'
                    : 'Повтор одного'
                }
              >
                <Repeat className='w-4 h-4' />
                {repeatMode === 'one' && (
                  <span className='absolute top-0 right-0 text-[7px] font-black'>
                    1
                  </span>
                )}
              </button>
            </div>

            {/* Progress Bar */}
            <div className='w-full flex items-center gap-2'>
              <span className='text-[10px] font-medium text-gray-500 w-8 text-right'>
                {formatTime(currentTime)}
              </span>
              <div className='flex-1 group relative h-1 flex items-center'>
                <input
                  type='range'
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className='absolute inset-0 w-full h-1 bg-gray-800 rounded-full appearance-none cursor-pointer z-10 opacity-0 group-hover:opacity-100'
                />
                <div className='w-full h-1 bg-gray-800 rounded-full overflow-hidden'>
                  <div
                    className='h-full bg-emerald-600 transition-all duration-100'
                    style={{
                      width: `${(currentTime / (duration || 1)) * 100}%`,
                    }}
                  />
                </div>
                <div
                  className='absolute w-2.5 h-2.5 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity'
                  style={{
                    left: `calc(${(currentTime / (duration || 1)) * 100}% - 5px)`,
                  }}
                />
              </div>
              <span className='text-[10px] font-medium text-gray-500 w-8'>
                {formatTime(duration)}
              </span>
            </div>
          </div>

          {/* Volume & Actions */}
          <div className='flex items-center gap-2 flex-shrink-0'>
            <button
              onClick={toggleMute}
              className='p-1.5 text-gray-400 hover:text-white transition-all hover:scale-110'
            >
              {isMuted || volume === 0 ? (
                <VolumeX className='w-4 h-4' />
              ) : (
                <Volume2 className='w-4 h-4' />
              )}
            </button>
            <div className='relative w-20 h-1 group/vol'>
              <input
                type='range'
                min='0'
                max='1'
                step='0.01'
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className='w-full h-1 rounded-full appearance-none cursor-pointer bg-gray-800 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:group-hover/vol:opacity-100 [&::-webkit-slider-thumb]:transition-opacity'
                style={{
                  background: `linear-gradient(to right, #10b981 0%, #10b981 ${(isMuted ? 0 : volume) * 100}%, #1f2937 ${(isMuted ? 0 : volume) * 100}%, #1f2937 100%)`,
                }}
              />
            </div>

            {/* Link to music page */}
            <Link
              href='/feed/music'
              className='p-1.5 text-gray-400 hover:text-white transition-all hover:scale-110'
              title='Открыть плеер'
            >
              <Maximize2 className='w-4 h-4' />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
