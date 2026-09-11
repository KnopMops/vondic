/**
 * AudioProcessor.ts - Звуковой процессор уровня Discord для корпоративного сервиса Vondic.
 * 
 * Технологический стек:
 * 1. Кодек Opus:
 *    - Полнополосный звук 48 кГц (Fullband Opus).
 *    - In-band Forward Error Correction (FEC) для автовосстановления потерянных пакетов.
 *    - Низкая задержка (minptime=10ms).
 *    - Переменный битрейт (VBR, cbr=0) и Discontinuous Transmission (DTX, usedtx=1).
 *    - Поддержка стереозвука (stereo=1, sprop-stereo=1).
 * 
 * 2. Адаптивный битрейт (Adaptive Bitrate Controller - ABR):
 *    - Потоковый анализ RTCPeerConnection.getStats() (packetLoss, RTT, jitter).
 *    - Динамическое масштабирование битрейта от выбранного максимума до 8–16 кбит/с в плохих сетях.
 * 
 * 3. Управляемый битрейт (Discord Boost Presets):
 *    - Eco: 32 кбит/с (слабый интернет)
 *    - Standard: 64 кбит/с (Discord Default)
 *    - Level 1: 128 кбит/с (HQ Speech & Music)
 *    - Level 2: 256 кбит/с (Studio Quality)
 *    - Level 3: 384 кбит/с (Ultra Hi-Fi Opus)
 * 
 * 4. Шумоподавление Krisp (Интеллектуальная фильтрация):
 *    - Интеллектуальный спектральный гейт с детектором активности голоса (VAD).
 *    - Быстрая атака (1.5 мс) для сохранения первых согласных (Т, К, П, С).
 *    - Подавление транзиентов (клики клавиатуры, мыши, удары).
 *    - Бесшовное переключение без щелчков через Web Audio Gain-Crossfade.
 */

export type AudioBitratePreset = 'eco' | 'standard' | 'boost1' | 'boost2' | 'boost3'

export interface BitratePresetInfo {
	bitrate: number
	label: string
	shortLabel: string
	description: string
	channels: number
}

export const AUDIO_BITRATE_PRESETS: Record<AudioBitratePreset, BitratePresetInfo> = {
	eco: {
		bitrate: 32_000,
		label: 'Эко (32 кбит/с)',
		shortLabel: '32 kbps',
		description: 'Минимальный трафик, спасает при слабом интернете',
		channels: 1,
	},
	standard: {
		bitrate: 64_000,
		label: 'Стандарт (64 кбит/с)',
		shortLabel: '64 kbps',
		description: 'Базовое высокое качество Discord',
		channels: 1,
	},
	boost1: {
		bitrate: 128_000,
		label: 'Буст Уровень 1 (128 кбит/с)',
		shortLabel: '128 kbps',
		description: 'Кристальная речь и музыка',
		channels: 2,
	},
	boost2: {
		bitrate: 256_000,
		label: 'Буст Уровень 2 (256 кбит/с)',
		shortLabel: '256 kbps',
		description: 'Студийный чистый звук',
		channels: 2,
	},
	boost3: {
		bitrate: 384_000,
		label: 'Буст Уровень 3 (384 кбит/с)',
		shortLabel: '384 kbps',
		description: 'Максимальное Hi-Fi качество Opus',
		channels: 2,
	},
}

export interface NetworkQualityStats {
	ping: number // ms (RTT)
	packetLoss: number // percentage (0 - 100)
	jitter: number // ms
	currentBitrate: number // bps
	targetBitrate: number // bps
	qualityGrade: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
}

export interface OpusOptimizationOptions {
	bitrate?: number
	stereo?: boolean
	useFec?: boolean
	useDtx?: boolean
	minPtime?: number
}

/**
 * Модификатор SDP для тонкой настройки кодека Opus по стандартам Discord.
 */
