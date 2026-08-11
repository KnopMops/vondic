'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
	LuX as XIcon,
	LuBell as BellIcon,
	LuBellOff as BellOffIcon,
	LuSearch as SearchIcon,
	LuPhone as PhoneIcon,
	LuPencil as EditIcon,
	LuCopy as CopyIcon,
	LuCheck as CheckIcon,
	LuUsers as UsersIcon,
	LuShield as ShieldIcon,
	LuUserMinus as KickIcon,
	LuBan as BanIcon,
	LuImage as ImageIcon,
	LuFile as FileIcon,
	LuLink as LinkIcon,
	LuMic as VoiceIcon,
	LuLogOut as LeaveIcon,
	LuSettings as SettingsIcon,
	LuLock as LockIcon,
	LuGlobe as GlobeIcon,
	LuDownload as DownloadIcon,
	LuExternalLink as ExternalLinkIcon,
} from 'react-icons/lu'
import { getAvatarUrl, getAttachmentUrl, formatMskDateTime } from '@/lib/utils'
import { useToast } from '@/lib/ToastContext'

interface TelegramChatInfoModalProps {
	chatType: 'direct' | 'group' | 'channel' | 'community'
	data: any
	messages?: any[]
	currentUserId?: string
	onClose: () => void
	onOpenSearch?: () => void
	onStartCall?: () => void
	onUpdateChat?: (updatedData: any) => Promise<void>
	onLeaveChat?: () => void
	onDeleteHistory?: () => void
}

