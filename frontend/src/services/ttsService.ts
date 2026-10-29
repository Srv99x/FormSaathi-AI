/**
 * Text-to-Speech audio player supporting:
 * 1. Base64 audio playback from Sarvam Bulbul TTS
 * 2. Fallback to browser SpeechSynthesis (Web Speech API)
 * 3. Sub-100ms Barge-in instant cancellation
 */

class TTSService {
  private currentAudio: HTMLAudioElement | null = null;
  private isSpeaking = false;
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
   * Stop all active playback immediately (< 50ms)
   */
  public stop(): void {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch (err) {
        // ignore
      }
      this.currentAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (err) {
        // ignore
      }
    }

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifyEnd();
    }
  }

  /**
   * Plays speech from either base64 audio or browser synthesizer
   */
  public async speak(
    text: string,
    base64Audio?: string | null,
    locale: 'en-IN' | 'hi-IN' = 'en-IN'
  ): Promise<void> {
    this.stop();

    if (!text && !base64Audio) return;

    this.isSpeaking = true;
    this.notifyStart();

    // 1. If base64 audio is provided from backend Sarvam Bulbul
    if (base64Audio) {
      try {
        let audioSrc = base64Audio;
        if (!audioSrc.startsWith('data:')) {
          audioSrc = `data:audio/wav;base64,${base64Audio}`;
        }

        const audio = new Audio(audioSrc);
        this.currentAudio = audio;

        await new Promise<void>((resolve, reject) => {
          audio.onended = () => {
            this.isSpeaking = false;
            this.currentAudio = null;
            this.notifyEnd();
            resolve();
          };

          audio.onerror = (e) => {
            console.warn('HTMLAudio error, falling back to Web Speech API', e);
            reject(e);
          };

          audio.play().catch(reject);
        });
        return;
      } catch (err) {
        console.warn('Sarvam base64 audio playback failed, falling back to Web Speech', err);
      }
    }

    // 2. Fallback to Web Speech API (speechSynthesis)
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && text) {
      await new Promise<void>((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = locale === 'hi-IN' ? 'hi-IN' : 'en-IN';
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        // Try to pick an appropriate Indian voice
        const voices = window.speechSynthesis.getVoices();
        const preferredVoice = voices.find((v) =>
          locale === 'hi-IN' ? v.lang.includes('hi') : v.lang.includes('en-IN') || v.lang.includes('India')
        );
        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }

        utterance.onend = () => {
          this.isSpeaking = false;
          this.notifyEnd();
          resolve();
        };

        utterance.onerror = () => {
          this.isSpeaking = false;
          this.notifyEnd();
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      });
    } else {
      this.isSpeaking = false;
      this.notifyEnd();
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

