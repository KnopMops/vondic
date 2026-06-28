'use client'

import AppLoader from '@/components/ui/AppLoader'
import FeedPageShell from '@/components/social/FeedPageShell'
import { useAuth } from '@/lib/AuthContext'
import { useToast } from '@/lib/ToastContext'
import { audioManager } from '@/lib/services/musicPlayer'
import { useMusicPlayerStore } from '@/lib/stores/musicPlayerStore'
import { AnimatePresence, motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
	FiDownload as Download,
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

interface Track {
	id: string
	title: string
	artist: string
	duration: string
	durationSec?: number
	file?: File
	url: string
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
	trackIds?: string[]
}

export default function MusicPage() {
	const { user, isLoading: isAuthLoading, isInitialized } = useAuth()
	const router = useRouter()
	const { showToast } = useToast()
	const { playTrack: playTrackGlobal, setIsPlaying: setIsPlayingGlobal } = useMusicPlayerStore()

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
	const [currentPlaylistId, setCurrentPlaylistId] = useState<string | null>(null)
	const [showCreatePlaylist, setShowCreatePlaylist] = useState(false)
	const [showDeletePlaylistModal, setShowDeletePlaylistModal] = useState<string | null>(null)
	const [newPlaylistName, setNewPlaylistName] = useState('')
	const [showAddToPlaylist, setShowAddToPlaylist] = useState<string | null>(null)
	const [pinnedPlaylists, setPinnedPlaylists] = useState<string[]>([])
	const [isLoading, setIsLoading] = useState(false)
	const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set())
	const [pendingAddToPlaylist, setPendingAddToPlaylist] = useState<Set<string>>(new Set())
	const [borrowRequests, setBorrowRequests] = useState<any[]>([])
	const [showBorrowRequests, setShowBorrowRequests] = useState(false)
	const [processingBorrowId, setProcessingBorrowId] = useState<string | null>(null)
	const [searchQuery, setSearchQuery] = useState('')

	const backendUrl = ''

	useEffect(() => {
		const savedPinned = localStorage.getItem('vmusic_pinned_playlists')
		if (savedPinned) setPinnedPlaylists(JSON.parse(savedPinned))
		if (isInitialized && user) loadPlaylistsFromBackend()
	}, [isInitialized, user])

	const loadPlaylistsFromBackend = async () => {
		try {
			setIsLoading(true)
			const response = await fetch('/api/playlists', { method: 'GET', headers: { 'Content-Type': 'application/json' } })
			if (response.ok) {
				const backendPlaylists = await response.json()
				localStorage.setItem('vmusic_playlists', JSON.stringify(backendPlaylists))
				const convertedPlaylists = backendPlaylists.map((pl: any) => ({
					...pl,
					trackIds: pl.tracks?.map((t: any) => t.original_id || t.id) || [],
				}))
				setPlaylists(convertedPlaylists)
				const allTracks: Track[] = []
				backendPlaylists.forEach((pl: any) => {
					pl.tracks?.forEach((track: any) => {
						if (!allTracks.find((t: Track) => t.id === track.original_id || t.id === track.id)) {
							allTracks.push({
								...track,
								id: track.original_id || track.id,
								url: track.url ? (track.url.startsWith('http') ? track.url : `${backendUrl}${track.url}`) : '',
							})
						}
					})
				})
				localStorage.setItem('vmusic_tracks', JSON.stringify(allTracks))
				setTracks(prev => {
					const existingIds = new Set(prev.map(t => t.id))
					return [...prev, ...allTracks.filter((t: Track) => !existingIds.has(t.id))]
				})
			} else {
				loadFromLocalStorage()
			}
		} catch {
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
				setBorrowRequests(Array.isArray(data?.items) ? data.items : [])
			} else {
				setBorrowRequests([])
			}
		} catch { setBorrowRequests([]) }
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
			await fetch(`/api/playlists/borrow/requests/${borrowId}/approve`, { method: 'POST' })
			await loadBorrowRequests()
		} finally { setProcessingBorrowId(null) }
	}

	const rejectBorrow = async (borrowId: string) => {
		try {
			setProcessingBorrowId(borrowId)
			await fetch(`/api/playlists/borrow/requests/${borrowId}/reject`, { method: 'POST' })
			await loadBorrowRequests()
		} finally { setProcessingBorrowId(null) }
	}

	const syncBorrowedPlaylist = async (playlistId: string) => {
		try {
			setIsLoading(true)
			const res = await fetch(`/api/playlists/borrow/${playlistId}/sync`, { method: 'POST' })
			if (res.ok) await loadPlaylistsFromBackend()
			else { const t = await res.text(); showToast(t || 'Не удалось синхронизировать', 'error') }
		} finally { setIsLoading(false) }
	}

	const loadFromLocalStorage = () => {
		try {
			const savedPlaylists = localStorage.getItem('vmusic_playlists')
			const savedTracks = localStorage.getItem('vmusic_tracks')
			if (savedPlaylists) {
				setPlaylists(JSON.parse(savedPlaylists).map((pl: any) => ({
					...pl,
					trackIds: pl.tracks?.map((t: any) => t.original_id || t.id) || [],
				})))
			}
			if (savedTracks) setTracks(JSON.parse(savedTracks))
		} catch {}
	}

	useEffect(() => { localStorage.setItem('vmusic_pinned_playlists', JSON.stringify(pinnedPlaylists)) }, [pinnedPlaylists])

	const handleNextRef = useRef<() => void>(() => {})
	const fileInputRef = useRef<HTMLInputElement | null>(null)

	useEffect(() => {
		const audio = audioManager.getAudio()
		audio.volume = isMuted ? 0 : volume
		const handleTimeUpdate = () => setCurrentTime(audio.currentTime)
		const handleLoadedMetadata = () => setDuration(audio.duration)
		const handleEnded = () => {
			if (repeatMode === 'one') { audio.currentTime = 0; audio.play().catch(() => setIsPlaying(false)) }
			else handleNextRef.current()
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

	useEffect(() => {
		if (!currentTrackId) return
		const track = tracks.find(t => t.id === currentTrackId)
		if (track) {
			const audio = audioManager.getAudio()
			if (audio.src !== track.url) audio.src = track.url
			if (isPlaying) audio.play().catch(() => setIsPlaying(false))
		}
	}, [currentTrackId, tracks])

	useEffect(() => {
		if (!currentTrackId) return
		const audio = audioManager.getAudio()
		if (isPlaying) audio.play().catch(() => setIsPlaying(false))
		else audio.pause()
	}, [isPlaying, currentTrackId])

	useEffect(() => {
		const audio = audioManager.getAudio()
		audio.volume = isMuted ? 0 : volume
	}, [volume, isMuted])

	const formatTime = (time: number) => {
		if (isNaN(time)) return '0:00'
		return `${Math.floor(time / 60)}:${Math.floor(time % 60).toString().padStart(2, '0')}`
	}

	const getAudioDuration = (file: File): Promise<number> => {
		return new Promise(resolve => {
			const audio = new Audio(URL.createObjectURL(file))
			audio.onloadedmetadata = () => { URL.revokeObjectURL(audio.src); resolve(audio.duration || 0) }
			audio.onerror = () => { URL.revokeObjectURL(audio.src); resolve(0) }
		})
	}

	const handleUploadMusic = async (e: React.ChangeEvent<HTMLInputElement>) => {
		if (isLoading) { showToast('Подождите завершения текущей загрузки', 'info'); return }
		const files = e.target.files
		if (!files || files.length === 0) return
		const fileList = Array.from(files).filter(file => file.type.startsWith('audio/'))
		if (fileList.length === 0) { showToast('Выберите аудиофайлы (MP3, WAV, OGG, WEBM, M4A)', 'error'); return }
		setIsLoading(true)
		const uploadedTracks: Track[] = []
		for (const file of fileList) {
			try {
				const trackId = `track_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
				setUploadingFiles(prev => new Set(prev).add(trackId))
				const durationSec = await getAudioDuration(file)
				const dataUrl = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader()
					reader.onload = () => resolve(String(reader.result))
					reader.onerror = () => reject(new Error('Ошибка чтения файла'))
					reader.readAsDataURL(file)
				})
				const res = await fetch('/api/upload/voice', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ file: dataUrl, filename: file.name }) })
				if (!res.ok) { const errorData = await res.json().catch(() => ({})); throw new Error(errorData.message || errorData.error || 'Ошибка загрузки') }
				const data = await res.json()
				const fileUrl = data.url
				if (!fileUrl) throw new Error('Файл загружен, но URL не получен')
				const name = file.name.replace(/\.[^/.]+$/, '')
				const newTrack: Track = { id: trackId, title: name, artist: 'Неизвестный исполнитель', duration: formatTime(durationSec), durationSec, url: fileUrl.startsWith('http') ? fileUrl : `${backendUrl}${fileUrl}` }
				uploadedTracks.push(newTrack)
				setTracks(prev => [...prev, newTrack])
			} catch (error) {
				showToast(`Ошибка при загрузке ${file.name}: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`, 'error')
			} finally { setUploadingFiles(prev => { const next = new Set(prev); next.delete(file.name); return next }) }
		}
		if (uploadedTracks.length > 0) {
			if (activeView === 'playlist' && currentPlaylistId) {
				setPlaylists(prev => prev.map(p => p.id === currentPlaylistId ? { ...p, trackIds: [...(p.trackIds || []), ...uploadedTracks.map(t => t.id)] } : p))
				try {
					await fetch(`/api/playlists/${currentPlaylistId}/add-tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tracks: uploadedTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, original_id: t.id, url: t.url })) }) })
				} catch { await loadPlaylistsFromBackend() }
			} else {
				let myMusicPlaylist = playlists.find(p => p.name === 'Моя музыка')
				if (!myMusicPlaylist) {
					try {
						const createRes = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Моя музыка', description: 'Моя библиотека треков', is_public: true, is_pinned: false, tracks: uploadedTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, original_id: t.id, url: t.url })) }) })
						if (createRes.ok) { const newPL = await createRes.json(); setPlaylists(prev => [...prev, { ...newPL, trackIds: uploadedTracks.map(t => t.id) }]) }
					} catch {}
				} else {
					setPlaylists(prev => prev.map(p => p.id === myMusicPlaylist?.id ? { ...p, trackIds: [...(p.trackIds || []), ...uploadedTracks.map(t => t.id)] } : p))
					try { await fetch(`/api/playlists/${myMusicPlaylist.id}/add-tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tracks: uploadedTracks.map(t => ({ id: t.id, title: t.title, artist: t.artist, original_id: t.id, url: t.url })) }) }) } catch { await loadPlaylistsFromBackend() }
				}
			}
			showToast(`Успешно загружено ${uploadedTracks.length} ${uploadedTracks.length === 1 ? 'трек' : uploadedTracks.length < 5 ? 'трека' : 'треков'}!`, 'success')
		}
		setIsLoading(false)
		if (fileInputRef.current) fileInputRef.current.value = ''
	}

	const togglePinPlaylist = (id: string) => setPinnedPlaylists(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])

	const handleDownloadPlaylist = (playlistId: string) => {
		const playlist = playlists.find(p => p.id === playlistId)
		if (!playlist) return
		const playlistTracks = playlist.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) as Track[]
		playlistTracks.forEach((track, i) => { setTimeout(() => { const a = document.createElement('a'); a.href = track.url; a.download = `${track.artist} - ${track.title}.mp3`; document.body.appendChild(a); a.click(); document.body.removeChild(a) }, i * 500) })
	}

	const handleExportPlaylist = async (playlistId: string) => {
		const playlist = playlists.find(p => p.id === playlistId)
		if (!playlist || !(playlist.trackIds?.length)) { showToast('Нельзя выгрузить пустой плейлист', 'error'); return }
		try {
			setIsLoading(true)
			const response = await fetch(`/api/playlists/${playlistId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_public: true, is_pinned: playlist.is_pinned }) })
			if (response.ok) { setPlaylists(prev => prev.map(p => p.id === playlistId ? { ...p, is_public: true } : p)); showToast(`Плейлист "${playlist.name}" выгружен в профиль!`, 'success') }
			else showToast('Не удалось выгрузить плейлист', 'error')
		} catch { showToast('Ошибка при выгрузке', 'error') } finally { setIsLoading(false) }
	}

	const handlePlayTrack = (trackId: string) => {
		const track = tracks.find(t => t.id === trackId)
		if (track) playTrackGlobal(track, tracks)
		if (currentTrackId === trackId) { setIsPlaying(!isPlaying); setIsPlayingGlobal(!isPlaying) }
		else { setCurrentTrackId(trackId); setIsPlaying(true) }
	}

	const handleNext = useCallback(() => {
		if (tracks.length === 0) return
		const currentIndex = tracks.findIndex(t => t.id === currentTrackId)
		let nextIndex: number
		if (isShuffled) { do { nextIndex = Math.floor(Math.random() * tracks.length) } while (nextIndex === currentIndex && tracks.length > 1) }
		else if (currentIndex === tracks.length - 1) { if (repeatMode === 'all') nextIndex = 0; else { setIsPlaying(false); setIsPlayingGlobal(false); return } }
		else nextIndex = currentIndex + 1
		const nextTrack = tracks[nextIndex]
		setCurrentTrackId(nextTrack.id)
		setIsPlaying(true)
		playTrackGlobal(nextTrack, tracks)
	}, [tracks, currentTrackId, isShuffled, repeatMode, playTrackGlobal, setIsPlayingGlobal])

	useEffect(() => { handleNextRef.current = handleNext }, [handleNext])

	const handlePrevious = () => {
		if (tracks.length === 0) return
		if (currentTime > 3) { audioManager.getAudio().currentTime = 0; return }
		const currentIndex = tracks.findIndex(t => t.id === currentTrackId)
		let prevIndex: number
		if (currentIndex > 0) prevIndex = currentIndex - 1
		else if (repeatMode === 'all') prevIndex = tracks.length - 1
		else { audioManager.getAudio().currentTime = 0; return }
		const prevTrack = tracks[prevIndex]
		setCurrentTrackId(prevTrack.id)
		setIsPlaying(true)
		playTrackGlobal(prevTrack, tracks)
	}

	const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => { const time = parseFloat(e.target.value); setCurrentTime(time); audioManager.getAudio().currentTime = time }
	const toggleMute = () => setIsMuted(!isMuted)
	const toggleShuffle = () => setIsShuffled(!isShuffled)
	const toggleRepeat = () => { const modes: Array<'none' | 'all' | 'one'> = ['none', 'all', 'one']; setRepeatMode(modes[(modes.indexOf(repeatMode) + 1) % modes.length]) }

	const handleDeleteTrack = (trackId: string) => {
		const track = tracks.find(t => t.id === trackId)
		if (track) URL.revokeObjectURL(track.url)
		setTracks(prev => prev.filter(t => t.id !== trackId))
		setPlaylists(prev => prev.map(pl => ({ ...pl, trackIds: pl.trackIds.filter(id => id !== trackId) })))
		if (currentTrackId === trackId) { setCurrentTrackId(null); setIsPlaying(false); audioManager.getAudio().pause() }
	}

	const handleCreatePlaylist = async () => {
		if (!newPlaylistName.trim()) return
		try {
			setIsLoading(true)
			const response = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newPlaylistName.trim(), description: '', is_public: true, is_pinned: false, tracks: [] }) })
			if (response.ok) {
				const newPlaylist = await response.json()
				setPlaylists(prev => [...prev, { ...newPlaylist, trackIds: newPlaylist.tracks?.map((t: any) => t.original_id || t.id) || [] }])
				setNewPlaylistName(''); setShowCreatePlaylist(false)
			} else showToast('Не удалось создать плейлист', 'error')
		} catch { showToast('Ошибка при создании плейлиста', 'error') } finally { setIsLoading(false) }
	}

	const handleDeletePlaylist = async (playlistId: string) => {
		try {
			const response = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
			if (response.ok) { setPlaylists(prev => prev.filter(p => p.id !== playlistId)); if (currentPlaylistId === playlistId) { setActiveView('tracks'); setCurrentPlaylistId(null) }; setShowDeletePlaylistModal(null) }
			else showToast('Не удалось удалить плейлист', 'error')
		} catch { showToast('Ошибка при удалении', 'error') }
	}

	const handleAddToPlaylist = async (trackId: string, playlistId: string) => {
		const addKey = `${trackId}:${playlistId}`
		if (pendingAddToPlaylist.has(addKey)) return
		setPendingAddToPlaylist(prev => new Set(prev).add(addKey))
		setPlaylists(prev => prev.map(pl => pl.id === playlistId ? (pl.trackIds?.includes(trackId) ? pl : { ...pl, trackIds: [...(pl.trackIds || []), trackId] }) : pl))
		try {
			const track = tracks.find(t => t.id === trackId)
			if (track) {
				const trackData: any = { id: track.id, title: track.title, artist: track.artist, original_id: track.original_id || track.id }
				if (track.url && !track.url.startsWith('blob:')) trackData.url = track.url
				const response = await fetch(`/api/playlists/${playlistId}/add-tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tracks: [trackData] }) })
				if (!response.ok) { showToast('Не удалось добавить трек', 'error'); loadPlaylistsFromBackend() }
			}
		} catch { showToast('Ошибка при добавлении', 'error'); loadPlaylistsFromBackend() } finally { setPendingAddToPlaylist(prev => { const next = new Set(prev); next.delete(addKey); return next }) }
		setShowAddToPlaylist(null)
	}

	const handleRemoveFromPlaylist = async (trackId: string, playlistId: string) => {
		const playlist = playlists.find(p => p.id === playlistId)
		if (!playlist) return
		const trackIndex = playlist.trackIds?.indexOf(trackId) ?? -1
		if (trackIndex === -1) return
		setPlaylists(prev => prev.map(pl => pl.id === playlistId ? { ...pl, trackIds: pl.trackIds.filter(id => id !== trackId) } : pl))
		try {
			const response = await fetch(`/api/playlists/${playlistId}/remove-tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ indices: [trackIndex] }) })
			if (!response.ok) loadPlaylistsFromBackend()
		} catch { loadPlaylistsFromBackend() }
	}

	const sortedPlaylists = useMemo(() => [...playlists].sort((a, b) => {
		const aP = pinnedPlaylists.includes(a.id), bP = pinnedPlaylists.includes(b.id)
		if (aP && !bP) return -1; if (!aP && bP) return 1; return 0
	}), [playlists, pinnedPlaylists])

	const currentTrack = tracks.find(t => t.id === currentTrackId)
	const currentPlaylist = playlists.find(p => p.id === currentPlaylistId)
	const viewTracks = activeView === 'playlist' && currentPlaylist ? (currentPlaylist.trackIds.map(id => tracks.find(t => t.id === id)).filter(Boolean) as Track[]) : tracks
	const filteredTracks = viewTracks.filter(t => !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase()))

	const renderTrackList = (tracksToRender: Track[]) => (
		<div className='space-y-0.5'>
			{tracksToRender.length === 0 ? (
				<div className='text-center py-16 text-gray-400'>
					<Music className='w-14 h-14 mx-auto mb-4 opacity-30' />
					<p className='text-lg font-medium'>{tracks.length === 0 ? 'Загрузите свою музыку' : 'Ничего не найдено'}</p>
					{tracks.length === 0 && (
						<button onClick={() => fileInputRef.current?.click()} className='mt-4 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-medium active:scale-95'>
							Выбрать файлы
						</button>
					)}
				</div>
			) : tracksToRender.map((track, index) => {
				const isCurrent = currentTrackId === track.id
				const isUploadingTrack = uploadingFiles.has(track.id)
				return (
					<div
						key={track.id}
						className={`group flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${isCurrent ? 'bg-emerald-500/10' : 'hover:bg-white/[0.03]'}`}
						onDoubleClick={() => handlePlayTrack(track.id)}
					>
						<div className='w-8 text-center flex-shrink-0'>
							{isUploadingTrack ? (
								<div className='h-4 w-4 mx-auto animate-spin rounded-full border-2 border-emerald-500 border-t-transparent' />
							) : isCurrent && isPlaying ? (
								<div className='flex items-end justify-center gap-0.5 h-4'>
									<span className='w-0.5 bg-emerald-500 rounded-full animate-[bounce_1s_infinite]' style={{ height: '40%' }} />
									<span className='w-0.5 bg-emerald-500 rounded-full animate-[bounce_1.2s_infinite]' style={{ height: '70%' }} />
									<span className='w-0.5 bg-emerald-500 rounded-full animate-[bounce_0.8s_infinite]' style={{ height: '50%' }} />
								</div>
							) : (
								<span className={`text-sm ${isCurrent ? 'text-emerald-500' : 'text-gray-500 group-hover:hidden'}`}>{index + 1}</span>
							)}
							{!isUploadingTrack && !(isCurrent && isPlaying) && (
								<button onClick={() => handlePlayTrack(track.id)} className='hidden group-hover:block mx-auto text-white'>
									<Play className='w-4 h-4 fill-current' />
								</button>
							)}
						</div>
						<div className='flex-1 min-w-0'>
							<div className={`font-medium truncate text-sm ${isCurrent ? 'text-emerald-500' : 'text-white'}`}>{track.title}</div>
							<div className='text-xs text-gray-500 truncate'>{track.artist}</div>
						</div>
						<div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity'>
							{activeView === 'playlist' && currentPlaylistId && (
								<button onClick={(e) => { e.stopPropagation(); handleRemoveFromPlaylist(track.id, currentPlaylistId) }} className='p-1.5 text-gray-400 hover:text-red-500 transition-colors' title='Удалить из плейлиста'>
									<X className='w-4 h-4' />
								</button>
							)}
							{activeView === 'tracks' && (
								<div className='relative'>
									<button onClick={(e) => { e.stopPropagation(); setShowAddToPlaylist(showAddToPlaylist === track.id ? null : track.id) }} className='p-1.5 text-gray-400 hover:text-white transition-colors' title='Добавить в плейлист'>
										<Plus className='w-4 h-4' />
									</button>
									<AnimatePresence>
										{showAddToPlaylist === track.id && (
											<motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} className='absolute right-0 bottom-full mb-2 w-48 bg-gray-900 border border-gray-800 rounded-xl shadow-2xl overflow-hidden z-20'>
												{playlists.length === 0 ? <div className='p-3 text-sm text-gray-400'>Нет плейлистов</div> : playlists.map(playlist => (
													<button key={playlist.id} onClick={() => handleAddToPlaylist(track.id, playlist.id)} className='w-full px-4 py-2 text-sm text-left text-white hover:bg-emerald-600 transition-colors'>{playlist.name}</button>
												))}
											</motion.div>
										)}
									</AnimatePresence>
								</div>
							)}
							<button onClick={(e) => { e.stopPropagation(); handleDeleteTrack(track.id) }} className='p-1.5 text-gray-400 hover:text-red-500 transition-colors' title='Удалить трек'>
								<Trash2 className='w-4 h-4' />
							</button>
						</div>
						<div className='text-xs text-gray-600 w-10 text-right tabular-nums'>{formatTime(track.durationSec || 0)}</div>
					</div>
				)
			})}
		</div>
	)

	if (!isInitialized || isAuthLoading || !user) return <AppLoader fullScreen size='lg' />

	return (
		<FeedPageShell email={user.email} onLogout={() => router.push('/')}>
			<div className='flex gap-4 h-[calc(100vh-140px)]'>
				<aside className='hidden md:flex flex-col w-72 flex-shrink-0 bg-gray-900/40 backdrop-blur-md rounded-2xl border border-white/[0.06] overflow-hidden'>
					<div className='p-4 space-y-4'>
						<div className='flex items-center justify-between'>
							<div className='flex items-center gap-2 text-gray-400'>
								<List className='w-5 h-5' />
								<span className='font-bold uppercase text-xs tracking-wider'>Моя Библиотека</span>
							</div>
							<div className='flex items-center gap-1'>
								<button onClick={() => router.push('/feed')} className='p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white' title='Выйти'>
									<X className='w-5 h-5' />
								</button>
								<button onClick={() => setShowCreatePlaylist(true)} className='p-1.5 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white' title='Создать плейлист'>
									<Plus className='w-5 h-5' />
								</button>
							</div>
						</div>
						<nav className='space-y-1'>
							<button onClick={() => { setActiveView('tracks'); setCurrentPlaylistId(null) }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${activeView === 'tracks' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
								<Music className='w-5 h-5' />
								<span className='font-medium'>Все треки</span>
							</button>
							<button onClick={() => setShowBorrowRequests(true)} className='w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-all text-gray-400 hover:text-white hover:bg-white/5' title='Запросы синхронизации'>
								<span className='flex items-center gap-3'><span className='text-lg'>🔄</span><span className='font-medium'>Синк запросы</span></span>
								{borrowRequests.length > 0 && <span className='text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30'>{borrowRequests.length}</span>}
							</button>
						</nav>
						<div className='pt-2 border-t border-white/[0.06]'>
							<div className='flex items-center justify-between mb-2 px-1'>
								<span className='text-[10px] font-bold text-gray-500 uppercase tracking-widest'>Плейлисты</span>
							</div>
							<div className='space-y-1 overflow-y-auto max-h-[calc(100vh-400px)] pr-1 custom-scrollbar'>
								{sortedPlaylists.map(playlist => (
									<div key={playlist.id} className={`group flex items-center gap-2 px-1 rounded-xl transition-all ${currentPlaylistId === playlist.id ? 'bg-emerald-500/10' : ''}`}>
										<button onClick={() => { setActiveView('playlist'); setCurrentPlaylistId(playlist.id) }} className={`flex-1 flex items-center gap-3 px-2 py-2 rounded-lg text-left transition-all ${currentPlaylistId === playlist.id ? 'text-emerald-500' : 'text-gray-400 hover:text-white'}`}>
											<div className={`w-10 h-10 rounded-lg flex items-center justify-center ${currentPlaylistId === playlist.id ? 'bg-emerald-600 text-white' : 'bg-gray-800 group-hover:bg-gray-700'}`}>
												<List className='w-5 h-5' />
											</div>
											<div className='min-w-0'>
												<div className='font-medium truncate text-sm'>{playlist.name}</div>
												<div className='text-[10px] text-gray-500'>{playlist.trackIds?.length || 0} треков</div>
											</div>
										</button>
										<div className='flex items-center opacity-0 group-hover:opacity-100 transition-opacity pr-1'>
											<button onClick={() => togglePinPlaylist(playlist.id)} className={`p-1.5 rounded-lg transition-colors ${pinnedPlaylists.includes(playlist.id) ? 'text-emerald-500' : 'text-gray-500 hover:text-white'}`}>
												{pinnedPlaylists.includes(playlist.id) ? <Pin className='w-3.5 h-3.5' /> : <PinOff className='w-3.5 h-3.5' />}
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					</div>
				</aside>

				<main className='flex-1 flex flex-col min-w-0 overflow-hidden'>
					<div className='flex-1 overflow-y-auto custom-scrollbar rounded-2xl border border-white/[0.06] bg-gray-900/40 backdrop-blur-md p-0'>
						<div className='flex flex-col h-full'>
							<div className='relative h-64 flex-shrink-0'>
								<div className='absolute inset-0 bg-gradient-to-b from-emerald-600/30 to-transparent' />
								<div className='absolute bottom-0 left-0 right-0 p-8 flex items-end gap-6'>
									<div className='w-48 h-48 bg-gray-800 rounded-2xl shadow-2xl flex items-center justify-center flex-shrink-0 group relative overflow-hidden border border-white/[0.06]'>
										{activeView === 'playlist' ? <List className='w-20 h-20 text-emerald-500' /> : <Music className='w-20 h-20 text-emerald-500' />}
										<div className='absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center'>
											<button onClick={() => fileInputRef.current?.click()} className='p-4 bg-emerald-600 rounded-full text-white shadow-xl hover:scale-105 transition-transform'>
												<Upload className='w-6 h-6' />
											</button>
										</div>
									</div>
									<div className='flex-1 pb-2'>
										<div className='text-xs font-bold uppercase tracking-widest mb-2 text-emerald-400'>{activeView === 'playlist' ? 'Плейлист' : 'Ваша медиатека'}</div>
										<h1 className='text-5xl md:text-6xl font-black mb-4 tracking-tight'>{activeView === 'playlist' ? currentPlaylist?.name : 'VМьюзик'}</h1>
										<div className='flex items-center gap-4 text-sm font-medium'>
											<div className='flex items-center gap-2'>
												<div className='w-6 h-6 rounded-full bg-white/10 flex items-center justify-center'><User className='w-3 h-3' /></div>
												<span>{user.email.split('@')[0]}</span>
											</div>
											<span className='text-gray-400'>•</span>
											<span>{viewTracks.length} треков</span>
											{activeView === 'playlist' && (currentPlaylist as any)?.borrowed && (
												<span className='text-xs font-bold text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full'>Позаимствован</span>
											)}
										</div>
									</div>
								</div>
							</div>

							<div className='px-8 py-4 flex items-center justify-between bg-black/20 border-b border-white/[0.04]'>
								<div className='flex items-center gap-4'>
									<button onClick={() => viewTracks.length > 0 && handlePlayTrack(viewTracks[0].id)} className='w-12 h-12 bg-emerald-600 rounded-full flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-600/25'>
										<Play className='w-5 h-5 fill-current text-black ml-0.5' />
									</button>
									<div className='flex items-center gap-2'>
										{activeView === 'playlist' && currentPlaylistId && (
											<>
												{(currentPlaylist as any)?.borrowed && (
													<button onClick={() => syncBorrowedPlaylist(currentPlaylistId)} disabled={isLoading as any} className='p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-40' title='Синхронизировать'>
														<span className='text-xl'>🔄</span>
													</button>
												)}
												<button onClick={() => handleDownloadPlaylist(currentPlaylistId)} className='p-2 text-gray-400 hover:text-white transition-colors' title='Скачать'><Download className='w-5 h-5' /></button>
												<button onClick={() => handleExportPlaylist(currentPlaylistId)} className='p-2 text-gray-400 hover:text-white transition-colors' title='Выгрузить в профиль'><Share2 className='w-5 h-5' /></button>
												<button onClick={() => setShowDeletePlaylistModal(currentPlaylistId)} className='p-2 text-gray-400 hover:text-red-500 transition-colors' title='Удалить плейлист'><Trash2 className='w-5 h-5' /></button>
											</>
										)}
									</div>
								</div>
								<div className='flex items-center gap-3'>
									<div className='relative'>
										<input type='text' value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder='Поиск...' className='w-48 bg-white/[0.04] border border-white/[0.06] rounded-full px-4 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/30 transition-all' />
									</div>
									<button onClick={() => fileInputRef.current?.click()} className='flex items-center gap-2 px-4 py-2 bg-white/[0.06] hover:bg-white/[0.1] rounded-full transition-all text-sm font-medium border border-white/[0.06]'>
										<Plus className='w-4 h-4' />
										Добавить треки
									</button>
								</div>
							</div>

							<div className='px-8 pb-32 pt-2'>{renderTrackList(filteredTracks)}</div>
						</div>
					</div>
					<input ref={fileInputRef} type='file' accept='audio/*' multiple onChange={handleUploadMusic} className='hidden' />
				</main>
			</div>

			<AnimatePresence>
				{showCreatePlaylist && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4'>
						<motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className='bg-gray-900 border border-white/[0.08] rounded-2xl p-6 w-full max-w-md shadow-2xl'>
							<div className='flex items-center justify-between mb-6'>
								<h2 className='text-xl font-bold'>Новый плейлист</h2>
								<button onClick={() => { setShowCreatePlaylist(false); setNewPlaylistName('') }} className='text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all'><X className='w-5 h-5' /></button>
							</div>
							<input type='text' value={newPlaylistName} onChange={e => setNewPlaylistName(e.target.value)} placeholder='Название плейлиста' className='w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3.5 text-white focus:outline-none focus:ring-2 focus:ring-emerald-600 mb-6 transition-all' autoFocus onKeyDown={e => { if (e.key === 'Enter') handleCreatePlaylist() }} />
							<div className='flex gap-3'>
								<button onClick={() => { setShowCreatePlaylist(false); setNewPlaylistName('') }} className='flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all font-medium'>Отмена</button>
								<button onClick={handleCreatePlaylist} className='flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all font-bold shadow-lg shadow-emerald-600/20'>Создать</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showDeletePlaylistModal && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className='fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4' onClick={() => setShowDeletePlaylistModal(null)}>
						<motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className='w-full max-w-md bg-gray-900 border border-white/[0.08] rounded-2xl shadow-2xl p-6' onClick={e => e.stopPropagation()}>
							<div className='flex items-center justify-between mb-4'>
								<h3 className='text-xl font-bold'>Удалить плейлист</h3>
								<button onClick={() => setShowDeletePlaylistModal(null)} className='text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition'><X className='w-5 h-5' /></button>
							</div>
							<p className='text-gray-400 mb-6'>Это действие нельзя отменить. Все треки будут удалены из плейлиста.</p>
							<div className='flex gap-3'>
								<button onClick={() => setShowDeletePlaylistModal(null)} className='flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-all font-medium text-gray-300'>Отмена</button>
								<button onClick={() => handleDeletePlaylist(showDeletePlaylistModal)} className='flex-1 py-3 bg-red-600 hover:bg-red-700 rounded-xl transition-all font-bold shadow-lg shadow-red-600/20 text-white'>Удалить</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<AnimatePresence>
				{showBorrowRequests && (
					<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className='fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4' onClick={() => setShowBorrowRequests(false)}>
						<motion.div initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }} className='w-full max-w-lg bg-gray-900 border border-white/[0.08] rounded-2xl shadow-2xl p-6' onClick={e => e.stopPropagation()}>
							<div className='flex items-center justify-between mb-4'>
								<h3 className='text-xl font-bold'>Запросы синхронизации</h3>
								<button onClick={() => setShowBorrowRequests(false)} className='text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-xl transition-all'><X className='w-5 h-5' /></button>
							</div>
							{borrowRequests.length === 0 ? (
								<div className='text-sm text-gray-400 py-8 text-center'>Нет запросов</div>
							) : (
								<div className='space-y-3 max-h-[60vh] overflow-y-auto custom-scrollbar pr-1'>
									{borrowRequests.map(req => (
										<div key={req.borrow_id} className='rounded-xl border border-white/[0.06] bg-white/[0.02] p-4'>
											<div className='text-sm text-white font-semibold mb-1'>{req.source_name || 'Плейлист'}</div>
											<div className='text-xs text-gray-500 mb-3'>Запрос на синхронизацию</div>
											<div className='flex gap-2'>
												<button onClick={() => approveBorrow(req.borrow_id)} disabled={processingBorrowId === req.borrow_id} className='flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50'>Разрешить</button>
												<button onClick={() => rejectBorrow(req.borrow_id)} disabled={processingBorrowId === req.borrow_id} className='flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition disabled:opacity-50'>Отклонить</button>
											</div>
										</div>
									))}
								</div>
							)}
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			{currentTrack && (
				<div className='fixed bottom-0 left-0 right-0 z-50 bg-gray-950/80 backdrop-blur-2xl border-t border-white/[0.06] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]'>
					<div className='max-w-[1600px] mx-auto px-6 py-3'>
						<div className='flex items-center gap-6'>
							<div className='flex items-center gap-4 w-1/4 min-w-0'>
								<div className='w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-600/20'>
									<Music className='w-7 h-7 text-white' />
								</div>
								<div className='min-w-0'>
									<div className='text-sm font-bold text-white truncate'>{currentTrack.title}</div>
									<div className='text-xs text-gray-500 truncate'>{currentTrack.artist}</div>
								</div>
							</div>
							<div className='flex-1 flex flex-col items-center gap-1.5 max-w-2xl'>
								<div className='flex items-center gap-5'>
									<button onClick={toggleShuffle} className={`p-2 transition-all hover:scale-110 active:scale-95 ${isShuffled ? 'text-emerald-500' : 'text-gray-400 hover:text-white'}`} title='Перемешать'><Shuffle className='w-4 h-4' /></button>
									<button onClick={handlePrevious} className='p-2 text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95'><SkipBack className='w-5 h-5 fill-current' /></button>
									<button onClick={() => setIsPlaying(!isPlaying)} className='w-10 h-10 rounded-full bg-white text-black flex items-center justify-center transition-all hover:scale-110 active:scale-90 shadow-lg' title={isPlaying ? 'Пауза' : 'Играть'}>
										{isPlaying ? <Pause className='w-5 h-5 fill-current' /> : <Play className='w-5 h-5 fill-current ml-0.5' />}
									</button>
									<button onClick={handleNext} className='p-2 text-gray-400 hover:text-white transition-all hover:scale-110 active:scale-95'><SkipForward className='w-5 h-5 fill-current' /></button>
									<button onClick={toggleRepeat} className={`p-2 transition-all hover:scale-110 active:scale-95 relative ${repeatMode !== 'none' ? 'text-emerald-500' : 'text-gray-400 hover:text-white'}`} title={repeatMode === 'none' ? 'Повтор' : repeatMode === 'all' ? 'Повтор всех' : 'Повтор одного'}>
										<Repeat className='w-4 h-4' />
										{repeatMode === 'one' && <span className='absolute top-0.5 right-0.5 text-[7px] font-black'>1</span>}
									</button>
								</div>
								<div className='w-full flex items-center gap-2'>
									<span className='text-[10px] font-medium text-gray-600 w-10 text-right tabular-nums'>{formatTime(currentTime)}</span>
									<div className='flex-1 group relative h-1 flex items-center'>
										<input type='range' min={0} max={duration || 100} value={currentTime} onChange={handleSeek} className='absolute inset-0 w-full h-1 bg-transparent rounded-full appearance-none cursor-pointer z-10 opacity-0 group-hover:opacity-100' />
										<div className='w-full h-1 bg-white/10 rounded-full overflow-hidden'>
											<div className='h-full bg-emerald-500 transition-all duration-100' style={{ width: `${(currentTime / (duration || 1)) * 100}%` }} />
										</div>
										<div className='absolute w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity' style={{ left: `calc(${(currentTime / (duration || 1)) * 100}% - 6px)` }} />
									</div>
									<span className='text-[10px] font-medium text-gray-600 w-10 tabular-nums'>{formatTime(duration)}</span>
								</div>
							</div>
							<div className='w-1/4 flex justify-end items-center gap-3'>
								<button onClick={toggleMute} className='p-2 text-gray-400 hover:text-white transition-all hover:scale-110 flex-shrink-0'>
									{isMuted || volume === 0 ? <VolumeX className='w-4 h-4' /> : <Volume2 className='w-4 h-4' />}
								</button>
								<div className='relative w-24 h-1.5 group/vol'>
									<input type='range' min='0' max='1' step='0.01' value={isMuted ? 0 : volume} onChange={(e) => { const v = parseFloat(e.target.value); setVolume(v); if (v > 0 && isMuted) setIsMuted(false) }}
										className='w-full h-1.5 rounded-full appearance-none cursor-pointer bg-gray-800 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:opacity-0 [&::-webkit-slider-thumb]:group-hover/vol:opacity-100 [&::-webkit-slider-thumb]:transition-opacity [&::-webkit-slider-thumb]:shadow-md [&::-moz-range-thumb]:h-3 [&::-moz-range-thumb]:w-3 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:opacity-0 [&::-moz-range-thumb]:group-hover/vol:opacity-100 [&::-moz-range-thumb]:transition-opacity'
										style={{ background: `linear-gradient(to right, #10b981 0%, #10b981 ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.08) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.08) 100%)` }}
									/>
								</div>
							</div>
						</div>
					</div>
				</div>
		)}
	</FeedPageShell>
	)
}
