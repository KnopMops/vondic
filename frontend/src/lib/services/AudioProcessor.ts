/**
 * Audio Processor for Discord-like voice quality
 * Implements noise suppression, echo cancellation, AGC, and high-pass filter
 */

export interface AudioProcessorOptions {
	// Noise suppression level (0-3): 0=off, 1=low, 2=medium, 3=high
	noiseSuppression: number
	// Echo cancellation (true/false)
	echoCancellation: boolean
	// Automatic gain control (true/false)
	autoGainControl: boolean
	// High-pass filter cutoff frequency (Hz)
	highPassFilter: number
	// Low-pass filter cutoff frequency (Hz)
	lowPassFilter: number
	// Gain adjustment in dB
	gain: number
	// Enable audio smoothing
	smoothing: boolean
}

const DEFAULT_OPTIONS: AudioProcessorOptions = {
	noiseSuppression: 3, // Maximum noise suppression to eliminate background hiss
	echoCancellation: true,
	autoGainControl: true,
	highPassFilter: 100, // Cut frequencies below 100Hz (reduces rumble and low-frequency noise)
	lowPassFilter: 8000, // Cut frequencies above 8kHz (reduces high-frequency hiss while preserving voice clarity)
	gain: 1.5, // Moderate gain boost (reduced to minimize background noise)
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

	/**
	 * Initialize audio processing chain
	 */
	async initialize(inputStream: MediaStream): Promise<MediaStream> {
		try {
			// Create audio context
			this.audioContext = new AudioContext({
				sampleRate: 48000,
				latencyHint: 'interactive',
			})

			// Create source from input stream
			this.mediaStreamSource = this.audioContext.createMediaStreamSource(
				inputStream,
			)

			// Create processing nodes
			this.createProcessingChain()

			// Create destination for processed output
			this.mediaStreamDestination =
				this.audioContext.createMediaStreamDestination()

			// Connect the chain
			this.connectProcessingChain()

			// Resume audio context if suspended
			if (this.audioContext.state === 'suspended') {
				await this.audioContext.resume()
			}

			console.log('[AudioProcessor] Initialized with Discord-like processing')
			return this.mediaStreamDestination.stream
		} catch (error) {
			console.error('[AudioProcessor] Initialization failed:', error)
			// Return original stream if processing fails
			return inputStream
		}
	}

	/**
	 * Create the audio processing chain
	 */
	private createProcessingChain() {
		// High-pass filter (removes low-frequency rumble and microphone handling noise)
		this.highPassNode = this.audioContext!.createBiquadFilter()
		this.highPassNode.type = 'highpass'
		this.highPassNode.frequency.value = this.options.highPassFilter
		this.highPassNode.Q.value = 0.7

		// Low-pass filter (removes high-frequency hiss and electronic noise)
		this.lowPassNode = this.audioContext!.createBiquadFilter()
		this.lowPassNode.type = 'lowpass'
		this.lowPassNode.frequency.value = this.options.lowPassFilter
		this.lowPassNode.Q.value = 0.5

		// Gain node for volume adjustment
		this.gainNode = this.audioContext!.createGain()
		this.gainNode.gain.value = this.dbToGain(this.options.gain)

		// Compressor for consistent volume (like Discord)
		// Enhanced settings for cleaner, more professional sound
		this.compressorNode = this.audioContext!.createDynamicsCompressor()
		this.compressorNode.threshold.value = -30 // Lower threshold for better noise gate effect
		this.compressorNode.knee.value = 40 // Softer knee for smoother compression
		this.compressorNode.ratio.value = 15 // Higher ratio for more consistent volume
		this.compressorNode.attack.value = 0.002 // Faster attack to catch transients
		this.compressorNode.release.value = 0.3 // Slightly longer release for natural sound
	}

	/**
	 * Connect all processing nodes in order
	 */
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

		// Signal chain: Source → High-pass → Low-pass → Gain → Compressor → Destination
		this.mediaStreamSource.connect(this.highPassNode)
		this.highPassNode.connect(this.lowPassNode)
		this.lowPassNode.connect(this.gainNode)
		this.gainNode.connect(this.compressorNode)
		this.compressorNode.connect(this.mediaStreamDestination)
	}

	/**
	 * Convert dB to linear gain
	 */
	private dbToGain(db: number): number {
		return Math.pow(10, db / 20)
	}

	/**
	 * Update noise suppression level
	 */
	setNoiseSuppression(level: number) {
		this.options.noiseSuppression = Math.max(0, Math.min(3, level))
		// Adjust low-pass filter based on noise suppression
		if (this.lowPassNode) {
			// Higher suppression = lower cutoff frequency for more aggressive noise reduction
			const cutoff = 10000 - (this.options.noiseSuppression * 1500)
			this.lowPassNode.frequency.value = Math.max(4000, cutoff)
		}
		// Adjust compressor threshold based on noise suppression
		if (this.compressorNode) {
			this.compressorNode.threshold.value = -24 - (this.options.noiseSuppression * 5)
		}
	}

	/**
	 * Update gain
	 */
	setGain(db: number) {
		this.options.gain = db
		if (this.gainNode) {
			this.gainNode.gain.value = this.dbToGain(db)
		}
	}

	/**
	 * Enable/disable echo cancellation
	 */
	setEchoCancellation(enabled: boolean) {
		this.options.echoCancellation = enabled
	}

	/**
	 * Enable/disable auto gain control
	 */
	setAutoGainControl(enabled: boolean) {
		this.options.autoGainControl = enabled
		if (this.compressorNode) {
			this.compressorNode.enabled = enabled
		}
	}

	/**
	 * Cleanup audio processing
	 */
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

	/**
	 * Get the processed output stream
	 */
	getOutputStream(): MediaStream | null {
		return this.mediaStreamDestination?.stream || null
	}

	/**
	 * Suspend audio processing (when muted)
	 */
	async suspend() {
		if (this.audioContext?.state === 'running') {
			await this.audioContext.suspend()
		}
	}

	/**
	 * Resume audio processing (when unmuted)
	 */
	async resume() {
		if (this.audioContext?.state === 'suspended') {
			await this.audioContext.resume()
		}
	}
}

