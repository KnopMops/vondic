'use client'

import { useEffect } from 'react'
import { useMusicPlayerStore } from '@/lib/stores/musicPlayerStore'

interface Track {
  id: string
  title: string
  artist: string
  duration: string
  url: string
  original_id?: string
}

/**
 * Hook to sync local player state with the global music player store.
 * This ensures that when a user plays music on the /feed/music page,
 * it continues playing globally across all pages.
 */
export function useMusicPlayerSync(
  tracks: Track[],
  currentTrackId: string | null,
  isPlaying: boolean,
  currentTime: number,
  duration: number,
  volume: number,
  isMuted: boolean,
  isShuffled: boolean,
  repeatMode: 'none' | 'all' | 'one',
  setCurrentTime: (time: number) => void,
  setDuration: (duration: number) => void,
  setVolume: (volume: number) => void,
  setIsMuted: (muted: boolean) => void,
  setIsPlaying: (playing: boolean) => void,
  setCurrentTrackId: (id: string) => void,
  setIsShuffled: (shuffled: boolean) => void,
  setRepeatMode: (mode: 'none' | 'all' | 'one') => void,
) {
  const {
    currentTrack: globalTrack,
    isPlaying: globalIsPlaying,
    currentTime: globalCurrentTime,
    duration: globalDuration,
    volume: globalVolume,
    isMuted: globalIsMuted,
    isShuffled: globalIsShuffled,
    repeatMode: globalRepeatMode,
    queue: globalQueue,
    queuePosition: globalQueuePosition,
    setCurrentTrack,
    setIsPlaying: setGlobalIsPlaying,
    setCurrentTime: setGlobalCurrentTime,
    setDuration: setGlobalDuration,
    setVolume: setGlobalVolume,
    setIsMuted: setGlobalIsMuted,
    setIsShuffled: setGlobalIsShuffled,
    setRepeatMode: setGlobalRepeatMode,
    setQueue,
    seek,
    togglePlay,
    nextTrack,
    previousTrack,
    toggleShuffle: globalToggleShuffle,
    toggleRepeat: globalToggleRepeat,
  } = useMusicPlayerStore()

  // Sync queue when tracks change
  useEffect(() => {
    if (tracks.length > 0) {
      setQueue(tracks)
    }
  }, [tracks, setQueue])

  // Sync when local currentTrackId changes
  useEffect(() => {
    if (currentTrackId) {
      const track = tracks.find(t => t.id === currentTrackId)
      if (track) {
        setCurrentTrack(track)
        const position = tracks.findIndex(t => t.id === currentTrackId)
        // Update queue position is handled by playTrack action
      }
    }
  }, [currentTrackId, tracks, setCurrentTrack])

  // Sync play/pause state
  useEffect(() => {
    setGlobalIsPlaying(isPlaying)
  }, [isPlaying, setGlobalIsPlaying])

  // Sync volume
  useEffect(() => {
    setGlobalVolume(volume)
  }, [volume, setGlobalVolume])

  // Sync mute
  useEffect(() => {
    setGlobalIsMuted(isMuted)
  }, [isMuted, setGlobalIsMuted])

  // Sync shuffle
  useEffect(() => {
    setGlobalIsShuffled(isShuffled)
  }, [isShuffled, setGlobalIsShuffled])

  // Sync repeat mode
  useEffect(() => {
    setGlobalRepeatMode(repeatMode)
  }, [repeatMode, setGlobalRepeatMode])

  // Sync duration when loaded
  useEffect(() => {
    if (duration > 0) {
      setGlobalDuration(duration)
    }
  }, [duration, setGlobalDuration])

  // Sync current time from global store back to local
  useEffect(() => {
    if (globalCurrentTime !== currentTime && Math.abs(globalCurrentTime - currentTime) > 0.5) {
      setCurrentTime(globalCurrentTime)
    }
  }, [globalCurrentTime, currentTime, setCurrentTime])

  // Return global controls that can override local state
  return {
    globalControls: {
      globalIsPlaying,
      globalCurrentTime,
      globalDuration,
      globalVolume,
      globalIsMuted,
      globalIsShuffled,
      globalRepeatMode,
      seek,
      togglePlay,
      nextTrack,
      previousTrack,
      globalToggleShuffle,
      globalToggleRepeat,
    }
  }
}
