'use client'

import Header from '@/components/social/Header'
import { useAuth } from '@/lib/AuthContext'
import { useMusicPlayerStore } from '@/lib/stores/musicPlayerStore'
import { audioManager } from '@/lib/services/musicPlayer'
import { AnimatePresence, motion } from 'framer-motion'
import {
	FiDownload as Download,
	FiLayout as Layout,
	FiList as List,
	FiMusic as Music,
	FiPause as Pause,
	FiPlay as Play,
	FiPlus as Plus,
	FiRepeat as Repeat,
	FiShare2 as Share2,
	FiShuffle as Shuffle,
	FiSkipBack as SkipBack,
	FiSkipForward as SkipForward,
	FiTrash2 as Trash2,
	FiUpload as Upload,
	FiUser as User,
	FiVolume2 as Volume2,
	FiVolumeX as VolumeX,
	FiX as X,
} from 'react-icons/fi'
import { LuPin as Pin, LuPinOff as PinOff } from 'react-icons/lu'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

interface Track {
	id: string
	title: string
	artist: string
	duration: string
	file?: File
	url: string
	// Backend track structure
	original_id?: string
}

interface Playlist {
	id: string
	name: string
	description?: string
	cover_image?: string
	owner_id: string
	is_public: boolean
	is_pinned: boolean
	tracks: Track[]
	track_count: number
	created_at: string
	updated_at: string
	// Client-side compatibility
	trackIds?: string[]
}