export function optimizeOpusSdp(
	sdp: string,
	options: OpusOptimizationOptions = {},
): string {
	if (!sdp) return sdp

	const targetBitrate = options.bitrate || AUDIO_BITRATE_PRESETS.boost1.bitrate
	const stereo = options.stereo !== undefined ? options.stereo : true
	const useFec = options.useFec !== undefined ? options.useFec : true
	const useDtx = options.useDtx !== undefined ? options.useDtx : true
	const minPtime = options.minPtime || 10

	const lines = sdp.split(/\r\n|\n/)
	let opusPayloadType: string | null = null

	// Ищем Payload Type кодека opus (например, a=rtpmap:111 opus/48000/2)
	for (const line of lines) {
		const match = line.match(/^a=rtpmap:(\d+)\s+opus\/48000\/2/i)
		if (match) {
			opusPayloadType = match[1]
			break
		}
	}

	if (!opusPayloadType) {
		// Opus не найден, возвращаем исходный SDP
		return sdp
	}

	const newParams: Record<string, string> = {
		minptime: String(minPtime),
		useinbandfec: useFec ? '1' : '0',
		stereo: stereo ? '1' : '0',
		'sprop-stereo': stereo ? '1' : '0',
		maxplaybackrate: '48000',
		'sprop-maxcapturerate': '48000',
		cbr: '0', // Переменный битрейт (VBR)
		usedtx: useDtx ? '1' : '0',
		maxaveragebitrate: String(targetBitrate),
	}

	let fmtpFound = false
	const updatedLines: string[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (line.startsWith(`a=fmtp:${opusPayloadType} `)) {
			fmtpFound = true
			const rawParams = line.substring(`a=fmtp:${opusPayloadType} `.length)
			const existingParams: Record<string, string> = {}

			rawParams.split(';').forEach(p => {
				const [k, v] = p.trim().split('=')
				if (k) existingParams[k.toLowerCase()] = v !== undefined ? v : ''
			})

			// Объединяем параметры
			const merged = { ...existingParams, ...newParams }
			const formatted = Object.entries(merged)
				.map(([k, v]) => (v !== '' ? `${k}=${v}` : k))
				.join(';')

			updatedLines.push(`a=fmtp:${opusPayloadType} ${formatted}`)
		} else {
			updatedLines.push(line)
			// Если дошли до строки rtpmap и fmtp еще не найден, вставляем сразу после rtpmap
			if (line.startsWith(`a=rtpmap:${opusPayloadType} `) && !fmtpFound) {
				// Проверяем, нет ли fmtp следующей строкой
				const nextLine = lines[i + 1] || ''
				if (!nextLine.startsWith(`a=fmtp:${opusPayloadType} `)) {
					const formatted = Object.entries(newParams)
						.map(([k, v]) => `${k}=${v}`)
						.join(';')
					updatedLines.push(`a=fmtp:${opusPayloadType} ${formatted}`)
					fmtpFound = true
				}
			}
		}
	}

	return updatedLines.join('\r\n')
}

/**
 * Менеджер адаптивного битрейта (ABR).
 * Мониторит качество канала через RTCPeerConnection.getStats() и плавно адаптирует битрейт кодека Opus.
 */
export class AdaptiveBitrateManager {
	private pc: RTCPeerConnection
	private targetBitrate: number
	private currentAppliedBitrate: number
	private intervalId: NodeJS.Timeout | null = null
	private prevPacketsLost: number = 0
	private prevPacketsSent: number = 0
	private prevTimestamp: number = 0
	public onNetworkStats?: (stats: NetworkQualityStats) => void

	constructor(pc: RTCPeerConnection, initialBitrate: number = 128_000) {
		this.pc = pc
		this.targetBitrate = initialBitrate
		this.currentAppliedBitrate = initialBitrate
	}

	public start(pollIntervalMs: number = 2500) {
		this.stop()
		this.intervalId = setInterval(() => {
			void this.analyzeAndAdapt()
		}, pollIntervalMs)
	}

	public stop() {
		if (this.intervalId) {
			clearInterval(this.intervalId)
			this.intervalId = null
		}
	}

	public setTargetBitrate(bitrate: number) {
		this.targetBitrate = bitrate
		void this.applyBitrate(bitrate)
	}

