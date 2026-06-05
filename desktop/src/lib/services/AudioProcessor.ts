

export interface AudioProcessorOptions {
	
	noiseSuppression: number
	
	echoCancellation: boolean
	
	autoGainControl: boolean
	
	highPassFilter: number
	
	lowPassFilter: number
	
	gain: number
	
	smoothing: boolean
}

const DEFAULT_OPTIONS: AudioProcessorOptions = {
	noiseSuppression: 2, 
	echoCancellation: true,
	autoGainControl: true,
	highPassFilter: 80, 
	lowPassFilter: 12000, 
	gain: 2.0, 
	smoothing: true,
}

export class AudioProcessor {
	private audioContext: AudioContext | null = null
	private mediaStreamSource: MediaStreamAudioSourceNode | null = null
	private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null
	private noiseGateNode: AudioWorkletNode | null = null
	private highPassNode: BiquadFilterNode | null = null
	private lowPassNode: BiquadFilterNode | null = null
	private gainNode: GainNode | null = null
	private compressorNode: DynamicsCompressorNode | null = null
	private options: AudioProcessorOptions

	constructor(options: Partial<AudioProcessorOptions> = {}) {
		this.options = { ...DEFAULT_OPTIONS, ...options }
	}

	
	async initialize(inputStream: MediaStream): Promise<MediaStream> {
		try {
			
			this.audioContext = new AudioContext({
				sampleRate: 48000,
				latencyHint: 'interactive',
			})

			
			this.mediaStreamSource = this.audioContext.createMediaStreamSource(
				inputStream,
			)

			
			this.createProcessingChain()

			
			this.mediaStreamDestination =
				this.audioContext.createMediaStreamDestination()

			
			this.connectProcessingChain()

			
			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume()
			}

			console.log('[AudioProcessor] Initialized with Discord-like processing')
			return this.mediaStreamDestination.stream
		} catch (error) {
			console.error('[AudioProcessor] Initialization failed:', error)
			
			return inputStream
		}
	}

	
	private createProcessingChain() {
		
		this.highPassNode = this.audioContext!.createBiquadFilter()
		this.highPassNode.type = 'highpass'
		this.highPassNode.frequency.value = this.options.highPassFilter
		this.highPassNode.Q.value = 0.7

		
		this.lowPassNode = this.audioContext!.createBiquadFilter()
		this.lowPassNode.type = 'lowpass'
		this.lowPassNode.frequency.value = this.options.lowPassFilter
		this.lowPassNode.Q.value = 0.5

		
		this.gainNode = this.audioContext!.createGain()
		this.gainNode.gain.value = this.dbToGain(this.options.gain)

		
		
		this.compressorNode = this.audioContext!.createDynamicsCompressor()
		this.compressorNode.threshold.value = -30 
		this.compressorNode.knee.value = 40 
		this.compressorNode.ratio.value = 15 
		this.compressorNode.attack.value = 0.002 
		this.compressorNode.release.value = 0.3 
	}

	
	private connectProcessingChain() {
		if (
			!this.mediaStreamSource ||
			!this.highPassNode ||
			!this.lowPassNode ||
			!this.gainNode ||
			!this.compressorNode ||
			!this.mediaStreamDestination
		) {
			return
		}

		
		this.mediaStreamSource.connect(this.highPassNode)
		this.highPassNode.connect(this.lowPassNode)
		this.lowPassNode.connect(this.gainNode)
		this.gainNode.connect(this.compressorNode)
		this.compressorNode.connect(this.mediaStreamDestination)
	}

	
	private dbToGain(db: number): number {
		return Math.pow(10, db / 20)
	}

	
	setNoiseSuppression(level: number) {
		this.options.noiseSuppression = Math.max(0, Math.min(3, level))
		
		if (this.lowPassNode) {
			
			const cutoff = 14000 - (this.options.noiseSuppression * 1000)
			this.lowPassNode.frequency.value = Math.max(6000, cutoff)
		}
		
		if (this.compressorNode) {
			this.compressorNode.threshold.value = -24 - (this.options.noiseSuppression * 5)
		}
	}

	
	setGain(db: number) {
		this.options.gain = db
		if (this.gainNode) {
			this.gainNode.gain.value = this.dbToGain(db)
		}
	}

	
	setEchoCancellation(enabled: boolean) {
		this.options.echoCancellation = enabled
	}

	
	setAutoGainControl(enabled: boolean) {
		this.options.autoGainControl = enabled
		if (this.compressorNode) {
			this.compressorNode.enabled = enabled
		}
	}

	
	cleanup() {
		if (this.audioContext) {
			this.audioContext.close()
			this.audioContext = null
		}
		this.mediaStreamSource = null
		this.mediaStreamDestination = null
		this.highPassNode = null
		this.lowPassNode = null
		this.gainNode = null
		this.compressorNode = null
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
}

export function getDiscordLikeAudioConstraints(): MediaTrackConstraints {
	return {
		
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,

		
		sampleRate: 48000,
		sampleSize: 16,
		channelCount: 1,

		
		advanced: [
			{
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				sampleRate: 48000,
				
				googEchoCancellation: true,
				googNoiseSuppression: true,
				googAutoGainControl: true,
				googHighpassFilter: true,
				googTypingNoiseDetection: true,
				googAudioMirroring: false,
				
				googExperimentalEchoCancellation: true,
				googExperimentalNoiseSuppression: true,
				googExperimentalAutoGainControl: true,
				googNoiseReduction: true,
				
				googEchoCancellationWithAutomaticGainControl: true,
				googImprovedEchoCancellation: true,
			},
			{
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				sampleRate: 44100,
			},
		],
	} as MediaTrackConstraints
}

export function getEnhancedAudioConstraints(): MediaTrackConstraints {
	return {
		
		echoCancellation: { exact: true },
		noiseSuppression: { exact: true },
		autoGainControl: { exact: true },

		
		sampleRate: { ideal: 48000 },
		sampleSize: { ideal: 16 },
		channelCount: { ideal: 1 },

		
		googEchoCancellation: { exact: true },
		googNoiseSuppression: { exact: true },
		googAutoGainControl: { exact: true },
		googHighpassFilter: { exact: true },
		googTypingNoiseDetection: { exact: true },
		googAudioMirroring: { exact: false },

		
		googExperimentalEchoCancellation: { exact: true },
		googExperimentalNoiseSuppression: { exact: true },
		googExperimentalAutoGainControl: { exact: true },
	} as any
}
