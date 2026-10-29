/**
 * Dedicated Text-to-Speech audio player for Sarvam AI Bulbul.
 * Plays pristine Base64 WAV audio with instant (< 50ms) barge-in cancellation.
 * Browser SpeechSynthesis has been completely removed to prevent dual/concurrent voices.
 */

class TTSService {
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;
  private playbackGeneration = 0;
  private onEndCallbacks: Set<() => void> = new Set();
  private onStartCallbacks: Set<() => void> = new Set();

  public onStart(cb: () => void): () => void {
    this.onStartCallbacks.add(cb);
    return () => this.onStartCallbacks.delete(cb);
  }

  public onEnd(cb: () => void): () => void {
    this.onEndCallbacks.add(cb);
    return () => this.onEndCallbacks.delete(cb);
  }

  public get isPlaying(): boolean {
    return this.isSpeaking;
  }

  /**
   * Stop all active audio playback immediately (< 50ms).
   * Guarantees zero residual or concurrent audio playback.
   */
  public stop(): void {
    this.playbackGeneration++;

    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.onended = null;
        this.currentAudio.onerror = null;
        this.currentAudio.src = '';
      } catch {
        // ignore
      }
      this.currentAudio = null;
    }

    // Cancel any lingering browser speech if it was ever active
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifyEnd();
    }
  }

  /**
   * Plays speech using Sarvam Bulbul base64 audio.
   * If base64Audio is not available, completes silently without invoking robotic browser speech.
   */
  public async speak(
    _text: string,
    base64Audio?: string | null,
    _locale: 'en-IN' | 'hi-IN' = 'en-IN'
  ): Promise<void> {
    this.stop();
    const thisGen = ++this.playbackGeneration;

    if (!base64Audio || !base64Audio.trim()) {
      this.isSpeaking = false;
      this.notifyEnd();
      return;
    }

    this.isSpeaking = true;
    this.notifyStart();

    try {
      let audioSrc = base64Audio.trim();
      if (!audioSrc.startsWith('data:')) {
        audioSrc = `data:audio/wav;base64,${audioSrc}`;
      }

      const audio = new Audio(audioSrc);
      this.currentAudio = audio;

      await new Promise<void>((resolve) => {
        audio.onended = () => {
          if (this.playbackGeneration === thisGen) {
            this.isSpeaking = false;
            this.currentAudio = null;
            this.notifyEnd();
          }
          resolve();
        };

        audio.onerror = (e) => {
          console.warn('Sarvam HTMLAudio playback error', e);
          if (this.playbackGeneration === thisGen) {
            this.isSpeaking = false;
            this.currentAudio = null;
            this.notifyEnd();
          }
          resolve();
        };

        audio.play().catch((err) => {
          console.warn('Audio play was interrupted or blocked', err);
          if (this.playbackGeneration === thisGen) {
            this.isSpeaking = false;
            this.currentAudio = null;
            this.notifyEnd();
          }
          resolve();
        });
      });
    } catch (err) {
      console.warn('Audio initialization failed', err);
      if (this.playbackGeneration === thisGen) {
        this.isSpeaking = false;
        this.notifyEnd();
      }
    }
  }

  private notifyStart(): void {
    this.onStartCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    });
  }

  private notifyEnd(): void {
    this.onEndCallbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error(err);
      }
    });
  }
}

export const tts = new TTSService();