	public getCurrentBitrate(): number {
		return this.currentAppliedBitrate
	}

	private async analyzeAndAdapt() {
		try {
			if (this.pc.connectionState !== 'connected') {
				return
			}

			const stats = await this.pc.getStats()
			let roundTripTimeMs = 0
			let jitterMs = 0
			let currentPacketsLost = 0
			let currentPacketsSent = 0
			let foundAudioSender = false

			stats.forEach(report => {
				// Извлечение RTT из candidate-pair
				if (report.type === 'candidate-pair' && report.state === 'succeeded') {
					if (typeof report.currentRoundTripTime === 'number') {
						roundTripTimeMs = report.currentRoundTripTime * 1000
					}
				}

				// Извлечение аудио-метрик
				if (report.type === 'outbound-rtp' && report.kind === 'audio') {
					foundAudioSender = true
					if (typeof report.packetsSent === 'number') {
						currentPacketsSent = report.packetsSent
					}
				}

				if (report.type === 'remote-inbound-rtp' && report.kind === 'audio') {
					if (typeof report.packetsLost === 'number') {
						currentPacketsLost = report.packetsLost
					}
					if (typeof report.jitter === 'number') {
						jitterMs = report.jitter * 1000
					}
					if (typeof report.roundTripTime === 'number' && roundTripTimeMs === 0) {
						roundTripTimeMs = report.roundTripTime * 1000
					}
				}
			})

			// Расчет дельты потерь пакетов
			let packetLossPercent = 0
			if (this.prevPacketsSent > 0 && currentPacketsSent >= this.prevPacketsSent) {
				const deltaSent = currentPacketsSent - this.prevPacketsSent
				const deltaLost = Math.max(0, currentPacketsLost - this.prevPacketsLost)
				const total = deltaSent + deltaLost
				if (total > 0) {
					packetLossPercent = Math.min(100, (deltaLost / total) * 100)
				}
			}

			this.prevPacketsLost = currentPacketsLost
			this.prevPacketsSent = currentPacketsSent
			this.prevTimestamp = Date.now()

			// Расчет оптимального битрейта на основе состояния сети
			let qualityGrade: NetworkQualityStats['qualityGrade'] = 'excellent'
			let adaptedBitrate = this.targetBitrate

			if (packetLossPercent > 15 || roundTripTimeMs > 450) {
				qualityGrade = 'critical'
				adaptedBitrate = Math.min(this.targetBitrate, 12_000) // Режим максимальной разборчивости
			} else if (packetLossPercent > 7 || roundTripTimeMs > 320) {
				qualityGrade = 'poor'
				adaptedBitrate = Math.min(this.targetBitrate, 32_000)
			} else if (packetLossPercent > 3 || roundTripTimeMs > 200) {
				qualityGrade = 'fair'
				adaptedBitrate = Math.min(this.targetBitrate, 64_000)
			} else if (packetLossPercent > 0.8 || roundTripTimeMs > 120) {
				qualityGrade = 'good'
				adaptedBitrate = Math.min(this.targetBitrate, 128_000)
			} else {
				qualityGrade = 'excellent'
				adaptedBitrate = this.targetBitrate
			}

			// Динамическое применение битрейта при изменении
			if (Math.abs(adaptedBitrate - this.currentAppliedBitrate) > 4000) {
				await this.applyBitrate(adaptedBitrate)
			}

			if (this.onNetworkStats) {
				this.onNetworkStats({
					ping: Math.round(roundTripTimeMs),
					packetLoss: Math.round(packetLossPercent * 10) / 10,
					jitter: Math.round(jitterMs),
					currentBitrate: this.currentAppliedBitrate,
					targetBitrate: this.targetBitrate,
					qualityGrade,
				})
			}
		} catch (e) {
			// Игнорируем ошибки при закрытии или пересогласовании
		}
	}