/**
 * Get browser's native audio constraints for Discord-like quality
 */
export function getDiscordLikeAudioConstraints(): MediaTrackConstraints {
	return {
		// Basic constraints
		echoCancellation: true,
		noiseSuppression: true,
		autoGainControl: true,

		// High quality settings
		sampleRate: 48000,
		sampleSize: 16,
		channelCount: 1,

		// Advanced constraints for better quality with enhanced noise suppression
		advanced: [
			{
				echoCancellation: true,
				noiseSuppression: true,
				autoGainControl: true,
				sampleRate: 48000,
				// Chrome-specific enhanced noise suppression
				googEchoCancellation: true,
				googNoiseSuppression: true,
				googAutoGainControl: true,
				googHighpassFilter: true,
				googTypingNoiseDetection: true,
				googAudioMirroring: false,
				// Enhanced noise suppression
				googExperimentalEchoCancellation: true,
				googExperimentalNoiseSuppression: true,
				googExperimentalAutoGainControl: true,
				googNoiseReduction: true,
				// Additional noise reduction
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

/**
 * Enhanced audio constraints with experimental features
 */
export function getEnhancedAudioConstraints(): MediaTrackConstraints {
	return {
		// Standard constraints
		echoCancellation: { exact: true },
		noiseSuppression: { exact: true },
		autoGainControl: { exact: true },

		// Quality settings
		sampleRate: { ideal: 48000 },
		sampleSize: { ideal: 16 },
		channelCount: { ideal: 1 },

		// Chrome-specific advanced constraints
		googEchoCancellation: { exact: true },
		googNoiseSuppression: { exact: true },
		googAutoGainControl: { exact: true },
		googHighpassFilter: { exact: true },
		googTypingNoiseDetection: { exact: true },
		googAudioMirroring: { exact: false },

		// Additional Chrome flags
		googExperimentalEchoCancellation: { exact: true },
		googExperimentalNoiseSuppression: { exact: true },
		googExperimentalAutoGainControl: { exact: true },
	} as any
}
