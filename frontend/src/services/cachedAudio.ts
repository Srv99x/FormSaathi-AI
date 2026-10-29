import cachedData from './cachedAudioData.json';

export interface IntroAudio {
  text: string;
  audioBase64: string;
}

export function getCachedIntroAudio(locale: 'en-IN' | 'hi-IN' = 'en-IN'): IntroAudio {
  if (locale === 'hi-IN') {
    return {
      text: 'नमस्ते! मैं फॉर्मसाथी हूँ, आपका आवाज़ सहायक। आइए आपका फॉर्म भरते हैं।',
      audioBase64: cachedData.intro_hi_b64,
    };
  }

  return {
    text: "Hello! I am FormSaathi, your voice assistant. Let's get your form filled.",
    audioBase64: cachedData.intro_en_b64,
  };
}