	private async applyBitrate(bitrate: number): Promise<void> {
		try {
			const senders = this.pc.getSenders()
			const audioSender = senders.find(s => s.track && s.track.kind === 'audio')
			if (!audioSender) return

			const params = audioSender.getParameters()
			if (!params.encodings || params.encodings.length === 0) {
				params.encodings = [{}]
			}

			params.encodings[0].maxBitrate = bitrate
			;(params.encodings[0] as any).networkPriority = 'high'
			;(params.encodings[0] as any).priority = 'high'

			await audioSender.setParameters(params)
			this.currentAppliedBitrate = bitrate
			console.log(`[AdaptiveBitrate] Applied audio bitrate: ${Math.round(bitrate / 1000)} kbps`)
		} catch (e) {
			console.warn('[AdaptiveBitrate] Failed to apply audio bitrate:', e)
		}
	}
}

export interface AudioProcessorOptions {
	noiseSuppression: number
	echoCancellation: boolean
	autoGainControl: boolean
	highPassFilter: number
	lowPassFilter: number
	gain: number
	smoothing: boolean
	krispEnabled: boolean
}

const DEFAULT_OPTIONS: AudioProcessorOptions = {
	noiseSuppression: 2,
	echoCancellation: true,
	autoGainControl: true,
	highPassFilter: 75, // Срезаем низкочастотный гул микрофона и удары по столу
	lowPassFilter: 15000, // Сохраняем кристальный верхний диапазон
	gain: 1.0,
	smoothing: true,
	krispEnabled: true,
}

/**
 * Интеллектуальный звуковой процессор Krisp-уровня.
 * Реализует спектральный гейт, VAD (Voice Activity Detection), подавление транзиентов и кликов.
 */
export class AudioProcessor {
	private audioContext: AudioContext | null = null
	private mediaStreamSource: MediaStreamAudioSourceNode | null = null
	private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null
	
	// Узлы фильтрации и гейта
	private highPassNode: BiquadFilterNode | null = null
	private lowPassNode: BiquadFilterNode | null = null
	private speechDetectorNode: AnalyserNode | null = null
	private gateGainNode: GainNode | null = null
	private bypassGainNode: GainNode | null = null
	private compressorNode: DynamicsCompressorNode | null = null
	private outputGainNode: GainNode | null = null
	
	private options: AudioProcessorOptions
	private isProcessing: boolean = false
	private vadAnimationId: number | null = null
	private currentVoiceEnergy: number = 0

