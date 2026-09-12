'use client'

import React, { useEffect, useState } from 'react'
import {
	X,
	HardDrive,
	Wifi,
	Smartphone,
	Trash2,
	Check,
	Zap,
} from 'lucide-react'

import {
	clearCache,
	getCacheStorageSummary,
	type CacheStorageSummary,
} from '@/lib/cache/indexedDbStorage'
import {
	getCurrentNetworkType,
	loadDataStorageSettings,
	saveDataStorageSettings,
	type DataSaverLevel,
	type DataStorageSettings,
	type NetworkType,
} from '@/lib/traffic/trafficManager'

const SlidersIcon = ({ className = 'w-5 h-5' }: { className?: string }) => (
	<svg
		viewBox='0 0 24 24'
		fill='none'
		stroke='currentColor'
		strokeWidth='2'
		strokeLinecap='round'
		strokeLinejoin='round'
		className={className}
	>
		<line x1='4' y1='21' x2='4' y2='14' />
		<line x1='4' y1='10' x2='4' y2='3' />
		<line x1='12' y1='21' x2='12' y2='12' />
		<line x1='12' y1='8' x2='12' y2='3' />
		<line x1='20' y1='21' x2='20' y2='16' />
		<line x1='20' y1='12' x2='20' y2='3' />
		<line x1='1' y1='14' x2='7' y2='14' />
		<line x1='9' y1='8' x2='15' y2='8' />
		<line x1='17' y1='16' x2='23' y2='16' />
	</svg>
)

interface DataStorageSettingsModalProps {
	isOpen: boolean
	onClose: () => void
}

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 Б'
	if (bytes < 1024) return `${bytes} Б`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
	if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`
	return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} ГБ`
}

