export interface IntroAudio {
  text: string;
  audioBase64: string;
}

interface CachedAudioData {
  intro_hi_b64: string;
  intro_en_b64: string;
}

let cachedDataPromise: Promise<CachedAudioData> | null = null;

/**
 * Lazily loads the 677 KB pre-rendered audio asset only when voice features are engaged.
 * Never downloaded during normal keyboard-only form completion or browsing.
 */
export function loadAudioCache(): Promise<CachedAudioData> {
  if (!cachedDataPromise) {
    cachedDataPromise = import('./cachedAudioData.json').then((m) => m.default || m);
  }
  return cachedDataPromise;
}

export async function getCachedIntroAudio(locale: 'en-IN' | 'hi-IN' = 'en-IN'): Promise<IntroAudio> {
  const data = await loadAudioCache();
  if (locale === 'hi-IN') {
    return {
      text: 'नमस्ते! मैं फॉर्मसाथी हूँ, आपका आवाज़ सहायक। आइए आपका फॉर्म भरते हैं।',
      audioBase64: data.intro_hi_b64,
    };
  }

  return {
    text: "Hello! I am FormSaathi, your voice assistant. Let's get your form filled.",
    audioBase64: data.intro_en_b64,
  };
}