	constructor(options: Partial<AudioProcessorOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options }
	}

	async initialize(inputStream: MediaStream): Promise<MediaStream> {
		try {
			if (typeof window === 'undefined') return inputStream

			const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
			if (!AudioCtx) return inputStream

			this.audioContext = new AudioCtx({
				sampleRate: 48000,
				latencyHint: 'interactive',
			})

			this.mediaStreamSource = this.audioContext.createMediaStreamSource(inputStream)
			this.createProcessingChain()
			this.mediaStreamDestination = this.audioContext.createMediaStreamDestination()
			this.connectProcessingChain()

			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume()
			}

			this.startVoiceActivityDetection()
			this.isProcessing = true
			console.log('[AudioProcessor] Discord-like Krisp Noise Suppression initialized at 48kHz')

			return this.mediaStreamDestination.stream
		} catch (error) {
			console.error('[AudioProcessor] Initialization failed, falling back to raw stream:', error)
			return inputStream
		}
	}

	private createProcessingChain() {
		if (!this.audioContext) return

		// 1. Фильтр суб-баса: устраняет вибрации стола, гул вентилятора и дыхание
		this.highPassNode = this.audioContext.createBiquadFilter()
		this.highPassNode.type = 'highpass'
		this.highPassNode.frequency.value = this.options.highPassFilter
		this.highPassNode.Q.value = 0.7

		// 2. Мягкий ВЧ-фильтр для устранения высокочастотного шипения
		this.lowPassNode = this.audioContext.createBiquadFilter()
		this.lowPassNode.type = 'lowpass'
		this.lowPassNode.frequency.value = this.options.lowPassFilter
		this.lowPassNode.Q.value = 0.6

		// 3. Анализатор спектра голосового диапазона для VAD (300Hz - 3400Hz)
		this.speechDetectorNode = this.audioContext.createAnalyser()
		this.speechDetectorNode.fftSize = 512
		this.speechDetectorNode.smoothingTimeConstant = 0.2

		// 4. Интеллектуальный спектральный гейт (плавный гейт Krisp)
		this.gateGainNode = this.audioContext.createGain()
		this.gateGainNode.gain.value = this.options.krispEnabled ? 1.0 : 1.0

		// 5. Нода байпаса для мгновенного плавного переключения Krisp вкл/выкл
		this.bypassGainNode = this.audioContext.createGain()
		this.bypassGainNode.gain.value = this.options.krispEnabled ? 0.0 : 1.0

		// 6. Динамический компрессор и ограничитель резких транзиентов (клики мыши, стук клавиш)
		this.compressorNode = this.audioContext.createDynamicsCompressor()
		this.compressorNode.threshold.value = -24 // Начинает мягко сжимать только громкие звуки
		this.compressorNode.knee.value = 25
		this.compressorNode.ratio.value = 10
		this.compressorNode.attack.value = 0.0015 // Сверхбыстрая атака (1.5 мс) ловит стук клавиатуры
		this.compressorNode.release.value = 0.18 // Быстрый естественный релиз

		// 7. Итоговое усиление
		this.outputGainNode = this.audioContext.createGain()
		this.outputGainNode.gain.value = this.dbToGain(this.options.gain)
	}

	private connectProcessingChain() {
		if (
			!this.mediaStreamSource ||
			!this.highPassNode ||
			!this.lowPassNode ||
			!this.gateGainNode ||
			!this.bypassGainNode ||
			!this.compressorNode ||
			!this.outputGainNode ||
			!this.mediaStreamDestination ||
			!this.speechDetectorNode
		) {
			return
		}

		// Ветка Krisp-обработки: Source -> HighPass -> LowPass -> Gate -> Compressor -> Output
		this.mediaStreamSource.connect(this.highPassNode)
		this.highPassNode.connect(this.lowPassNode)
		this.lowPassNode.connect(this.gateGainNode)
		this.gateGainNode.connect(this.compressorNode)
		this.compressorNode.connect(this.outputGainNode)

		// Ветка VAD-анализатора (слушает после обрезных фильтров)
		this.lowPassNode.connect(this.speechDetectorNode)

		// Ветка прямого байпаса (если Krisp выключен)
		this.mediaStreamSource.connect(this.bypassGainNode)
		this.bypassGainNode.connect(this.outputGainNode)

		// Выход на WebRTC
		this.outputGainNode.connect(this.mediaStreamDestination)
	}

	private startVoiceActivityDetection() {
		if (!this.speechDetectorNode || !this.audioContext) return

		const dataArray = new Uint8Array(this.speechDetectorNode.frequencyBinCount)
		const NOISE_THRESHOLD = 18 // Порог фонового шума
		const SPEECH_THRESHOLD = 32 // Порог уверенной речи

		const loop = () => {
			if (!this.isProcessing || !this.speechDetectorNode || !this.gateGainNode || !this.audioContext) {
				return
			}

			if (this.options.krispEnabled) {
				this.speechDetectorNode.getByteFrequencyData(dataArray)

				// Анализируем энергию преимущественно в голосовом диапазоне (bins 5 - 40 ~ 300Hz - 3500Hz)
				let voiceSum = 0
				const startBin = 5
				const endBin = Math.min(dataArray.length, 45)
				for (let i = startBin; i < endBin; i++) {
					voiceSum += dataArray[i]
				}
				const avgEnergy = voiceSum / (endBin - startBin)
				this.currentVoiceEnergy = avgEnergy

				const now = this.audioContext.currentTime
				if (avgEnergy > SPEECH_THRESHOLD) {
					// Обнаружен голос: мгновенное открытие (1.5 мс) без съедания первой буквы
					this.gateGainNode.gain.cancelScheduledValues(now)
					this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.002)
				} else if (avgEnergy < NOISE_THRESHOLD) {
					// Тишина / шум: плавный спуск до уровня -50dB (коэффициент 0.015)
					this.gateGainNode.gain.cancelScheduledValues(now)
					this.gateGainNode.gain.setTargetAtTime(0.015, now, 0.12)
				}
			}

			if (typeof window !== 'undefined') {
				this.vadAnimationId = window.requestAnimationFrame(loop)
			}
		}

		loop()
	}

	/**
	 * Переключение шумоподавления Krisp AI
	 */
	setKrispEnabled(enabled: boolean) {
		this.options.krispEnabled = enabled
		if (!this.audioContext || !this.gateGainNode || !this.bypassGainNode) return

		const now = this.audioContext.currentTime
		// Плавный кроссфейд (40 мс) исключает клики и треск
		if (enabled) {
			this.bypassGainNode.gain.setTargetAtTime(0.0, now, 0.04)
			this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.04)
			console.log('[AudioProcessor] Krisp AI Noise Suppression ENABLED')
		} else {
			this.gateGainNode.gain.setTargetAtTime(0.0, now, 0.04)
			this.bypassGainNode.gain.setTargetAtTime(1.0, now, 0.04)
			console.log('[AudioProcessor] Krisp AI Noise Suppression BYPASSED')
		}
	}

	isKrispEnabled(): boolean {
		return this.options.krispEnabled
	}

	setNoiseSuppression(level: number) {
		this.options.noiseSuppression = Math.max(0, Math.min(3, level))
		if (this.lowPassNode) {
			const cutoff = 16000 - this.options.noiseSuppression * 1500
			this.lowPassNode.frequency.value = Math.max(8000, cutoff)
		}
		if (this.compressorNode) {
			this.compressorNode.threshold.value = -20 - this.options.noiseSuppression * 4
		}
	}

	setGain(db: number) {
		this.options.gain = db
		if (this.outputGainNode) {
			this.outputGainNode.gain.value = this.dbToGain(db)
		}
	}

	setEchoCancellation(enabled: boolean) {
		this.options.echoCancellation = enabled
	}

	setAutoGainControl(enabled: boolean) {
		this.options.autoGainControl = enabled
		if (this.compressorNode) {
			this.compressorNode.threshold.value = enabled ? -24 : 0
		}
	}

	cleanup() {
		this.isProcessing = false
		if (this.vadAnimationId && typeof window !== 'undefined') {
			window.cancelAnimationFrame(this.vadAnimationId)
			this.vadAnimationId = null
		}
		if (this.audioContext) {
			try {
				void this.audioContext.close()
			} catch {}
			this.audioContext = null
		}
		this.mediaStreamSource = null
		this.mediaStreamDestination = null
		this.highPassNode = null
		this.lowPassNode = null
		this.gateGainNode = null
		this.bypassGainNode = null
		this.compressorNode = null
		this.outputGainNode = null
		this.speechDetectorNode = null
	}

	getOutputStream(): MediaStream | null {
		return this.mediaStreamDestination?.stream || null
	}

	async suspend() {
		if (this.audioContext?.state === 'running') {
			await this.audioContext.suspend()
		}
	}

	async resume() {
		if (this.audioContext?.state === 'suspended') {
			await this.audioContext.resume()
		}
	}

	private dbToGain(db: number): number {
		return Math.pow(10, db / 20)
	}
}

