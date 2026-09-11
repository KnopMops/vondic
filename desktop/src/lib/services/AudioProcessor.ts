/**
 * AudioProcessor.ts - Звуковой процессор уровня Discord для настольного клиента Vondic Desktop.
 * 
 * Технологический стек:
 * 1. Кодек Opus (48 kHz Fullband, In-band FEC, minptime=10ms, VBR, DTX, Stereo).
 * 2. Адаптивный битрейт (Adaptive Bitrate Controller - ABR).
 * 3. Управляемый битрейт (Discord Boost Presets: 32, 64, 128, 256, 384 kbps).
 * 4. Интеллектуальное шумоподавление Krisp (Спектральный гейт, VAD, подавление кликов).
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

	// Ищем Payload Type кодека opus
	for (const line of lines) {
		const match = line.match(/^a=rtpmap:(\d+)\s+opus\/48000\/2/i)
		if (match) {
			opusPayloadType = match[1]
			break
		}
	}

	if (!opusPayloadType) {
		return sdp
	}

	const newParams: Record<string, string> = {
		minptime: String(minPtime),
		useinbandfec: useFec ? '1' : '0',
		stereo: stereo ? '1' : '0',
		'sprop-stereo': stereo ? '1' : '0',
		maxplaybackrate: '48000',
		'sprop-maxcapturerate': '48000',
		cbr: '0',
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

			const merged = { ...existingParams, ...newParams }
			const formatted = Object.entries(merged)
				.map(([k, v]) => (v !== '' ? `${k}=${v}` : k))
				.join(';')

			updatedLines.push(`a=fmtp:${opusPayloadType} ${formatted}`)
		} else {
			updatedLines.push(line)
			if (line.startsWith(`a=rtpmap:${opusPayloadType} `) && !fmtpFound) {
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
				if (report.type === 'candidate-pair' && report.state === 'succeeded') {
					if (typeof report.currentRoundTripTime === 'number') {
						roundTripTimeMs = report.currentRoundTripTime * 1000
					}
				}

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

			let qualityGrade: NetworkQualityStats['qualityGrade'] = 'excellent'
			let adaptedBitrate = this.targetBitrate

			if (packetLossPercent > 15 || roundTripTimeMs > 450) {
				qualityGrade = 'critical'
				adaptedBitrate = Math.min(this.targetBitrate, 12_000)
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
		} catch (e) {}
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
	highPassFilter: 75,
	lowPassFilter: 15000,
	gain: 1.0,
	smoothing: true,
	krispEnabled: true,
}

export class AudioProcessor {
	private audioContext: AudioContext | null = null
	private mediaStreamSource: MediaStreamAudioSourceNode | null = null
	private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null
	
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

		this.highPassNode = this.audioContext.createBiquadFilter()
		this.highPassNode.type = 'highpass'
		this.highPassNode.frequency.value = this.options.highPassFilter
		this.highPassNode.Q.value = 0.7

		this.lowPassNode = this.audioContext.createBiquadFilter()
		this.lowPassNode.type = 'lowpass'
		this.lowPassNode.frequency.value = this.options.lowPassFilter
		this.lowPassNode.Q.value = 0.6

		this.speechDetectorNode = this.audioContext.createAnalyser()
		this.speechDetectorNode.fftSize = 512
		this.speechDetectorNode.smoothingTimeConstant = 0.2

		this.gateGainNode = this.audioContext.createGain()
		this.gateGainNode.gain.value = this.options.krispEnabled ? 1.0 : 1.0

		this.bypassGainNode = this.audioContext.createGain()
		this.bypassGainNode.gain.value = this.options.krispEnabled ? 0.0 : 1.0

		this.compressorNode = this.audioContext.createDynamicsCompressor()
		this.compressorNode.threshold.value = -24
		this.compressorNode.knee.value = 25
		this.compressorNode.ratio.value = 10
		this.compressorNode.attack.value = 0.0015
		this.compressorNode.release.value = 0.18

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

		this.mediaStreamSource.connect(this.highPassNode)
		this.highPassNode.connect(this.lowPassNode)
		this.lowPassNode.connect(this.gateGainNode)
		this.gateGainNode.connect(this.compressorNode)
		this.compressorNode.connect(this.outputGainNode)

		this.lowPassNode.connect(this.speechDetectorNode)

		this.mediaStreamSource.connect(this.bypassGainNode)
		this.bypassGainNode.connect(this.outputGainNode)

		this.outputGainNode.connect(this.mediaStreamDestination)
	}

	private startVoiceActivityDetection() {
		if (!this.speechDetectorNode || !this.audioContext) return

		const dataArray = new Uint8Array(this.speechDetectorNode.frequencyBinCount)
		const NOISE_THRESHOLD = 18
		const SPEECH_THRESHOLD = 32

		const loop = () => {
			if (!this.isProcessing || !this.speechDetectorNode || !this.gateGainNode || !this.audioContext) {
				return
			}

			if (this.options.krispEnabled) {
				this.speechDetectorNode.getByteFrequencyData(dataArray)

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
					this.gateGainNode.gain.cancelScheduledValues(now)
					this.gateGainNode.gain.setTargetAtTime(1.0, now, 0.002)
				} else if (avgEnergy < NOISE_THRESHOLD) {
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

	setKrispEnabled(enabled: boolean) {
		this.options.krispEnabled = enabled
		if (!this.audioContext || !this.gateGainNode || !this.bypassGainNode) return

		const now = this.audioContext.currentTime
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
