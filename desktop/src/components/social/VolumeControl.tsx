import {
	LuVolume1 as Volume1,
	LuVolume2 as Volume2,
	LuVolumeX as VolumeX,
} from 'react-icons/lu'
import { useState, useRef, useEffect } from 'react'

type Props = {
  volume: number
  onChange: (volume: number) => void
  isMuted: boolean
  onMuteToggle: () => void
  className?: string
}

export default function VolumeControl({
  volume,
  onChange,
  isMuted,
  onMuteToggle,
  className = '',
}: Props) {
  const [isHovered, setIsHovered] = useState(false)
  const sliderRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const displayVolume = isMuted ? 0 : volume
  const percentage = displayVolume * 100

  const getVolumeIcon = () => {
    if (isMuted || volume === 0) return <VolumeX size={18} />
    if (volume < 0.5) return <Volume1 size={18} />
    return <Volume2 size={18} />
  }

  const handleSliderClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!sliderRef.current) return
    const rect = sliderRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const newVolume = Math.max(0, Math.min(1, x / rect.width))
    onChange(newVolume)
    if (newVolume > 0 && isMuted) {
      onMuteToggle()
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleSliderClick(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return
    handleSliderClick(e)
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false)
      window.addEventListener('mouseup', handleGlobalMouseUp)
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging])

  return (
    <div
      className={`flex items-center gap-2 group/volume ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        onClick={onMuteToggle}
        className='rounded-full p-1.5 text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-150'
        type='button'
        aria-label={isMuted ? 'Unmute' : 'Mute'}
      >
        {getVolumeIcon()}
      </button>
      <div
        ref={sliderRef}
        className={`relative w-0 overflow-hidden transition-all duration-300 ease-out cursor-pointer ${
          isHovered || isDragging ? 'w-24 md:w-28' : 'w-0'
        }`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div className='absolute inset-0 flex items-center px-1'>
          <div className='relative w-full h-1 bg-white/20 rounded-full group-hover/volume:h-1.5 transition-all duration-150'>
            <div
              className='absolute left-0 top-0 h-full bg-white rounded-full transition-all duration-75'
              style={{ width: `${percentage}%` }}
            />
            <div
              className='absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover/volume:opacity-100 transition-opacity duration-150'
              style={{ left: `calc(${percentage}% - 6px)` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