export default function TelegramChatInfoModal({
	chatType,
	data,
	messages = [],
	currentUserId,
	onClose,
	onOpenSearch,
	onStartCall,
	onUpdateChat,
	onLeaveChat,
	onDeleteHistory,
}: TelegramChatInfoModalProps) {
	const router = useRouter()
	const { showToast } = useToast()
	const [activeTab, setActiveTab] = useState<'info' | 'members' | 'media' | 'files'>('info')
	const [isEditing, setIsEditing] = useState(false)
	const [notificationsMuted, setNotificationsMuted] = useState(false)
	const [copiedField, setCopiedField] = useState<string | null>(null)

	// Editable form state
	const [editName, setEditName] = useState(data?.name || data?.username || '')
	const [editDescription, setEditDescription] = useState(data?.description || data?.bio || '')
	const [editAvatarUrl, setEditAvatarUrl] = useState(data?.avatar_url || '')
	const [editRequireApproval, setEditRequireApproval] = useState(!!data?.require_approval)
	const [isSaving, setIsSaving] = useState(false)

	// Members state for groups/communities
	const [members, setMembers] = useState<any[]>(data?.participants || data?.members || [])

	useEffect(() => {
		setEditName(data?.name || data?.username || '')
		setEditDescription(data?.description || data?.bio || '')
		setEditAvatarUrl(data?.avatar_url || '')
		setEditRequireApproval(!!data?.require_approval)
		setMembers(data?.participants || data?.members || [])
	}, [data])

	const isOwner =
		data?.owner_id && currentUserId
			? String(data.owner_id) === String(currentUserId)
			: chatType === 'direct'
			? false
			: true

	const copyToClipboard = (text: string, label: string) => {
		navigator.clipboard.writeText(text)
		setCopiedField(label)
		showToast(`Скопировано: ${label}`, 'success')
		setTimeout(() => setCopiedField(null), 2000)
	}

	const handleUsernameClick = () => {
		if (chatType === 'direct' && (data?.id || data?.user_id)) {
			onClose()
			const targetId = data.id || data.user_id
			router.push(`/feed/profile/${targetId}`)
		}
	}

	const handleSaveSettings = async () => {
		if (!onUpdateChat) return
		setIsSaving(true)
		try {
			await onUpdateChat({
				name: editName,
				description: editDescription,
				avatar_url: editAvatarUrl,
				require_approval: editRequireApproval,
			})
			showToast('Настройки сохранены', 'success')
			setIsEditing(false)
		} catch (e: any) {
			showToast(e.message || 'Ошибка сохранения', 'error')
		} finally {
			setIsSaving(false)
		}
	}

	const getTitle = () => {
		if (chatType === 'direct') return data?.username || 'Пользователь'
		return data?.name || 'Чат'
	}

	const getSubtitle = () => {
		if (chatType === 'direct') {
			if (data?.status?.toLowerCase() === 'online') return 'в сети'
			if (data?.last_seen) return `был(а) ${formatMskDateTime(data.last_seen)}`
			return 'не в сети'
		}
		if (chatType === 'group') {
			const count = data?.participants_count || members.length || 1
			return `${count} участник${count === 1 ? '' : count < 5 ? 'а' : 'ов'}`
		}
		if (chatType === 'channel') {
			const count = data?.participants_count || 1
			return `${count} подписчик${count === 1 ? '' : count < 5 ? 'а' : 'ов'}`
		}
		if (chatType === 'community') {
			const count = data?.members_count || members.length || 1
			return `Сервер • ${count} участник${count === 1 ? '' : count < 5 ? 'а' : 'ов'}`
		}
		return ''
	}

	const getInviteLink = () => {
		if (chatType === 'direct') return null
		const codeOrId = data?.invite_code || data?.inviteCode || data?.code || data?.id
		if (!codeOrId || codeOrId === 'undefined') return null

		if (chatType === 'community') {
			return `https://vondic.ru/feed/communities/join/${codeOrId}`
		}
		if (chatType === 'channel') {
			return `https://vondic.ru/feed/messages/join/channel/${codeOrId}`
		}
		if (chatType === 'group') {
			return `https://vondic.ru/feed/messages/join/group/${codeOrId}`
		}
		return `https://vondic.ru/feed/messages/join/${codeOrId}`
	}

	// Filter Media Items (Images/Videos)
	const mediaItems = useMemo(() => {
		if (!messages || !Array.isArray(messages)) return []
		const list: { id: string; url: string; isVideo?: boolean }[] = []
		for (const m of messages) {
			if (m.attachments && Array.isArray(m.attachments)) {
				for (const a of m.attachments) {
					const url = a.url || a.file_url || a.path
					if (url && (url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i) || a.type === 'image' || a.type === 'video')) {
						list.push({
							id: m.id || String(Math.random()),
							url: getAttachmentUrl(url),
							isVideo: !!(url.match(/\.(mp4|webm)$/i) || a.type === 'video'),
						})
					}
				}
			}
			if (m.attachment_url) {
				const url = m.attachment_url
				if (url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i) || m.type === 'image' || m.type === 'video') {
					list.push({
						id: m.id,
						url: getAttachmentUrl(url),
						isVideo: !!(url.match(/\.(mp4|webm)$/i) || m.type === 'video'),
					})
				}
			}
		}
		return list
	}, [messages])

	// Filter Document/File Items
	const fileItems = useMemo(() => {
		if (!messages || !Array.isArray(messages)) return []
		const list: { id: string; name: string; url: string; size?: string }[] = []
		for (const m of messages) {
			if (m.attachments && Array.isArray(m.attachments)) {
				for (const a of m.attachments) {
					const url = a.url || a.file_url || a.path
					if (url && !(url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i) || a.type === 'image' || a.type === 'video')) {
						list.push({
							id: m.id || String(Math.random()),
							name: a.name || a.filename || 'Файл',
							url: getAttachmentUrl(url),
							size: a.size ? `${Math.round(a.size / 1024)} KB` : undefined,
						})
					}
				}
			}
			if (m.attachment_url) {
				const url = m.attachment_url
				if (!(url.match(/\.(jpg|jpeg|png|gif|webp|mp4|webm)$/i) || m.type === 'image' || m.type === 'video')) {
					list.push({
						id: m.id,
						name: m.attachment_name || 'Файл',
						url: getAttachmentUrl(url),
					})
				}
			}
		}
		return list
	}, [messages])

	return (
		<div className="fixed inset-0 z-[100] flex justify-end" onClick={onClose}>
			<div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" />
			<div
				className="relative w-full max-w-[420px] h-full bg-[#17212b] text-gray-100 shadow-2xl flex flex-col z-10 border-l border-[#0e1621] animate-in slide-in-from-right duration-300 font-sans"
				onClick={e => e.stopPropagation()}
			>
				{/* Top Header Controls */}
				<div className="h-14 px-4 border-b border-white/5 flex items-center justify-between shrink-0 bg-[#17212b]">
					<div className="flex items-center gap-3">
						<button
							onClick={onClose}
							className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
						>
							<XIcon className="w-5 h-5" />
						</button>
						<h3 className="font-semibold text-base text-gray-100">
							{isEditing ? 'Редактирование' : 'Информация'}
						</h3>
					</div>

					{isEditing ? (
						<button
							onClick={handleSaveSettings}
							disabled={isSaving}
							className="px-4 py-1.5 rounded-full bg-[#2481cc] hover:bg-[#1d6fa5] text-white text-xs font-semibold transition-all shadow-md disabled:opacity-50"
						>
							{isSaving ? 'Сохранение...' : 'Готово'}
						</button>
					) : (
						isOwner && onUpdateChat && (
							<button
								onClick={() => setIsEditing(true)}
								className="p-2 rounded-full text-gray-400 hover:text-[#2481cc] hover:bg-white/5 transition-colors"
								title="Редактировать"
							>
								<EditIcon className="w-5 h-5" />
							</button>
						)
					)}
				</div>

				{/* Main Content Body */}
				<div className="flex-1 overflow-y-auto custom-scrollbar">
					{isEditing ? (
						/* Edit Mode View */
						<div className="p-6 space-y-5">
							<div className="flex flex-col items-center gap-3">
								<div className="relative group cursor-pointer">
									<img
										src={getAvatarUrl(editAvatarUrl || data?.avatar_url)}
										alt="Avatar"
										className="w-24 h-24 rounded-full object-cover ring-4 ring-white/10 shadow-xl"
									/>
									<div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
										<EditIcon className="w-6 h-6 text-white" />
									</div>
								</div>
								<input
									type="text"
									placeholder="Ссылка на аватар (URL)"
									value={editAvatarUrl}
									onChange={e => setEditAvatarUrl(e.target.value)}
									className="w-full px-3 py-2 text-xs bg-[#0e1621] border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-[#2481cc]"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-400">Название</label>
								<input
									type="text"
									value={editName}
									onChange={e => setEditName(e.target.value)}
									className="w-full px-4 py-2.5 bg-[#0e1621] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#2481cc]"
								/>
							</div>

							<div className="space-y-1">
								<label className="text-xs font-medium text-gray-400">Описание</label>
								<textarea
									rows={3}
									value={editDescription}
									onChange={e => setEditDescription(e.target.value)}
									placeholder="Добавьте описание чата..."
									className="w-full px-4 py-2.5 bg-[#0e1621] border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-[#2481cc] resize-none"
								/>
							</div>

							{(chatType === 'group' || chatType === 'channel' || chatType === 'community') && (
								<div className="p-4 bg-[#0e1621] rounded-2xl border border-white/5 space-y-3">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2.5">
											<LockIcon className="w-4 h-4 text-[#2481cc]" />
											<div>
												<div className="text-sm font-medium text-gray-200">Вход по заявке</div>
												<div className="text-xs text-gray-500">Админы подтверждают вступление</div>
											</div>
										</div>
										<input
											type="checkbox"
											checked={editRequireApproval}
											onChange={e => setEditRequireApproval(e.target.checked)}
											className="w-5 h-5 accent-[#2481cc] rounded cursor-pointer"
										/>
									</div>
								</div>
							)}
						</div>
					) : (
						/* Telegram Profile View */
						<div>
							{/* Hero Header */}
							<div className="flex flex-col items-center pt-8 pb-6 px-6 bg-gradient-to-b from-white/[0.03] to-transparent">
								<div
									onClick={handleUsernameClick}
									className={chatType === 'direct' ? 'cursor-pointer group flex flex-col items-center' : 'flex flex-col items-center'}
								>
									<img
										src={getAvatarUrl(data?.avatar_url)}
										alt={getTitle()}
										className={`w-28 h-28 rounded-full object-cover ring-4 ring-[#2481cc]/20 shadow-2xl mb-4 transition-transform ${
											chatType === 'direct' ? 'group-hover:scale-105' : ''
										}`}
									/>
									<h2 className="text-2xl font-bold text-gray-100 text-center leading-tight flex items-center justify-center gap-2">
										{getTitle()}
										{data?.premium && <span className="text-amber-400 text-lg">★</span>}
									</h2>
								</div>
								<p className="text-xs text-[#2481cc] mt-1.5 font-medium">{getSubtitle()}</p>

								{/* Telegram Quick Action Circles Bar */}
								<div className="flex items-center justify-center gap-6 mt-6 w-full max-w-[300px]">
									<button
										onClick={() => {
											setNotificationsMuted(!notificationsMuted)
											showToast(
												notificationsMuted ? 'Уведомления включены' : 'Уведомления отключены',
												'info'
											)
										}}
										className="flex flex-col items-center gap-1.5 group cursor-pointer"
									>
										<div className="w-11 h-11 rounded-full bg-[#2481cc]/15 group-hover:bg-[#2481cc]/25 text-[#2481cc] flex items-center justify-center transition-all">
											{notificationsMuted ? (
												<BellOffIcon className="w-5 h-5" />
											) : (
												<BellIcon className="w-5 h-5" />
											)}
										</div>
										<span className="text-[11px] text-gray-400 group-hover:text-gray-200">
											{notificationsMuted ? 'Вкл.' : 'Звук'}
										</span>
									</button>

									{onOpenSearch && (
										<button
											onClick={onOpenSearch}
											className="flex flex-col items-center gap-1.5 group cursor-pointer"
										>
											<div className="w-11 h-11 rounded-full bg-[#2481cc]/15 group-hover:bg-[#2481cc]/25 text-[#2481cc] flex items-center justify-center transition-all">
												<SearchIcon className="w-5 h-5" />
											</div>
											<span className="text-[11px] text-gray-400 group-hover:text-gray-200">
												Поиск
											</span>
										</button>
									)}

									{onStartCall && (
										<button
											onClick={onStartCall}
											className="flex flex-col items-center gap-1.5 group cursor-pointer"
										>
											<div className="w-11 h-11 rounded-full bg-[#2481cc]/15 group-hover:bg-[#2481cc]/25 text-[#2481cc] flex items-center justify-center transition-all">
												<PhoneIcon className="w-5 h-5" />
											</div>
											<span className="text-[11px] text-gray-400 group-hover:text-gray-200">
												Звонок
											</span>
										</button>
									)}
								</div>
							</div>

							<div className="h-2 bg-[#0e1621]" />

							{/* Details List */}
							<div className="p-4 space-y-3">
								{(data?.description || data?.bio) && (
									<div className="p-3.5 bg-[#0e1621]/60 rounded-2xl border border-white/5">
										<div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-1">
											О себе / Описание
										</div>
										<div className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap">
											{data.description || data.bio}
										</div>
									</div>
								)}

								{data?.username && (
									<div
										onClick={() => {
											if (chatType === 'direct') {
												handleUsernameClick()
											} else {
												copyToClipboard(`@${data.username}`, 'username')
											}
										}}
										className="p-3.5 bg-[#0e1621]/60 hover:bg-[#0e1621] rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer transition-colors"
									>
										<div>
											<div className="text-sm font-medium text-[#2481cc] hover:underline flex items-center gap-1">
												@{data.username}
												{chatType === 'direct' && <ExternalLinkIcon className="w-3.5 h-3.5" />}
											</div>
											<div className="text-xs text-gray-500">
												{chatType === 'direct' ? 'Перейти в профиль пользователя' : 'Имя пользователя'}
											</div>
										</div>
										{chatType !== 'direct' && (
											copiedField === 'username' ? (
												<CheckIcon className="w-4 h-4 text-emerald-400" />
											) : (
												<CopyIcon className="w-4 h-4 text-gray-500 hover:text-gray-300" />
											)
										)}
									</div>
								)}

								{getInviteLink() && (
									<div
										onClick={() => copyToClipboard(getInviteLink()!, 'ссылку')}
										className="p-3.5 bg-[#0e1621]/60 hover:bg-[#0e1621] rounded-2xl border border-white/5 flex items-center justify-between cursor-pointer transition-colors"
									>
										<div className="min-w-0 pr-2">
											<div className="text-sm font-medium text-[#2481cc] truncate">
												{getInviteLink()}
											</div>
											<div className="text-xs text-gray-500">Ссылка для приглашения</div>
										</div>
										{copiedField === 'ссылку' ? (
											<CheckIcon className="w-4 h-4 text-emerald-400 shrink-0" />
										) : (
											<CopyIcon className="w-4 h-4 text-gray-500 hover:text-gray-300 shrink-0" />
										)}
									</div>
								)}
							</div>

							{/* Navigation Tabs Bar */}
							<div className="flex border-b border-white/5 px-2 bg-[#17212b] sticky top-0 z-10">
								{(chatType === 'group' || chatType === 'community') && (
									<button
										onClick={() => setActiveTab('members')}
										className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
											activeTab === 'members'
												? 'border-[#2481cc] text-[#2481cc]'
												: 'border-transparent text-gray-400 hover:text-gray-200'
										}`}
									>
										Участники
									</button>
								)}
								<button
									onClick={() => setActiveTab('media')}
									className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
										activeTab === 'media'
											? 'border-[#2481cc] text-[#2481cc]'
											: 'border-transparent text-gray-400 hover:text-gray-200'
									}`}
								>
									Медиа ({mediaItems.length})
								</button>
								<button
									onClick={() => setActiveTab('files')}
									className={`flex-1 py-3 text-xs font-semibold transition-colors border-b-2 ${
										activeTab === 'files'
											? 'border-[#2481cc] text-[#2481cc]'
											: 'border-transparent text-gray-400 hover:text-gray-200'
									}`}
								>
									Файлы ({fileItems.length})
								</button>
							</div>

							{/* Tab Contents */}
							<div className="p-4">
								{activeTab === 'members' && (
									<div className="space-y-2">
										{members.map((m: any, idx: number) => (
											<div
												key={m.id || idx}
												className="p-2.5 rounded-xl hover:bg-[#0e1621] flex items-center justify-between group transition-colors cursor-pointer"
												onClick={() => {
													if (m.id) {
														onClose()
														router.push(`/feed/profile/${m.id}`)
													}
												}}
											>
												<div className="flex items-center gap-3 min-w-0">
													<img
														src={getAvatarUrl(m.avatar_url)}
														alt={m.name || m.username}
														className="w-10 h-10 rounded-full object-cover bg-gray-800"
													/>
													<div className="flex flex-col min-w-0">
														<span className="text-sm font-medium text-gray-200 truncate">
															{m.name || m.username || 'Участник'}
														</span>
														<span className="text-[11px] text-gray-500">
															{String(m.id) === String(data?.owner_id)
																? 'Владелец'
																: 'Участник'}
														</span>
													</div>
												</div>
												{String(m.id) === String(data?.owner_id) && (
													<span className="px-2 py-0.5 rounded-full bg-[#2481cc]/20 text-[#2481cc] text-[10px] font-semibold">
														Админ
													</span>
												)}
											</div>
										))}
									</div>
								)}

								{activeTab === 'media' && (
									<div>
										{mediaItems.length > 0 ? (
											<div className="grid grid-cols-3 gap-2">
												{mediaItems.map(item => (
													<a
														key={item.id}
														href={item.url}
														target="_blank"
														rel="noreferrer"
														className="relative aspect-square rounded-xl overflow-hidden bg-[#0e1621] border border-white/5 hover:opacity-90 transition-opacity group"
													>
														{item.isVideo ? (
															<video src={item.url} className="w-full h-full object-cover" />
														) : (
															<img src={item.url} alt="Media" className="w-full h-full object-cover" />
														)}
													</a>
												))}
											</div>
										) : (
											<div className="py-8 text-center text-gray-500 text-xs">
												Раздел медиа пуст
											</div>
										)}
									</div>
								)}

								{activeTab === 'files' && (
									<div>
										{fileItems.length > 0 ? (
											<div className="space-y-2">
												{fileItems.map(file => (
													<a
														key={file.id}
														href={file.url}
														target="_blank"
														rel="noreferrer"
														download
														className="p-3 bg-[#0e1621] hover:bg-[#0e1621]/80 rounded-xl border border-white/5 flex items-center justify-between transition-colors group"
													>
														<div className="flex items-center gap-3 min-w-0 pr-2">
															<div className="w-9 h-9 rounded-lg bg-[#2481cc]/20 text-[#2481cc] flex items-center justify-center shrink-0">
																<FileIcon className="w-5 h-5" />
															</div>
															<div className="flex flex-col min-w-0">
																<span className="text-xs font-medium text-gray-200 truncate group-hover:text-[#2481cc] transition-colors">
																	{file.name}
																</span>
																{file.size && <span className="text-[10px] text-gray-500">{file.size}</span>}
															</div>
														</div>
														<DownloadIcon className="w-4 h-4 text-gray-500 group-hover:text-white shrink-0" />
													</a>
												))}
											</div>
										) : (
											<div className="py-8 text-center text-gray-500 text-xs">
												Раздел файлов пуст
											</div>
										)}
									</div>
								)}
							</div>

							{/* Footer Actions */}
							<div className="p-4 border-t border-white/5 space-y-2 bg-[#17212b]">
								{onLeaveChat && (
									<button
										onClick={onLeaveChat}
										className="w-full p-3 rounded-xl hover:bg-red-500/10 text-red-400 text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
									>
										<LeaveIcon className="w-4 h-4" />
										{chatType === 'direct' ? 'Удалить чат' : 'Покинуть чат'}
									</button>
								)}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