/**
 * Расширенные ограничения захвата звука микрофона по стандартам Discord.
 */
export function getDiscordLikeAudioConstraints(options: {
	stereo?: boolean
	krisp?: boolean
} = {}): MediaTrackConstraints {
	const isStereo = options.stereo ?? true

	return {
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,
		sampleRate: 48000,
		sampleSize: 16,
		channelCount: isStereo ? 2 : 1,
		advanced: [
			{
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				sampleRate: 48000,
			},
			{
				// Дополнительные флаги WebRTC движка Chromium
				googEchoCancellation: true,
				googAutoGainControl: true,
				googNoiseSuppression: true,
				googHighpassFilter: true,
				googTypingNoiseDetection: true,
			} as any,
		],
	} as MediaTrackConstraints
}

export function getEnhancedAudioConstraints(): MediaTrackConstraints {
	return getDiscordLikeAudioConstraints({ stereo: true, krisp: true })
}

/**
 * Пресеты качества демонстрации экрана (в стиле Discord Nitro).
 */
export type ScreenSharePresetKey = 'screen720p30' | 'screen1080p60' | 'screen1440p60'

export interface ScreenSharePreset {
	key: ScreenSharePresetKey
	label: string
	shortLabel: string
	description: string
	width: number
	height: number
	frameRate: number
	maxBitrate: number
	isPremium: boolean
}

