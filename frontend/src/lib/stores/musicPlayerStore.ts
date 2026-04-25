import { create } from 'zustand'
import { audioManager } from '@/lib/services/musicPlayer'

interface Track {
  id: string
  title: string
  artist: string
  duration: string
  url: string
  original_id?: string
}

interface MusicPlayerState {
  // State
  currentTrack: Track | null
  isPlaying: boolean
  currentTime: number
  duration: number
  volume: number
  isMuted: boolean
  isShuffled: boolean
  repeatMode: 'none' | 'all' | 'one'
  queue: Track[]
  queuePosition: number

  // Actions
  setCurrentTrack: (track: Track | null) => void
  setIsPlaying: (playing: boolean) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setVolume: (volume: number) => void
  setIsMuted: (muted: boolean) => void
  setIsShuffled: (shuffled: boolean) => void
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void
  setQueue: (queue: Track[]) => void
  setQueuePosition: (position: number) => void

  // Helper actions
  playTrack: (track: Track, queue?: Track[]) => void
  togglePlay: () => void
  nextTrack: () => void
  previousTrack: () => void
  toggleShuffle: () => void
  toggleRepeat: () => void
  seek: (time: number) => void
  toggleMute: () => void
  reset: () => void
}

function getAudio(): HTMLAudioElement {
  return audioManager.getAudio()
}

export const useMusicPlayerStore = create<MusicPlayerState>((set, get) => ({
  // Initial state
  currentTrack: null,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.7,
  isMuted: false,
  isShuffled: false,
  repeatMode: 'none',
  queue: [],
  queuePosition: -1,

  // Actions
  setCurrentTrack: (track) => set({ currentTrack: track }),
  setIsPlaying: (playing) => {
    const audio = getAudio()
    if (playing) {
      audio.play().catch(() => set({ isPlaying: false }))
    } else {
      audio.pause()
    }
    set({ isPlaying: playing })
  },
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setVolume: (vol) => {
    set({ volume: vol })
    const audio = getAudio()
    const state = get()
    audio.volume = state.isMuted ? 0 : vol
  },
  setIsMuted: (muted) => {
    set({ isMuted: muted })
    const audio = getAudio()
    const state = get()
    audio.volume = muted ? 0 : state.volume
  },
  setIsShuffled: (shuffled) => set({ isShuffled: shuffled }),
  setRepeatMode: (mode) => set({ repeatMode: mode }),
  setQueue: (queue) => set({ queue }),
  setQueuePosition: (position) => set({ queuePosition: position }),

  // Helper actions
  playTrack: (track, queue) => set((state) => {
    const newQueue = queue || state.queue
    const position = newQueue.findIndex(t => t.id === track.id)
    const audio = getAudio()
    audio.src = track.url
    audio.play().catch(() => {})
    return {
      currentTrack: track,
      isPlaying: true,
      queue: newQueue,
      queuePosition: position >= 0 ? position : state.queuePosition,
    }
  }),

  togglePlay: () => {
    const state = get()
    if (state.isPlaying) {
      getAudio().pause()
    } else {
      getAudio().play().catch(() => {})
    }
    set({ isPlaying: !state.isPlaying })
  },

  nextTrack: () => set((state) => {
    if (state.queue.length === 0) return state

    let nextPosition: number
    if (state.isShuffled) {
      nextPosition = Math.floor(Math.random() * state.queue.length)
    } else {
      nextPosition = state.queuePosition + 1
      if (nextPosition >= state.queue.length) {
        nextPosition = state.repeatMode === 'all' ? 0 : state.queuePosition
      }
    }

    if (nextPosition === state.queuePosition && state.repeatMode === 'one') {
      const audio = getAudio()
      audio.currentTime = 0
      audio.play().catch(() => {})
      return { currentTime: 0, isPlaying: true }
    }

    const nextTrack = state.queue[nextPosition]
    const audio = getAudio()
    audio.src = nextTrack.url
    audio.play().catch(() => {})
    return {
      queuePosition: nextPosition,
      currentTrack: nextTrack,
      currentTime: 0,
      isPlaying: true,
    }
  }),

  previousTrack: () => set((state) => {
    if (state.queue.length === 0) return state

    // If more than 3 seconds in, restart current track
    if (state.currentTime > 3) {
      getAudio().currentTime = 0
      return { currentTime: 0 }
    }

    let prevPosition = state.queuePosition - 1
    if (prevPosition < 0) {
      prevPosition = state.repeatMode === 'all' ? state.queue.length - 1 : 0
    }

    const prevTrack = state.queue[prevPosition]
    const audio = getAudio()
    audio.src = prevTrack.url
    audio.play().catch(() => {})
    return {
      queuePosition: prevPosition,
      currentTrack: prevTrack,
      currentTime: 0,
      isPlaying: true,
    }
  }),

  toggleShuffle: () => set((state) => ({ isShuffled: !state.isShuffled })),

  toggleRepeat: () => set((state) => {
    const modes: Array<'none' | 'all' | 'one'> = ['none', 'all', 'one']
    const currentIndex = modes.indexOf(state.repeatMode)
    const nextIndex = (currentIndex + 1) % modes.length
    return { repeatMode: modes[nextIndex] }
  }),

  seek: (time) => set(() => {
    getAudio().currentTime = time
    return { currentTime: time }
  }),

  toggleMute: () => set((state) => {
    const newMuted = !state.isMuted
    getAudio().volume = newMuted ? 0 : state.volume
    return { isMuted: newMuted }
  }),

  reset: () => set({
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    queue: [],
    queuePosition: -1,
  }),
}))