export default function MusicPage() {
	const { user, isLoading: isAuthLoading, isInitialized } = useAuth()
	const router = useRouter()
	
	// Global player store integration
	const { 
		playTrack: playTrackGlobal, 
		nextTrack: nextTrackGlobal, 
		previousTrack: previousTrackGlobal,
		setIsPlaying: setIsPlayingGlobal,
		setCurrentTrack: setCurrentTrackGlobal,
	} = useMusicPlayerStore()

	// State
	const [tracks, setTracks] = useState<Track[]>([])
	const [playlists, setPlaylists] = useState<Playlist[]>([])
	const [currentTrackId, setCurrentTrackId] = useState<string | null>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [currentTime, setCurrentTime] = useState(0)
	const [duration, setDuration] = useState(0)
	const [volume, setVolume] = useState(0.7)
	const [isMuted, setIsMuted] = useState(false)
	const [isShuffled, setIsShuffled] = useState(false)
	const [repeatMode, setRepeatMode] = useState<'none' | 'all' | 'one'>('none')
	const [activeView, setActiveView] = useState<'tracks' | 'playlist'>('tracks')
	const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(
		null,
	)
	const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
	const [showDeletePlaylistModal, setShowDeletePlaylistModal] = useState<string | null>(null)
	const [newPlaylistName, setNewPlaylistName] = useState('')
	const [selectedTracksForPlaylist, setSelectedTracksForPlaylist] = useState<
		Set<string>
	>(new Set())
	const [showAddToPlaylist, setShowAddToPlaylist] = useState<string | null>(
		null,
	)
	const [displayMode, setDisplayMode] = useState<'classic' | 'new'>('classic')
	const [showNewInterfaceModal, setShowNewInterfaceModal] = useState(false)
	const [pinnedPlaylists, setPinnedPlaylists] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
	const [borrowRequests, setBorrowRequests] = useState<any[]>([])
	const [showBorrowRequests, setShowBorrowRequests] = useState(false)
	const [processingBorrowId, setProcessingBorrowId] = useState<string | null>(null)

	// Backend URL helper
	const backendUrl =
		process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5050'

	// Load preferences
	useEffect(() => {
		const savedMode = localStorage.getItem('vmusic_display_mode') as
			| 'classic'
			| 'new'
		if (savedMode) {
			setDisplayMode(savedMode)
		} else {
			setShowNewInterfaceModal(true)
		}

		const savedPinned = localStorage.getItem('vmusic_pinned_playlists')
		if (savedPinned) {
			setPinnedPlaylists(JSON.parse(savedPinned))
		}

		// Load playlists from backend
		if (isInitialized && user) {
			loadPlaylistsFromBackend()
		}
	}, [isInitialized, user])

	// Load playlists from backend
	const loadPlaylistsFromBackend = async () => {
		try {
			setIsLoading(true)
			const response = await fetch('/api/playlists', {
				method: 'GET',
				headers: { 'Content-Type': 'application/json' },
			})

			if (response.ok) {
				const backendPlaylists = await response.json()
				
				// Save to localStorage as backup
				localStorage.setItem('vmusic_playlists', JSON.stringify(backendPlaylists))
				
				// Convert backend playlists to frontend format
				const convertedPlaylists = backendPlaylists.map((pl: any) => ({
					...pl,
					trackIds: pl.tracks?.map((t: any) => t.original_id || t.id) || [],
				}))
				setPlaylists(convertedPlaylists)

				// Add backend tracks to tracks state
				const allTracks: Track[] = []
				backendPlaylists.forEach((pl: any) => {
					pl.tracks?.forEach((track: any) => {
						if (
							!allTracks.find(
								(t: Track) => t.id === track.original_id || t.id === track.id,
							)
						) {
							// Ensure track has a proper URL
							const trackWithUrl: Track = {
								...track,
								id: track.original_id || track.id,
								url: track.url
									? track.url.startsWith('http')
										? track.url
										: `${backendUrl}${track.url}`
									: '',
							}
							allTracks.push(trackWithUrl)
						}
					})
				})
				
				// Save tracks to localStorage
				localStorage.setItem('vmusic_tracks', JSON.stringify(allTracks))
				
				setTracks(prev => {
					const existingIds = new Set(prev.map(t => t.id))
					const newTracks = allTracks.filter(
						(t: Track) => !existingIds.has(t.id),
					)
					return [...prev, ...newTracks]
				})
			} else {
				// If backend fetch failed, try loading from localStorage
				console.warn(`Backend returned status ${response.status}, trying localStorage fallback`)
				loadFromLocalStorage()
			}
		} catch (error) {
			console.error('Failed to load playlists from backend:', error)
			// Try loading from localStorage as fallback
			loadFromLocalStorage()
		} finally {
			setIsLoading(false)
		}
	}

	const loadBorrowRequests = useCallback(async () => {
		try {
			const res = await fetch('/api/playlists/borrow/requests', { method: 'GET' })
			if (res.ok) {
				const data = await res.json()
				const items = Array.isArray(data?.items) ? data.items : data?.items || []
				setBorrowRequests(items)
			} else {
				setBorrowRequests([])
			}
		} catch {
			setBorrowRequests([])
		}
	}, [])

	useEffect(() => {
		if (!isInitialized || !user) return
		loadBorrowRequests()
		const t = setInterval(loadBorrowRequests, 15000)
		return () => clearInterval(t)
	}, [isInitialized, user, loadBorrowRequests])

	const approveBorrow = async (borrowId: string) => {
		try {
			setProcessingBorrowId(borrowId)
			const res = await fetch(`/api/playlists/borrow/requests/${borrowId}/approve`, {
				method: 'POST',
			})
			if (res.ok) {
				await loadBorrowRequests()
			}
		} finally {
			setProcessingBorrowId(null)
		}
	}

	const rejectBorrow = async (borrowId: string) => {
		try {
			setProcessingBorrowId(borrowId)
			const res = await fetch(`/api/playlists/borrow/requests/${borrowId}/reject`, {
				method: 'POST',
			})
			if (res.ok) {
				await loadBorrowRequests()
			}
		} finally {
			setProcessingBorrowId(null)
		}
	}

	const syncBorrowedPlaylist = async (playlistId: string) => {
		try {
			setIsLoading(true)
			const res = await fetch(`/api/playlists/borrow/${playlistId}/sync`, {
				method: 'POST',
			})
			if (res.ok) {
				await loadPlaylistsFromBackend()
			} else {
				const t = await res.text()
				alert(t || 'Не удалось синхронизировать')
			}
		} finally {
			setIsLoading(false)
		}
	}

	// Load from localStorage as fallback
	const loadFromLocalStorage = () => {
		try {
			const savedPlaylists = localStorage.getItem('vmusic_playlists')
			const savedTracks = localStorage.getItem('vmusic_tracks')

			if (savedPlaylists) {
				const playlistsData = JSON.parse(savedPlaylists)
				const convertedPlaylists = playlistsData.map((pl: any) => ({
					...pl,
					trackIds: pl.tracks?.map((t: any) => t.original_id || t.id) || [],
				}))
				setPlaylists(convertedPlaylists)
			}

			if (savedTracks) {
				const tracksData = JSON.parse(savedTracks)
				setTracks(tracksData)
			}
		} catch (error) {
			console.error('Failed to load from localStorage:', error)
		}
	}

	// Save preferences
	useEffect(() => {
		localStorage.setItem('vmusic_display_mode', displayMode)
	}, [displayMode])

	useEffect(() => {
		localStorage.setItem(
			'vmusic_pinned_playlists',
			JSON.stringify(pinnedPlaylists),
		)
	}, [pinnedPlaylists])

	// Refs
	const handleNextRef = useRef<() => void>(() => {})
	const fileInputRef = useRef<HTMLInputElement | null>(null)

	// Initialize audio element
	useEffect(() => {
		const audio = audioManager.getAudio()
		audio.volume = isMuted ? 0 : volume

		const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
		const handleLoadedMetadata = () => setDuration(audio.duration)
		const handleEnded = () => {
			if (repeatMode === 'one') {
				audio.currentTime = 0
				audio.play().catch(() => setIsPlaying(false))
			} else {
				handleNextRef.current()
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
	}, [repeatMode, volume, isMuted])

	// Update playback when currentTrackId changes
	useEffect(() => {
		if (!currentTrackId) return

		const track = tracks.find(t => t.id === currentTrackId)
		if (track) {
			const audio = audioManager.getAudio()
			if (audio.src !== track.url) {
				audio.src = track.url
			}
			if (isPlaying) {
				audio.play().catch(() => setIsPlaying(false))
			}
		}
	}, [currentTrackId, tracks])

	// Handle play/pause
	useEffect(() => {
		if (!currentTrackId) return
		const audio = audioManager.getAudio()

		if (isPlaying) {
			audio.play().catch(() => setIsPlaying(false))
		} else {
			audio.pause()
		}
	}, [isPlaying, currentTrackId])

	// Handle volume change
	useEffect(() => {
		const audio = audioManager.getAudio()
		audio.volume = isMuted ? 0 : volume
	}, [volume, isMuted])

	const formatTime = (time: number) => {
		if (isNaN(time)) return '0:00'
		const minutes = Math.floor(time / 60)
		const seconds = Math.floor(time % 60)
		return `${minutes}:${seconds.toString().padStart(2, '0')}`
	}

	const handleUploadMusic = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = e.target.files
		if (!files || files.length === 0) return

		const fileList = Array.from(files).filter(file =>
			file.type.startsWith('audio/'),
		)
		if (fileList.length === 0) {
			alert('Пожалуйста, выберите аудиофайлы (MP3, WAV, OGG, WEBM, M4A)')
			return
		}

		setIsLoading(true)
		const uploadedTracks: Track[] = []

		for (const file of fileList) {
			try {
				// Add file to uploading state
				setUploadingFiles(prev => new Set(prev).add(file.name))

				// 1. Convert file to data URL for upload
				const dataUrl = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader()
					reader.onload = () => resolve(String(reader.result))
					reader.onerror = () => reject(new Error('Ошибка чтения файла'))
					reader.readAsDataURL(file)
				})

				// 2. Upload to backend using voice endpoint
				const res = await fetch('/api/upload/voice', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						file: dataUrl,
						filename: file.name,
					}),
				})

				if (!res.ok) {
					const errorData = await res.json().catch(() => ({}))
					throw new Error(errorData.message || errorData.error || 'Ошибка загрузки')
				}

				const data = await res.json()
				const fileUrl = data.url

				if (!fileUrl) {
					throw new Error('Файл загружен, но URL не получен')
				}

				// 3. Create track object with backend URL
				const name = file.name.replace(/\.[^/.]+$/, '')
				const newTrack: Track = {
					id: `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					title: name,
					artist: 'Неизвестный исполнитель',
					duration: formatTime(0),
					url: fileUrl.startsWith('http') ? fileUrl : `${backendUrl}${fileUrl}`,
				}

				uploadedTracks.push(newTrack)

				// 4. Update local tracks state
				setTracks(prev => [...prev, newTrack])
			} catch (error) {
				console.error('Failed to upload track:', file.name, error)
				alert(
					`Ошибка при загрузке ${file.name}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`,
				)
			} finally {
				setUploadingFiles(prev => {
					const next = new Set(prev)
					next.delete(file.name)
					return next
				})
			}
		}

		// 5. If tracks were uploaded successfully, add them to playlist
		if (uploadedTracks.length > 0) {
			if (activeView === 'playlist' && currentPlaylistId) {
				// Add to current playlist
				setPlaylists(prev =>
					prev.map(p => {
						if (p.id === currentPlaylistId) {
							return {
								...p,
								trackIds: [...(p.trackIds || []), ...uploadedTracks.map(t => t.id)],
							}
						}
						return p
					}),
				)

				// Add to backend
				try {
					await fetch(`/api/playlists/${currentPlaylistId}/add-tracks`, {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							tracks: uploadedTracks.map(t => ({
								id: t.id,
								title: t.title,
								artist: t.artist,
								original_id: t.id,
								url: t.url,
							})),
						}),
					})
				} catch (error) {
					console.error('Failed to add tracks to playlist:', error)
				}
			} else {
				// If no playlist active, add to "Моя музыка" or create it
				let myMusicPlaylist = playlists.find(p => p.name === 'Моя музыка')

				if (!myMusicPlaylist) {
					// Create "Моя музыка" playlist
					try {
						const createRes = await fetch('/api/playlists', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								name: 'Моя музыка',
								description: 'Моя библиотека треков',
								is_public: true,
								is_pinned: false,
								tracks: uploadedTracks.map(t => ({
									id: t.id,
									title: t.title,
									artist: t.artist,
									original_id: t.id,
									url: t.url,
								})),
							}),
						})

						if (createRes.ok) {
							const newPL = await createRes.json()
							setPlaylists(prev => [
								...prev,
								{
									...newPL,
									trackIds: uploadedTracks.map(t => t.id),
								},
							])
						}
					} catch (error) {
						console.error('Failed to create "Моя музыка" playlist:', error)
					}
				} else {
					// Add to existing "Моя музыка"
					setPlaylists(prev =>
						prev.map(p =>
							p.id === myMusicPlaylist?.id
								? { ...p, trackIds: [...(p.trackIds || []), ...uploadedTracks.map(t => t.id)] }
								: p,
						),
					)

					try {
						await fetch(`/api/playlists/${myMusicPlaylist.id}/add-tracks`, {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({
								tracks: uploadedTracks.map(t => ({
									id: t.id,
									title: t.title,
									artist: t.artist,
									original_id: t.id,
									url: t.url,
								})),
							}),
						})
					} catch (error) {
						console.error('Failed to add tracks to "Моя музыка":', error)
					}
				}
			}

			// Show success message
			const trackWord = uploadedTracks.length === 1 ? 'трек' : uploadedTracks.length < 5 ? 'трека' : 'треков'
			alert(`Успешно загружено ${uploadedTracks.length} ${trackWord}!`)
		}

		setIsLoading(false)
		if (fileInputRef.current) {
			fileInputRef.current.value = ''
		}
	}

	const togglePinPlaylist = (playlistId: string) => {
		setPinnedPlaylists(prev =>
			prev.includes(playlistId)
				? prev.filter(id => id !== playlistId)
				: [...prev, playlistId],
		)
	}

	const handleDownloadPlaylist = (playlistId: string) => {
		const playlist = playlists.find(p => p.id === playlistId)
		if (!playlist) return

		const playlistTracks = playlist.trackIds
			.map(id => tracks.find(t => t.id === id))
			.filter(Boolean) as Track[]

		// In a real browser environment, downloading multiple files might trigger multiple prompts
		// For simplicity, we'll download them one by one or suggest a ZIP library if available
		// Here we'll just download each file
		playlistTracks.forEach((track, index) => {
			setTimeout(() => {
				const a = document.createElement('a')
				a.href = track.url
				a.download = `${track.artist} - ${track.title}.mp3`
				document.body.appendChild(a)
				a.click()
				document.body.removeChild(a)
			}, index * 500) // Delay to avoid browser blocking
		})
	}

	const handleExportPlaylist = async (playlistId: string) => {
		const playlist = playlists.find(p => p.id === playlistId)
		if (!playlist) return

		// Validate playlist has tracks before exporting
		const trackCount = playlist.trackIds?.length || 0
		if (trackCount === 0) {
			alert('Нельзя выгрузить пустой плейлист. Добавьте хотя бы один трек.')
			return
		}

		try {
			setIsLoading(true)
			// Update the playlist to be public and ensure it's saved to backend
			const response = await fetch(`/api/playlists/${playlistId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					is_public: true,
					is_pinned: playlist.is_pinned,
				}),
			})

			if (response.ok) {
				// Update local state to reflect export
				setPlaylists(prev =>
					prev.map(p => (p.id === playlistId ? { ...p, is_public: true } : p)),
				)
				alert(
					`Плейлист "${playlist.name}" успешно выгружен в профиль! Теперь он доступен другим пользователям.`,
				)
			} else {
				const errorData = await response.json().catch(() => ({}))
				alert(
					`Не удалось выгрузить плейлист в профиль: ${errorData.error || 'Неизвестная ошибка'}`,
				)
			}
		} catch (error) {
			console.error('Error exporting playlist:', error)
			alert('Ошибка при выгрузке плейлиста. Проверьте подключение к интернету.')
		} finally {
			setIsLoading(false)
		}
	}

	const handlePlayTrack = (trackId: string) => {
		const track = tracks.find(t => t.id === trackId)
		if (track) {
			// Update global store to ensure playback continues across navigation
			playTrackGlobal(track, tracks)
		}
		if (currentTrackId === trackId) {
			setIsPlaying(!isPlaying)
			setIsPlayingGlobal(!isPlaying)
		} else {
			setCurrentTrackId(trackId)
			setIsPlaying(true)
		}
	}

	const handleNext = useCallback(() => {
		if (tracks.length === 0) return

		const currentIndex = tracks.findIndex(t => t.id === currentTrackId)
		let nextIndex: number

		if (isShuffled) {
			do {
				nextIndex = Math.floor(Math.random() * tracks.length)
			} while (nextIndex === currentIndex && tracks.length > 1)
		} else if (currentIndex === tracks.length - 1) {
			if (repeatMode === 'all') {
				nextIndex = 0
			} else {
				setIsPlaying(false)
				setIsPlayingGlobal(false)
				return
			}
		} else {
			nextIndex = currentIndex + 1
		}
		
		const nextTrack = tracks[nextIndex]
		setCurrentTrackId(nextTrack.id)
		setIsPlaying(true)
		
		// Update global store
		playTrackGlobal(nextTrack, tracks)
	}, [tracks, currentTrackId, isShuffled, repeatMode, playTrackGlobal, setIsPlayingGlobal])

	// Avoid TDZ: allow earlier effects to call latest handleNext
	useEffect(() => {
		handleNextRef.current = handleNext
	}, [handleNext])

	const handlePrevious = () => {
		if (tracks.length === 0) return

		// If more than 3 seconds in, restart track
		if (currentTime > 3) {
			audioManager.getAudio().currentTime = 0
			return
		}

		const currentIndex = tracks.findIndex(t => t.id === currentTrackId)
		let prevIndex: number
		
		if (currentIndex > 0) {
			prevIndex = currentIndex - 1
		} else if (repeatMode === 'all') {
			prevIndex = tracks.length - 1
		} else {
			audioManager.getAudio().currentTime = 0
			return
		}

		const prevTrack = tracks[prevIndex]
		setCurrentTrackId(prevTrack.id)
		setIsPlaying(true)
		
		// Update global store
		playTrackGlobal(prevTrack, tracks)
	}

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
		const time = parseFloat(e.target.value)
		setCurrentTime(time)
		audioManager.getAudio().currentTime = time
	}

	const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setVolume(parseFloat(e.target.value))
		setIsMuted(false)
	}

	const toggleMute = () => {
		setIsMuted(!isMuted)
	}

	const toggleShuffle = () => {
		setIsShuffled(!isShuffled)
	}

	const toggleRepeat = () => {
		const modes: Array<'none' | 'all' | 'one'> = ['none', 'all', 'one']
		const currentIndex = modes.indexOf(repeatMode)
		setRepeatMode(modes[(currentIndex + 1) % modes.length])
	}

	const handleDeleteTrack = (trackId: string) => {
		const track = tracks.find(t => t.id === trackId)
		if (track) {
			URL.revokeObjectURL(track.url)
		}
		setTracks(prev => prev.filter(t => t.id !== trackId))

		// Remove from all playlists
		setPlaylists(prev =>
			prev.map(playlist => ({
				...playlist,
				trackIds: playlist.trackIds.filter(id => id !== trackId),
			})),
		)

		// If current track is deleted, stop playback
		if (currentTrackId === trackId) {
			setCurrentTrackId(null)
			setIsPlaying(false)
			audioManager.getAudio().pause()
		}
	}

	const handleCreatePlaylist = async () => {
		if (!newPlaylistName.trim()) return

		try {
			setIsLoading(true)
			const response = await fetch('/api/playlists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: newPlaylistName.trim(),
					description: '',
					cover_image: null,
					is_public: true,
					is_pinned: false,
					tracks: [],
				}),
			})

			if (response.ok) {
				const newPlaylist = await response.json()
				setPlaylists(prev => [
					...prev,
					{
						...newPlaylist,
						trackIds:
							newPlaylist.tracks?.map((t: any) => t.original_id || t.id) || [],
					},
				])
				setNewPlaylistName('')
				setShowCreatePlaylist(false)
			} else {
				console.error('Failed to create playlist')
				alert('Не удалось создать плейлист')
			}
		} catch (error) {
			console.error('Error creating playlist:', error)
			alert('Ошибка при создании плейлиста')
		} finally {
			setIsLoading(false)
		}
	}

	const handleDeletePlaylist = async (playlistId: string) => {
		try {
			const response = await fetch(`/api/playlists/${playlistId}`, {
				method: 'DELETE',
			})

			if (response.ok) {
				setPlaylists(prev => prev.filter(p => p.id !== playlistId))
				if (currentPlaylistId === playlistId) {
					setActiveView('tracks')
					setCurrentPlaylistId(null)
				}
				setShowDeletePlaylistModal(null)
			} else {
				console.error('Failed to delete playlist')
				alert('Не удалось удалить плейлист')
			}
		} catch (error) {
			console.error('Error deleting playlist:', error)
			alert('Ошибка при удалении плейлиста')
		}
	}

	const handleAddToPlaylist = async (trackId: string, playlistId: string) => {
		// Update local state first
		setPlaylists(prev =>
			prev.map(playlist => {
				if (playlist.id === playlistId) {
					if (playlist.trackIds?.includes(trackId)) {
						return playlist
					}
					return {
						...playlist,
						trackIds: [...(playlist.trackIds || []), trackId],
					}
				}
				return playlist
			}),
		)

		// Then update backend with only persistent track data (no blob URLs)
		try {
			const track = tracks.find(t => t.id === trackId)
			if (track) {
				// Send track data with URL (excluding blob: URLs which are session-scoped)
				const trackData: any = {
					id: track.id,
					title: track.title,
					artist: track.artist,
					original_id: track.original_id || track.id,
				}
				
				// Only include URL if it's not a blob: URL
				if (track.url && !track.url.startsWith('blob:')) {
					trackData.url = track.url
				}

				const response = await fetch(
					`/api/playlists/${playlistId}/add-tracks`,
					{
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							tracks: [trackData],
						}),
					},
				)

				if (!response.ok) {
					console.error('Failed to add track to playlist on backend')
					// Revert local state on failure
					loadPlaylistsFromBackend()
				}
			}
		} catch (error) {
			console.error('Error adding track to playlist:', error)
			// Revert local state on error
			loadPlaylistsFromBackend()
		}

		setShowAddToPlaylist(null)
	}

	const handleRemoveFromPlaylist = async (
		trackId: string,
		playlistId: string,
	) => {
		const playlist = playlists.find(p => p.id === playlistId)
		if (!playlist) return

		// Find the index of the track in the playlist
		const trackIndex = playlist.trackIds?.indexOf(trackId) ?? -1
		if (trackIndex === -1) return

		// Update local state first (optimistic update)
		setPlaylists(prev =>
			prev.map(playlist => {
				if (playlist.id === playlistId) {
					return {
						...playlist,
						trackIds: playlist.trackIds.filter(id => id !== trackId),
					}
				}
				return playlist
			}),
		)

		// Then update backend
		try {
			const response = await fetch(
				`/api/playlists/${playlistId}/remove-tracks`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						indices: [trackIndex],
					}),
				},
			)

			if (!response.ok) {
				console.error('Failed to remove track from playlist on backend')
				// Revert local state on failure
				loadPlaylistsFromBackend()
			}
		} catch (error) {
			console.error('Error removing track from playlist:', error)
			// Revert local state on error
			loadPlaylistsFromBackend()
		}
	}

	const getPlaylistTrack = (trackId: string) => {
		return tracks.find(t => t.id === trackId)
	}

	const sortedPlaylists = useMemo(() => {
		return [...playlists].sort((a, b) => {
			const aPinned = pinnedPlaylists.includes(a.id)
			const bPinned = pinnedPlaylists.includes(b.id)
			if (aPinned && !bPinned) return -1
			if (!aPinned && bPinned) return 1
			return 0
		})
	}, [playlists, pinnedPlaylists])

	const currentTrack = tracks.find(t => t.id === currentTrackId)
	const currentPlaylist = playlists.find(p => p.id === currentPlaylistId)

	const viewTracks =
		activeView === 'playlist' && currentPlaylist
			? (currentPlaylist.trackIds
					.map(getPlaylistTrack)
					.filter(Boolean) as Track[])
			: tracks

	const renderTrackList = (tracksToRender: Track[]) => (
		<div className='space-y-1'>
			{tracksToRender.length === 0 ? (
				<div className='text-center py-12 text-gray-400'>
					<Music className='w-12 h-12 mx-auto mb-3 opacity-50' />
					<p>
						{tracks.length === 0 ? 'Загрузите свою музыку' : 'Плейлист пуст'}
					</p>
					{tracks.length === 0 && (
						<button
							onClick={() => fileInputRef.current?.click()}
							className='mt-4 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors'
						>
							Выбрать файлы
						</button>
					)}
				</div>
			) : (
				tracksToRender.map((track, index) => (
					<div
						key={track.id}
						className={`flex items-center gap-4 p-2 rounded-xl group transition-all duration-200 ${
							currentTrackId === track.id
								? 'bg-emerald-600/20 border border-emerald-600/30'
								: 'hover:bg-white/5 border border-transparent'
						}`}
					>
						<div className='relative w-10 h-10 flex-shrink-0'>
							<button
								onClick={() => handlePlayTrack(track.id)}
								className={`w-full h-full flex items-center justify-center rounded-lg transition-all duration-200 ${
									currentTrackId === track.id
										? 'bg-emerald-600 text-white'
										: 'bg-gray-800 text-gray-400 group-hover:bg-emerald-600 group-hover:text-white'
								}`}
							>
								{currentTrackId === track.id && isPlaying ? (
									<Pause className='w-4 h-4' />
								) : (
									<Play className='w-4 h-4 ml-0.5' />
								)}
							</button>
						</div>
						<div className='flex-1 min-w-0'>
							<div
								className={`font-medium truncate ${currentTrackId === track.id ? 'text-emerald-500' : 'text-white'}`}
							>
								{track.title}
							</div>
							<div className='text-sm text-gray-400 truncate'>
								{track.artist}
							</div>
						</div>
						<div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
							{activeView === 'playlist' && currentPlaylistId && (
								<button
									onClick={() =>
										handleRemoveFromPlaylist(track.id, currentPlaylistId)
									}
									className='p-2 text-gray-400 hover:text-red-500 transition-colors'
									title='Удалить из плейлиста'
								>
									<X className='w-4 h-4' />
								</button>
							)}
							{activeView === 'tracks' && (
								<div className='relative'>
									<button
										onClick={() =>
											setShowAddToPlaylist(
												showAddToPlaylist === track.id ? null : track.id,
											)
										}
										className='p-2 text-gray-400 hover:text-white transition-colors'
										title='Добавить в плейлист'
									>
										<Plus className='w-4 h-4' />
									</button>
									<AnimatePresence>
										{showAddToPlaylist === track.id && (
											<motion.div
												initial={{ opacity: 0, scale: 0.95, y: 10 }}
												animate={{ opacity: 1, scale: 1, y: 0 }}
												exit={{ opacity: 0, scale: 0.95, y: 10 }}
												className='absolute right-0 bottom-full mb-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-20'
											>
												{playlists.length === 0 ? (
													<div className='p-3 text-sm text-gray-400'>
														Нет плейлистов
													</div>
												) : (
													playlists.map(playlist => (
														<button
															key={playlist.id}
															onClick={() =>
																handleAddToPlaylist(track.id, playlist.id)
															}
															className='w-full px-4 py-2 text-sm text-left text-white hover:bg-emerald-600 transition-colors'
														>
															{playlist.name}
														</button>
													))
												)}
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							)}
							<button
								onClick={() => handleDeleteTrack(track.id)}
								className='p-2 text-gray-400 hover:text-red-500 transition-colors'
								title='Удалить трек'
							>
								<Trash2 className='w-4 h-4' />
							</button>
						</div>
						<div className='text-xs text-gray-500 w-10 text-right'>
							{formatTime(0)}
						</div>
					</div>
				))
			)}
		</div>
	)

	if (!isInitialized || isAuthLoading || !user) {
		return (
			<div className='flex min-h-screen items-center justify-center bg-black'>
				<div className='h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent'></div>
			</div>
		)
	}

	return (
		<div className='min-h-screen bg-black text-white selection:bg-indigo-500 selection:text-white overflow-x-hidden relative'>
			{/* Background Effects */}
			<div className='fixed inset-0 z-0 overflow-hidden pointer-events-none'>
				<div className='absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-emerald-900/10 blur-[120px]' />
				<div className='absolute bottom-[10%] left-[20%] w-[30%] h-[30%] rounded-full bg-indigo-900/10 blur-[100px]' />
			</div>

			<div className='relative z-40'>
				<Header email={user.email} onLogout={() => router.push('/')} />
			</div>

			<div className='relative z-10 mx-auto flex max-w-[1600px] pt-4 px-4 gap-4 h-[calc(100vh-80px)]'>
				{/* Internal Music Sidebar */}
				<aside className='hidden md:flex flex-col w-72 flex-shrink-0 bg-gray-900/40 backdrop-blur-md rounded-2xl border border-gray-800/50 overflow-hidden'>
					<div className='p-4 space-y-4'>
						<div className='flex items-center justify-between'>
							<div className='flex items-center gap-2 text-gray-400'>
								<List className='w-5 h-5' />
								<span className='font-bold uppercase text-xs tracking-wider'>
									Моя Библиотека
								</span>
							</div>
							<div className='flex items-center gap-1'>
								<button
									onClick={() => router.push('/feed')}
									className='p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white'
									title='Выйти из vMusic'
								>
									<X className='w-5 h-5' />
								</button>
								<button
									onClick={() => setShowCreatePlaylist(true)}
									className='p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white'
									title='Создать плейлист'
								>
									<Plus className='w-5 h-5' />
								</button>
							</div>
						</div>

						<nav className='space-y-1'>
							<button
								onClick={() => {
									setActiveView('tracks')
									setCurrentPlaylistId(null)
								}}
								className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
									activeView === 'tracks'
										? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
										: 'text-gray-400 hover:text-white hover:bg-white/5'
								}`}
							>
								<Music className='w-5 h-5' />
								<span className='font-medium'>Все треки</span>
							</button>
							<button
								onClick={() => setDisplayMode('classic')}
								className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
									displayMode === 'classic'
										? 'bg-white/10 text-white'
										: 'text-gray-500 hover:text-white hover:bg-white/5'
								}`}
							>
								<Layout className='w-5 h-5' />
								<span className='font-medium'>Старый UI</span>
							</button>
							<button
								onClick={() => setShowBorrowRequests(true)}
								className='w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all text-gray-400 hover:text-white hover:bg-white/5'
								title='Запросы синхронизации позаимствованных плейлистов'
							>
								<span className='flex items-center gap-3'>
									<span className='text-lg'>🔄</span>
									<span className='font-medium'>Синк запросы</span>
								</span>
								{borrowRequests.length > 0 && (
									<span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30'>
										{borrowRequests.length}
									</span>
								)}
							</button>
						</nav>

						<div className='pt-2 border-t border-gray-800/50'>
							<div className='flex items-center justify-between mb-2 px-1'>
								<span className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>
									Плейлисты
								</span>
								<div className='flex items-center gap-2'>
									<button
										onClick={() =>
											setDisplayMode(
												displayMode === 'classic' ? 'new' : 'classic',
											)
										}
										className='p-1 hover:bg-white/10 rounded transition-colors'
										title='Сменить режим отображения'
									>
										<Layout className='w-3 h-3 text-gray-500' />
									</button>
								</div>
							</div>
							<div className='space-y-1 overflow-y-auto max-h-[calc(100vh-400px)] pr-1 custom-scrollbar'>
								{sortedPlaylists.map(playlist => (
									<div
										key={playlist.id}
										className={`group flex items-center gap-2 px-1 rounded-xl transition-all ${
											currentPlaylistId === playlist.id
												? 'bg-emerald-600/10'
												: ''
										}`}
									>
										<button
											onClick={() => {
												setActiveView('playlist')
												setCurrentPlaylistId(playlist.id)
											}}
											className={`flex-1 flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all ${
												currentPlaylistId === playlist.id
													? 'text-emerald-500'
													: 'text-gray-400 hover:text-white'
											}`}
										>
											<div
												className={`w-10 h-10 rounded-lg flex items-center justify-center ${
													currentPlaylistId === playlist.id
														? 'bg-emerald-600 text-white'
														: 'bg-gray-800 group-hover:bg-gray-700'
												}`}
											>
												<List className='w-5 h-5' />
											</div>
											<div className='min-w-0'>
												<div className='font-medium truncate text-sm'>
													{playlist.name}
												</div>
												<div className='text-[10px] text-gray-500'>
													{playlist.trackIds?.length || 0} треков
												</div>
											</div>
										</button>
										<div className='flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-1'>
											<button
												onClick={() => togglePinPlaylist(playlist.id)}
												className={`p-1.5 rounded-lg transition-colors ${
													pinnedPlaylists.includes(playlist.id)
														? 'text-emerald-500'
														: 'text-gray-500 hover:text-white'
												}`}
											>
												{pinnedPlaylists.includes(playlist.id) ? (
													<Pin className='w-3.5 h-3.5' />
												) : (
													<PinOff className='w-3.5 h-3.5' />
												)}
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</aside>

				{/* Main Content Area */}
				<main className='flex-1 flex flex-col min-w-0 overflow-hidden'>
					<div
						className={`flex-1 overflow-y-auto custom-scrollbar rounded-2xl border border-gray-800/50 bg-gray-900/40 backdrop-blur-md ${displayMode === 'new' ? 'p-0' : 'p-6'}`}
					>
						{displayMode === 'new' ? (
							<div className='flex flex-col h-full'>
								{/* New Layout Header */}
								<div className='relative h-64 flex-shrink-0'>
									<div className='absolute inset-0 bg-gradient-to-b from-emerald-600/40 to-transparent' />
									<div className='absolute bottom-0 left-0 right-0 p-8 flex items-end gap-6'>
										<div className='w-48 h-48 bg-gray-800 rounded-2xl shadow-2xl flex items-center justify-center flex-shrink-0 group relative overflow-hidden'>
											{activeView === 'playlist' ? (
												<List className='w-20 h-20 text-emerald-500' />
											) : (
												<Music className='w-20 h-20 text-emerald-500' />
											)}
											<div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
												<button
													onClick={() => fileInputRef.current?.click()}
													className='p-4 bg-emerald-600 rounded-full text-white shadow-xl'
												>
													<Upload className='w-6 h-6' />
												</button>
											</div>
										</div>
										<div className='flex-1 pb-2'>
											<div className='text-xs font-bold uppercase tracking-widest mb-2 text-emerald-400'>
												{activeView === 'playlist'
													? 'Плейлист'
													: 'Ваша медиатека'}
											</div>
											<h1 className='text-6xl font-black mb-4'>
												{activeView === 'playlist'
													? currentPlaylist?.name
													: 'VМьюзик'}
											</h1>
											<div className='flex items-center gap-4 text-sm font-medium'>
												<div className='flex items-center gap-2'>
													<div className='w-6 h-6 rounded-full bg-white/10 flex items-center justify-center'>
														<User className='w-3 h-3' />
													</div>
													<span>{user.email.split('@')[0]}</span>
												</div>
												<span className='text-gray-400'>•</span>
												<span>{viewTracks.length} треков</span>
												{activeView === 'playlist' && (currentPlaylist as any)?.borrowed && (
													<>
														<span className='text-gray-400'>•</span>
														<span className='text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full'>
															Позаимствован
														</span>
													</>
												)}
											</div>
										</div>
									</div>
								</div>

								{/* Controls Bar */}
								<div className='px-8 py-6 flex items-center justify-between bg-black/20'>
									<div className='flex items-center gap-6'>
										<button
											onClick={() =>
												viewTracks.length > 0 &&
												handlePlayTrack(viewTracks[0].id)
											}
											className='w-14 h-14 bg-emerald-600 rounded-full flex items-center justify-center text-black hover:scale-105 transition-transform shadow-xl shadow-emerald-600/20'
										>
											<Play className='w-6 h-6 fill-current' />
										</button>
										<div className='flex items-center gap-2'>
											{activeView === 'playlist' && currentPlaylistId && (
												<>
													{(currentPlaylist as any)?.borrowed && (
														<button
															onClick={() => syncBorrowedPlaylist(currentPlaylistId)}
															disabled={
																(isLoading as any) ||
																((currentPlaylist as any)?.borrow_status &&
																	(String((currentPlaylist as any).borrow_status) !==
																		'approved'))
															}
															className='p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
															title={
																(String((currentPlaylist as any)?.borrow_status) || '') ===
																'approved'
																	? 'Синхронизировать'
																	: 'Ожидает разрешения владельца'
															}
														>
															<span className='text-xl'>🔄</span>
														</button>
													)}
													<button
														onClick={() =>
															handleDownloadPlaylist(currentPlaylistId)
														}
														className='p-2 text-gray-400 hover:text-white transition-colors'
														title='Скачать плейлист'
													>
														<Download className='w-6 h-6' />
													</button>
													<button
														onClick={() =>
															handleExportPlaylist(currentPlaylistId)
														}
														className='p-2 text-gray-400 hover:text-white transition-colors'
														title='Выгрузить в профиль'
													>
														<Share2 className='w-6 h-6' />
													</button>
													<button
														onClick={() =>
															setShowDeletePlaylistModal(currentPlaylistId)
														}
														className='p-2 text-gray-400 hover:text-red-500 transition-colors'
														title='Удалить плейлист'
													>
														<Trash2 className='w-6 h-6' />
													</button>
												</>
											)}
										</div>
									</div>
									<div className='flex items-center gap-4'>
										<button
											onClick={() => fileInputRef.current?.click()}
											className='flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-full transition-colors text-sm font-medium'
										>
											<Plus className='w-4 h-4' />
											Добавить треки
										</button>
									</div>
								</div>

								{/* Track List */}
								<div className='px-8 pb-32'>{renderTrackList(viewTracks)}</div>
							</div>
						) : (
							<div className='max-w-3xl mx-auto'>
								{/* Classic Layout */}
								<div className='flex items-center justify-between mb-8'>
									<div className='flex items-center gap-4'>
										<div className='w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-600/20'>
											<Music className='w-6 h-6 text-white' />
										</div>
										<div>
											<h1 className='text-3xl font-bold text-white'>VМьюзик</h1>
											<p className='text-sm text-gray-400'>
												{activeView === 'playlist'
													? currentPlaylist?.name || 'Плейлист'
													: `${tracks.length} треков`}
											</p>
										</div>
									</div>
									<div className='flex items-center gap-3'>
										{activeView === 'playlist' && currentPlaylistId && (
											<>
												<button
													onClick={() =>
														handleDownloadPlaylist(currentPlaylistId)
													}
													className='p-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-gray-400 hover:text-white'
													title='Скачать'
												>
													<Download className='w-5 h-5' />
												</button>
												<button
													onClick={() =>
														handleExportPlaylist(currentPlaylistId)
													}
													className='p-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors text-gray-400 hover:text-white'
													title='Выгрузить'
												>
													<Share2 className='w-5 h-5' />
												</button>
											</>
										)}
										<button
											onClick={() => fileInputRef.current?.click()}
											className='flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-medium shadow-lg shadow-emerald-600/20 active:scale-95'
										>
											<Upload className='w-4 h-4' />
											<span>Загрузить</span>
										</button>
									</div>
								</div>

								<div className='bg-black/20 rounded-2xl p-4'>
									{renderTrackList(viewTracks)}
								</div>
							</div>
						)}
					</div>
					<input
						ref={fileInputRef}
						type='file'
						accept='audio/*'
						multiple
						onChange={handleUploadMusic}
						className='hidden'
					/>
				</main>
			</div>

			{/* New Interface Modal */}
			<AnimatePresence>
				{showNewInterfaceModal && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4'
					>
						<motion.div
							initial={{ scale: 0.9, y: 20 }}
							animate={{ scale: 1, y: 0 }}
							exit={{ scale: 0.9, y: 20 }}
							className='bg-gray-900 border border-gray-800 rounded-[2rem] p-8 w-full max-w-lg shadow-2xl relative overflow-hidden'
						>
							<div className='absolute -top-24 -right-24 w-64 h-64 bg-emerald-600/20 blur-[100px]' />
							<div className='absolute -bottom-24 -left-24 w-64 h-64 bg-indigo-600/20 blur-[100px]' />

							<div className='relative text-center space-y-6'>
								<div className='w-20 h-20 bg-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-2xl shadow-emerald-600/30'>
									<Layout className='w-10 h-10 text-white' />
								</div>

								<div className='space-y-2'>
									<h2 className='text-3xl font-black text-white'>
										Доступен новый интерфейс
									</h2>
									<p className='text-gray-400 text-lg'>
										Мы полностью переработали дизайн VМьюзик. Попробуйте новый
										современный макет прямо сейчас!
									</p>
								</div>

								<div className='flex flex-col gap-3 pt-4'>
									<button
										onClick={() => {
											setDisplayMode('new')
											setShowNewInterfaceModal(false)
										}}
										className='w-full py-4 bg-emerald-600 hover:bg-emerald-700 rounded-2xl font-bold text-lg transition-all active:scale-[0.98] shadow-xl shadow-emerald-600/20'
									>
										Попробовать
									</button>
									<button
										onClick={() => setShowNewInterfaceModal(false)}
										className='w-full py-4 bg-white/5 hover:bg-white/10 rounded-2xl font-medium text-gray-400 hover:text-white transition-all'
									>
										Позже
									</button>
								</div>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Create Playlist Modal */}
			<AnimatePresence>
				{showCreatePlaylist && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'
					>
						<motion.div
							initial={{ scale: 0.95, y: 20 }}
							animate={{ scale: 1, y: 0 }}
							exit={{ scale: 0.95, y: 20 }}
							className='bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl'
						>
							<div className='flex items-center justify-between mb-6'>
								<h2 className='text-2xl font-bold'>Новый плейлист</h2>
								<button
									onClick={() => {
										setShowCreatePlaylist(false)
										setNewPlaylistName('')
									}}
									className='text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all'
								>
									<X className='w-5 h-5' />
								</button>
							</div>
							<input
								type='text'
								value={newPlaylistName}
								onChange={e => setNewPlaylistName(e.target.value)}
								placeholder='Название плейлиста'
								className='w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 mb-6 transition-all'
								autoFocus
								onKeyDown={e => {
									if (e.key === 'Enter') {
										handleCreatePlaylist()
									}
								}}
							/>
							<div className='flex gap-3'>
								<button
									onClick={() => {
										setShowCreatePlaylist(false)
										setNewPlaylistName('')
									}}
									className='flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all font-medium'
								>
									Отмена
								</button>
								<button
									onClick={handleCreatePlaylist}
									className='flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-bold shadow-lg shadow-emerald-600/20'
								>
									Создать
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Delete Playlist Confirmation Modal */}
			<AnimatePresence>
				{showDeletePlaylistModal && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
						onClick={() => setShowDeletePlaylistModal(null)}
					>
						<motion.div
							initial={{ scale: 0.95, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.95, opacity: 0 }}
							transition={{ duration: 0.2 }}
							className='w-full max-w-md bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6'
							onClick={e => e.stopPropagation()}
						>
							<div className='flex items-center justify-between mb-4'>
								<h3 className='text-xl font-bold text-white'>Удалить плейлист</h3>
								<button
									onClick={() => setShowDeletePlaylistModal(null)}
									className='text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition'
								>
									<X className='w-5 h-5' />
								</button>
							</div>
							<div className='mb-6'>
								<p className='text-gray-300 mb-2'>
									Вы действительно хотите удалить этот плейлист?
								</p>
								<p className='text-sm text-gray-500'>
									Это действие нельзя отменить. Все треки в плейлисте будут удалены из него.
								</p>
							</div>
							<div className='flex gap-3'>
								<button
									onClick={() => setShowDeletePlaylistModal(null)}
									className='flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all font-medium text-gray-300'
								>
									Отмена
								</button>
								<button
									onClick={() => handleDeletePlaylist(showDeletePlaylistModal)}
									className='flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl transition-all font-bold shadow-lg shadow-red-600/20 text-white'
								>
									Удалить
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Borrow sync requests modal */}
			<AnimatePresence>
				{showBorrowRequests && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className='fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4'
						onClick={() => setShowBorrowRequests(false)}
					>
						<motion.div
							initial={{ scale: 0.95, y: 20 }}
							animate={{ scale: 1, y: 0 }}
							exit={{ scale: 0.95, y: 20 }}
							className='w-full max-w-lg bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-6'
							onClick={e => e.stopPropagation()}
						>
							<div className='flex items-center justify-between mb-4'>
								<h3 className='text-xl font-bold text-white'>
									Запросы синхронизации
								</h3>
								<button
									onClick={() => setShowBorrowRequests(false)}
									className='text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all'
								>
									<X className='w-5 h-5' />
								</button>
							</div>
							{borrowRequests.length === 0 ? (
								<div className='text-sm text-gray-400 py-8 text-center'>
									Нет запросов
								</div>
							) : (
								<div className='space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1'>
									{borrowRequests.map(req => (
										<div
											key={req.borrow_id}
											className='rounded-xl border border-gray-800 bg-black/20 p-4'
										>
											<div className='text-sm text-white font-semibold mb-1'>
												{req.source_name || 'Плейлист'}
											</div>
											<div className='text-xs text-gray-400 mb-3'>
												Запрос на синхронизацию
											</div>
											<div className='flex gap-2'>
												<button
													onClick={() => approveBorrow(req.borrow_id)}
													disabled={processingBorrowId === req.borrow_id}
													className='flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50'
												>
													Разрешить
												</button>
												<button
													onClick={() => rejectBorrow(req.borrow_id)}
													disabled={processingBorrowId === req.borrow_id}
													className='flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition disabled:opacity-50'
												>
													Отклонить
												</button>
											</div>
										</div>
									))}
								</div>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{/* Bottom Player */}
			{currentTrack && (
				<div className='fixed bottom-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-2xl border-t border-gray-800/50 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]'>
					<div className='max-w-[1600px] mx-auto px-6 py-4'>
						<div className='flex items-center gap-6'>
							{/* Track Info */}
							<div className='flex items-center gap-4 w-1/4 min-w-0'>
								<div className='w-14 h-14 rounded-xl bg-emerald-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20'>
									<Music className='w-7 h-7 text-white' />
								</div>
								<div className='min-w-0'>
									<div className='text-base font-bold text-white truncate mb-0.5'>
										{currentTrack.title}
									</div>
									<div className='text-sm text-gray-400 truncate'>
										{currentTrack.artist}
									</div>
								</div>
							</div>

							{/* Player Controls & Progress */}
							<div className='flex-1 flex flex-col items-center gap-2 max-w-2xl'>
								{/* Playback Controls */}
								<div className='flex items-center gap-6'>
									<button
										onClick={toggleShuffle}
										className={`p-2 transition-all hover:scale-110 active:scale-95 ${
											isShuffled
												? 'text-emerald-500'
												: 'text-gray-400 hover:text-white'
										}`}
										title='Перемешать'
									>
										<Shuffle className='w-5 h-5' />
									</button>
									<button
										onClick={handlePrevious}
										className='p-2 text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95'
										title='Предыдущий'
									>
										<SkipBack className='w-6 h-6 fill-current' />
									</button>
									<button
										onClick={() => setIsPlaying(!isPlaying)}
										className='w-12 h-12 rounded-full bg-white text-black flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-xl'
										title={isPlaying ? 'Пауза' : 'Играть'}
									>
										{isPlaying ? (
											<Pause className='w-6 h-6 fill-current' />
										) : (
											<Play className='w-6 h-6 fill-current ml-1' />
										)}
									</button>
									<button
										onClick={handleNext}
										className='p-2 text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95'
										title='Следующий'
									>
										<SkipForward className='w-6 h-6 fill-current' />
									</button>
									<button
										onClick={toggleRepeat}
										className={`p-2 transition-all hover:scale-110 active:scale-95 relative ${
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
										<Repeat className='w-5 h-5' />
										{repeatMode === 'one' && (
											<span className='absolute top-1 right-1 text-[8px] font-black'>
												1
											</span>
										)}
									</button>
								</div>

								{/* Progress Bar */}
								<div className='w-full flex items-center gap-3'>
									<span className='text-[10px] font-medium text-gray-500 w-10 text-right'>
										{formatTime(currentTime)}
									</span>
									<div className='flex-1 group relative h-1.5 flex items-center'>
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
											className='absolute w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity'
											style={{
												left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)`,
											}}
										/>
									</div>
									<span className='text-[10px] font-medium text-gray-500 w-10'>
										{formatTime(duration)}
									</span>
								</div>
							</div>

							{/* Volume Control - Spotify Style */}
							<div className='w-1/4 flex justify-end items-center gap-3'>
								<button
									onClick={toggleMute}
									className='p-2 text-gray-400 hover:text-white transition-all hover:scale-110 flex-shrink-0'
								>
									{isMuted || volume === 0 ? (
										<VolumeX className='w-5 h-5' />
									) : (
										<Volume2 className='w-5 h-5' />
									)}
								</button>
								<div className='relative w-24 h-1.5 group/vol'>
									<input
										type='range'
										min='0'
										max='1'
										step='0.01'
										value={isMuted ? 0 : volume}
										onChange={(e) => {
											const newVolume = parseFloat(e.target.value)
											setVolume(newVolume)
											if (newVolume > 0 && isMuted) {
												setIsMuted(false)
											}
										}}
										className='w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-800 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:group-hover/vol:opacity-100 [&::-webkit-slider-thumb]:transition-opacity [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:opacity-0 [&::-moz-range-thumb]:group-hover/vol:opacity-100 [&::-moz-range-thumb]:transition-opacity'
										style={{
											background: `linear-gradient(to right, #10b981 0%, #10b981 ${(isMuted ? 0 : volume) * 100}%, #1f2937 ${(isMuted ? 0 : volume) * 100}%, #1f2937 100%)`
										}}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	)
}