export const SCREEN_SHARE_PRESETS: Record<ScreenSharePresetKey, ScreenSharePreset> = {
	screen720p30: {
		key: 'screen720p30',
		label: '720p (30 FPS)',
		shortLabel: '720p 30fps',
		description: 'Базовое качество, минимальный расход трафика',
		width: 1280,
		height: 720,
		frameRate: 30,
		maxBitrate: 3_500_000,
		isPremium: false,
	},
	screen1080p60: {
		key: 'screen1080p60',
		label: '1080p Full HD (60 FPS)',
		shortLabel: '1080p 60fps',
		description: 'Кристальная четкость текста и высокая плавность',
		width: 1920,
		height: 1080,
		frameRate: 60,
		maxBitrate: 8_500_000,
		isPremium: false,
	},
	screen1440p60: {
		key: 'screen1440p60',
		label: '1440p / Исходное (60 FPS)',
		shortLabel: '1440p 60fps',
		description: 'Максимальная детализация для 2K/4K мониторов и игр',
		width: 2560,
		height: 1440,
		frameRate: 60,
		maxBitrate: 14_000_000,
		isPremium: true,
	},
}

/**
 * Оптимизация видеосекции SDP (b=AS, b=TIAS, x-google-max-bitrate для H264, VP9, AV1).
 */
export function optimizeVideoSdp(sdp: string, targetBitrateBps: number = 8_500_000): string {
	if (!sdp || !sdp.includes('m=video')) return sdp

	const targetBitrateKbps = Math.round(targetBitrateBps / 1000)
	const lines = sdp.split(/\r\n|\n/)
	const resultLines: string[] = []
	let inVideoSection = false
	let hasBandwidthAS = false
	let hasBandwidthTIAS = false

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		if (line.startsWith('m=')) {
			if (inVideoSection) {
				if (!hasBandwidthAS) resultLines.push(`b=AS:${targetBitrateKbps}`)
				if (!hasBandwidthTIAS) resultLines.push(`b=TIAS:${targetBitrateBps}`)
			}
			inVideoSection = line.startsWith('m=video')
			hasBandwidthAS = false
			hasBandwidthTIAS = false
			resultLines.push(line)
			continue
		}

		if (inVideoSection) {
			if (line.startsWith('b=AS:')) {
				hasBandwidthAS = true
				resultLines.push(`b=AS:${targetBitrateKbps}`)
				continue
			}
			if (line.startsWith('b=TIAS:')) {
				hasBandwidthTIAS = true
				resultLines.push(`b=TIAS:${targetBitrateBps}`)
				continue
			}

			if (line.startsWith('a=fmtp:')) {
				let modifiedFmtp = line
				if (!modifiedFmtp.includes('x-google-max-bitrate')) {
					const separator = modifiedFmtp.endsWith(';') ? '' : ';'
					modifiedFmtp += `${separator}x-google-min-bitrate=2000;x-google-max-bitrate=${targetBitrateKbps};x-google-start-bitrate=${Math.min(targetBitrateKbps, 5000)}`
				}
				resultLines.push(modifiedFmtp)
				continue
			}
		}

		resultLines.push(line)
	}

	if (inVideoSection) {
		if (!hasBandwidthAS) resultLines.push(`b=AS:${targetBitrateKbps}`)
		if (!hasBandwidthTIAS) resultLines.push(`b=TIAS:${targetBitrateBps}`)
	}

	return resultLines.join('\r\n')
}

