/**
 * Singleton audio manager - ensures only one HTMLAudioElement exists
 * across the entire application.
 */

class AudioManager {
  private static instance: AudioManager
  private audio: HTMLAudioElement | null = null

  private constructor() {}

  static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager()
    }
    return AudioManager.instance
  }

  getAudio(): HTMLAudioElement {
    if (!this.audio) {
      this.audio = new Audio()
    }
    return this.audio
  }

  destroy(): void {
    if (this.audio) {
      this.audio.pause()
      this.audio.src = ''
      this.audio = null
    }
  }
}

export const audioManager = AudioManager.getInstance()