export const DataStorageSettingsModal: React.FC<DataStorageSettingsModalProps> = ({
	isOpen,
	onClose,
}) => {
	const [settings, setSettings] = useState<DataStorageSettings>(loadDataStorageSettings())
	const [networkType, setNetworkType] = useState<NetworkType>('unknown')
	const [cacheSummary, setCacheSummary] = useState<CacheStorageSummary>({
		messagesCount: 0,
		photosBytes: 0,
		videosBytes: 0,
		audioBytes: 0,
		filesBytes: 0,
		totalBytes: 0,
	})
	const [isClearing, setIsClearing] = useState(false)
	const [saveNotice, setSaveNotice] = useState(false)

	useEffect(() => {
		if (!isOpen) return
		setSettings(loadDataStorageSettings())
		setNetworkType(getCurrentNetworkType())
		void updateStorageSummary()
	}, [isOpen])

	const updateStorageSummary = async () => {
		const summary = await getCacheStorageSummary()
		setCacheSummary(summary)
	}

	const handleUpdateSettings = (partial: Partial<DataStorageSettings>) => {
		const updated = { ...settings, ...partial }
		setSettings(updated)
		saveDataStorageSettings(updated)
		setSaveNotice(true)
		setTimeout(() => setSaveNotice(false), 2000)
	}

	const handleClearEntireCache = async () => {
		if (isClearing) return
		setIsClearing(true)
		try {
			await clearCache('all')
			await updateStorageSummary()
		} finally {
			setIsClearing(false)
		}
	}

	if (!isOpen) return null

	const totalMediaBytes =
		cacheSummary.photosBytes +
		cacheSummary.videosBytes +
		cacheSummary.audioBytes +
		cacheSummary.filesBytes

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
			<div className="relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden text-slate-100">
				{/* Modal Header */}
				<div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-950/40">
					<div className="flex items-center gap-3">
						<div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
							<SlidersIcon className="w-5 h-5" />
						</div>
						<div>
							<h3 className="text-base font-semibold text-white tracking-tight">
								Данные и память
							</h3>
							<p className="text-xs text-slate-400">
								Оптимизация трафика в стиле Telegram, кэш и автозагрузка
							</p>
						</div>
					</div>
					<button
						onClick={onClose}
						className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
					>
						<X className="w-5 h-5" />
					</button>
				</div>

				{/* Modal Body */}
				<div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
					{/* Active Network Indicator */}
					<div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/50 text-xs">
						<div className="flex items-center gap-2.5">
							{networkType === 'wifi' ? (
								<Wifi className="w-4 h-4 text-emerald-400" />
							) : (
								<Smartphone className="w-4 h-4 text-amber-400" />
							)}
							<span className="text-slate-300 font-medium">
								Текущая сеть:{' '}
								<span className="text-white uppercase font-bold">{networkType}</span>
							</span>
						</div>
						{saveNotice && (
							<span className="flex items-center gap-1 text-emerald-400 font-medium animate-in fade-in">
								<Check className="w-3.5 h-3.5" /> Настройки сохранены
							</span>
						)}
					</div>

					{/* Section 1: Storage Usage & Clear Cache */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
								<HardDrive className="w-3.5 h-3.5" /> Использование памяти
							</h4>
							<span className="text-xs font-semibold text-white">
								{formatBytes(cacheSummary.totalBytes)} всего
							</span>
						</div>

						{/* Progress Bar Breakdown */}
						<div className="h-3 w-full rounded-full bg-slate-800 overflow-hidden flex shadow-inner">
							<div
								style={{
									width: `${
										totalMediaBytes > 0
											? (cacheSummary.photosBytes / cacheSummary.totalBytes) * 100
											: 0
									}%`,
								}}
								className="bg-purple-500 transition-all duration-300"
								title={`Фото: ${formatBytes(cacheSummary.photosBytes)}`}
							/>
							<div
								style={{
									width: `${
										totalMediaBytes > 0
											? (cacheSummary.videosBytes / cacheSummary.totalBytes) * 100
											: 0
									}%`,
								}}
								className="bg-pink-500 transition-all duration-300"
								title={`Видео: ${formatBytes(cacheSummary.videosBytes)}`}
							/>
							<div
								style={{
									width: `${
										totalMediaBytes > 0
											? (cacheSummary.audioBytes / cacheSummary.totalBytes) * 100
											: 0
									}%`,
								}}
								className="bg-emerald-500 transition-all duration-300"
								title={`Аудио: ${formatBytes(cacheSummary.audioBytes)}`}
							/>
							<div
								style={{
									width: `${
										totalMediaBytes > 0
											? (cacheSummary.filesBytes / cacheSummary.totalBytes) * 100
											: 0
									}%`,
								}}
								className="bg-amber-500 transition-all duration-300"
								title={`Файлы: ${formatBytes(cacheSummary.filesBytes)}`}
							/>
						</div>

						{/* Legend */}
						<div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs text-slate-300">
							<div className="flex items-center gap-1.5">
								<div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
								<span>Фото: {formatBytes(cacheSummary.photosBytes)}</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="w-2.5 h-2.5 rounded-full bg-pink-500" />
								<span>Видео: {formatBytes(cacheSummary.videosBytes)}</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
								<span>Аудио: {formatBytes(cacheSummary.audioBytes)}</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
								<span>{cacheSummary.messagesCount} сообщ.</span>
							</div>
						</div>

						{/* Clear Cache Action Button */}
						<button
							onClick={handleClearEntireCache}
							disabled={isClearing || cacheSummary.totalBytes === 0}
							className="w-full mt-2 py-2.5 px-4 rounded-xl border border-red-500/30 hover:border-red-500/60 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs font-semibold flex items-center justify-center gap-2 transition-all disabled:opacity-40 disabled:pointer-events-none"
						>
							<Trash2 className="w-4 h-4" />
							{isClearing ? 'Очистка хранилища...' : 'Очистить кэш Vondic'}
						</button>
					</div>

					<hr className="border-slate-800" />

					{/* Section 2: Data Saver Mode */}
					<div className="space-y-3">
						<h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
							<Zap className="w-3.5 h-3.5" /> Режим экономии трафика (Data Saver)
						</h4>
						<div className="grid grid-cols-4 gap-2">
							{(['off', 'low', 'medium', 'aggressive'] as DataSaverLevel[]).map(level => {
								const labels: Record<DataSaverLevel, string> = {
									off: 'Выкл',
									low: 'Низкая',
									medium: 'Средняя',
									aggressive: 'Максимум',
								}
								const active = settings.dataSaverLevel === level
								return (
									<button
										key={level}
										onClick={() => handleUpdateSettings({ dataSaverLevel: level })}
										className={`py-2 px-3 rounded-xl border text-xs font-medium transition-all ${
											active
												? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/25'
												: 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white hover:bg-slate-800'
										}`}
									>
										{labels[level]}
									</button>
								)
							})}
						</div>
					</div>

					<hr className="border-slate-800" />

					{/* Section 3: Auto-Download Rules (Wi-Fi vs Cellular) */}
					<div className="space-y-4">
						<h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
							<Wifi className="w-3.5 h-3.5" /> Автозагрузка медиа
						</h4>

						{/* Wi-Fi Rules */}
						<div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-3">
							<span className="text-xs font-semibold text-white flex items-center gap-1.5">
								<Wifi className="w-3.5 h-3.5 text-indigo-400" /> При подключении к Wi-Fi
							</span>
							<div className="grid grid-cols-2 gap-2 text-xs">
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.wifiRules.photos}
										onChange={e =>
											handleUpdateSettings({
												wifiRules: { ...settings.wifiRules, photos: e.target.checked },
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Фотографии</span>
								</label>
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.wifiRules.video}
										onChange={e =>
											handleUpdateSettings({
												wifiRules: { ...settings.wifiRules, video: e.target.checked },
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Видео</span>
								</label>
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.wifiRules.audio}
										onChange={e =>
											handleUpdateSettings({
												wifiRules: { ...settings.wifiRules, audio: e.target.checked },
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Голосовые и аудио</span>
								</label>
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.wifiRules.files}
										onChange={e =>
											handleUpdateSettings({
												wifiRules: { ...settings.wifiRules, files: e.target.checked },
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Файлы и документы</span>
								</label>
							</div>
						</div>

						{/* Cellular Rules */}
						<div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/40 space-y-3">
							<span className="text-xs font-semibold text-white flex items-center gap-1.5">
								<Smartphone className="w-3.5 h-3.5 text-amber-400" /> Через сотовую сеть
							</span>
							<div className="grid grid-cols-2 gap-2 text-xs">
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.cellularRules.photos}
										onChange={e =>
											handleUpdateSettings({
												cellularRules: {
													...settings.cellularRules,
													photos: e.target.checked,
												},
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Фото (до 2 МБ)</span>
								</label>
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.cellularRules.video}
										onChange={e =>
											handleUpdateSettings({
												cellularRules: {
													...settings.cellularRules,
													video: e.target.checked,
												},
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Видео (только по клику)</span>
								</label>
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.cellularRules.audio}
										onChange={e =>
											handleUpdateSettings({
												cellularRules: {
													...settings.cellularRules,
													audio: e.target.checked,
												},
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Голосовые заметки</span>
								</label>
								<label className="flex items-center gap-2 text-slate-300 cursor-pointer">
									<input
										type="checkbox"
										checked={settings.cellularRules.files}
										onChange={e =>
											handleUpdateSettings({
												cellularRules: {
													...settings.cellularRules,
													files: e.target.checked,
												},
											})
										}
										className="rounded bg-slate-900 border-slate-700 text-indigo-600 focus:ring-0"
									/>
									<span>Файлы (по клику)</span>
								</label>
							</div>
						</div>
					</div>

					<hr className="border-slate-800" />

					{/* Section 4: Retention & Media Storage Lifetime */}
					<div className="space-y-3">
						<div className="flex items-center justify-between">
							<h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400">
								Срок хранения медиа в кэше
							</h4>
							<span className="text-xs font-semibold text-slate-300">
								{settings.mediaRetentionDays === 0
									? 'Всегда'
									: `${settings.mediaRetentionDays} дней`}
							</span>
						</div>
						<div className="grid grid-cols-4 gap-2">
							{[3, 7, 30, 0].map(days => (
								<button
									key={days}
									onClick={() => handleUpdateSettings({ mediaRetentionDays: days })}
									className={`py-2 px-2.5 rounded-xl border text-xs font-medium transition-all ${
										settings.mediaRetentionDays === days
											? 'bg-indigo-600 border-indigo-500 text-white'
											: 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:text-white'
									}`}
								>
									{days === 0 ? 'Всегда' : `${days} дн.`}
								</button>
							))}
						</div>
					</div>
				</div>

				{/* Modal Footer */}
				<div className="flex items-center justify-end px-6 py-3.5 border-t border-slate-800/80 bg-slate-950/40">
					<button
						onClick={onClose}
						className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-lg shadow-indigo-600/20"
					>
						Готово
					</button>
				</div>
			</div>
		</div>
	)
}
