import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { tts } from '../services/ttsService';
import { getCachedIntroAudio } from '../services/cachedAudio';
import { FormSchema } from '../types/form';
import { OrbState, PhoneticVerification } from '../types/voice';
import { useMediaRecorder } from './useMediaRecorder';

export interface UseVoiceCallOptions {
  formSchema: FormSchema | null;
  sessionId: string | null;
  locale?: 'en-IN' | 'hi-IN';
  currentValues?: Record<string, any>;
  enableBargeIn?: boolean;
  onValuesExtracted?: (newValues: Record<string, string | number | null>) => void;
  onFieldHighlighted?: (fieldId: string) => void;
}

export function useVoiceCall({
  formSchema,
  sessionId,
  locale = 'en-IN',
  currentValues,
  enableBargeIn = true,
  onValuesExtracted,
  onFieldHighlighted,
}: UseVoiceCallOptions) {
  const [isCallActive, setIsCallActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [assistantMessage, setAssistantMessage] = useState<string>('');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [pendingSpellingVerification, setPendingSpellingVerification] = useState<PhoneticVerification | null>(null);
  const [lastAutoFilledFields, setLastAutoFilledFields] = useState<string[]>([]);
  const [isDoneRecommendingOptional, setIsDoneRecommendingOptional] = useState(false);

  const callTimerRef = useRef<number | null>(null);
  const callStartTimeRef = useRef<number>(0);
  const isBargeInActiveRef = useRef(false);
  const isProcessingTurnRef = useRef(false);

  // Active call session generation token. Incrementing this immediately drops late network responses!
  const callSessionTokenRef = useRef(0);
  const isCallActiveRef = useRef(false);
  isCallActiveRef.current = isCallActive;

  const isPausedRef = useRef(false);
  isPausedRef.current = isPaused;

  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;

  const currentValuesRef = useRef<Record<string, any>>(currentValues || {});
  currentValuesRef.current = currentValues || {};

  const localeRef = useRef<'en-IN' | 'hi-IN'>(locale);
  localeRef.current = locale;

  const formSchemaRef = useRef<FormSchema | null>(formSchema);
  formSchemaRef.current = formSchema;

  // Barge-in monitor during TTS speech playback
  const handleAudioData = useCallback(
    (volume: number) => {
      if (enableBargeIn && orbState === 'speaking' && volume > 28 && !isBargeInActiveRef.current) {
        isBargeInActiveRef.current = true;
        tts.stop();
        setOrbState('listening');
        setTimeout(() => {
          isBargeInActiveRef.current = false;
        }, 500);
      }
    },
    [enableBargeIn, orbState]
  );

  const submitTurnRef = useRef<() => Promise<void>>(async () => {});

  // Silence detected callback (automated VAD)
  const handleSilenceDetected = useCallback(() => {
    if (!isProcessingTurnRef.current && isCallActiveRef.current && !isPausedRef.current) {
      submitTurnRef.current();
    }
  }, []);

  const {
    isRecording,
    volumeLevel,
    startRecording,
    stopRecording,
  } = useMediaRecorder({
    onAudioData: handleAudioData,
    onSilenceDetected: handleSilenceDetected,
    silenceThresholdMs: 1350,
    energyThreshold: 14,
  });

  // Execute conversational turn
  const executeTurn = useCallback(
    async (audioBlob?: Blob | null, textTranscript?: string) => {
      const currentSid = sessionIdRef.current;
      const currentToken = callSessionTokenRef.current;
      if (!currentSid || !isCallActiveRef.current) return;

      isProcessingTurnRef.current = true;
      setOrbState('thinking');

      try {
        const turnResponse = await api.sendAssistantTurn(currentSid, {
          audioBlob: audioBlob || undefined,
          transcript: textTranscript,
          locale: localeRef.current,
          currentValues: currentValuesRef.current,
        });

        // If the call was closed while waiting for backend, DROP response immediately!
        if (callSessionTokenRef.current !== currentToken || !isCallActiveRef.current) {
          return;
        }

        if (turnResponse.user_transcript) {
          setUserTranscript(turnResponse.user_transcript);
        }

        // Live Field Auto-population
        const recognizedCandidates = turnResponse.candidates || [];
        const recognizedValues: Record<string, string | number | null> = {};
        const changedFields: string[] = [];

        recognizedCandidates.forEach((c) => {
          if (c.value !== undefined && c.value !== null && String(c.value).trim() !== '') {
            recognizedValues[c.field_id] = c.value;
            changedFields.push(c.field_id);
            if (onFieldHighlighted) {
              onFieldHighlighted(c.field_id);
            }
          }
        });

        if (turnResponse.updated_values) {
          Object.entries(turnResponse.updated_values).forEach(([k, v]) => {
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              recognizedValues[k] = v;
              if (!changedFields.includes(k)) {
                changedFields.push(k);
                if (onFieldHighlighted) {
                  onFieldHighlighted(k);
                }
              }
            }
          });
        }

        if (Object.keys(recognizedValues).length > 0 && onValuesExtracted) {
          onValuesExtracted(recognizedValues);
          setLastAutoFilledFields(changedFields);
        }

        // Phonetic verification trigger
        if (turnResponse.name_candidate && turnResponse.name_spelling) {
          setPendingSpellingVerification({
            name: turnResponse.name_candidate,
            spelling: turnResponse.name_spelling,
            fieldId: 'full_name',
          });
        }

        const replyText = turnResponse.assistant_message || '';
        setAssistantMessage(replyText);

        // Speak response via TTS only if call is still active
        if (callSessionTokenRef.current === currentToken && isCallActiveRef.current && !isPausedRef.current) {
          setOrbState('speaking');
          await tts.speak(replyText, turnResponse.assistant_audio_base64, localeRef.current);
        }

        // Resume listening if call is active and not paused
        if (callSessionTokenRef.current === currentToken && isCallActiveRef.current && !isPausedRef.current) {
          setOrbState('listening');
          await startRecording();
        }
      } catch (err: any) {
        console.warn('Voice turn error, falling back gracefully', err);
        if (callSessionTokenRef.current !== currentToken || !isCallActiveRef.current) return;

        const fallbackMsg =
          localeRef.current === 'hi-IN'
            ? 'मैंने आपकी बात सुन ली है। कृपया अगले फ़ील्ड की जानकारी बताएं।'
            : "I heard you. Please continue with your details or tap any field to edit.";
        setAssistantMessage(fallbackMsg);
        setOrbState('speaking');

        let fallbackAudio: string | null = null;
        try {
          fallbackAudio = await api.synthesizeTTS(fallbackMsg, localeRef.current);
        } catch {
          // ignore
        }

        if (callSessionTokenRef.current === currentToken && isCallActiveRef.current && !isPausedRef.current) {
          await tts.speak(fallbackMsg, fallbackAudio, localeRef.current);
        }

        if (callSessionTokenRef.current === currentToken && isCallActiveRef.current && !isPausedRef.current) {
          setOrbState('listening');
          await startRecording();
        }
      } finally {
        isProcessingTurnRef.current = false;
      }
    },
    [onFieldHighlighted, onValuesExtracted, startRecording]
  );

  // Submit speech turn
  const submitCurrentSpeechTurn = useCallback(async () => {
    if (isProcessingTurnRef.current || !isCallActiveRef.current || isPausedRef.current) return;
    const blob = await stopRecording();
    if (blob && blob.size > 1500) {
      await executeTurn(blob);
    } else {
      if (isCallActiveRef.current && !isPausedRef.current) {
        setOrbState('listening');
        await startRecording();
      }
    }
  }, [executeTurn, startRecording, stopRecording]);

  submitTurnRef.current = submitCurrentSpeechTurn;

  // Interrupt assistant
  const interruptAssistant = useCallback(async () => {
    tts.stop();
    setOrbState('listening');
    if (!isRecording && isCallActiveRef.current && !isPausedRef.current) {
      await startRecording();
    }
  }, [isRecording, startRecording]);

  // Start voice call with instant cached intro + parallel background status inspection
  const startCall = useCallback(async () => {
    const currentToken = ++callSessionTokenRef.current;
    setIsCallActive(true);
    setIsPaused(false);
    callStartTimeRef.current = Date.now();
    setCallDurationSeconds(0);

    // Call duration timer
    if (callTimerRef.current) clearInterval(callTimerRef.current);
    callTimerRef.current = window.setInterval(() => {
      setCallDurationSeconds(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);

    const isHindi = localeRef.current === 'hi-IN';
    const formTitle = formSchemaRef.current?.title || (isHindi ? 'फॉर्म' : 'Form');
    const fields = formSchemaRef.current?.fields || [];
    const curVals = currentValuesRef.current || {};

    // Check filled fields
    const filledFields = fields.filter((f) => {
      const v = curVals[f.id];
      return v !== null && v !== undefined && String(v).trim() !== '';
    });
    const filledFieldNames = filledFields.map((f) => f.label || f.id);

    // Next missing field
    const unfilledRequired = fields.filter(
      (f) => f.required && (curVals[f.id] === null || curVals[f.id] === undefined || String(curVals[f.id]).trim() === '')
    );
    const nextField =
      unfilledRequired.length > 0
        ? unfilledRequired[0]
        : fields.find((f) => curVals[f.id] === null || curVals[f.id] === undefined || String(curVals[f.id]).trim() === '');
    const nextFieldLabel = nextField ? (nextField.label || nextField.id) : (isHindi ? 'विवरण' : 'details');

    // Prepare status speech text
    let statusText = '';
    if (filledFields.length > 0) {
      statusText = isHindi
        ? `मैं देख सकता हूँ कि आप ${formTitle} भर रहे हैं। आपने अपना ${filledFieldNames.join(', ')} पहले ही भर लिया है। तो आइए बाकी का फॉर्म भरते हैं! फॉर्म में अब आपका ${nextFieldLabel} पूछा गया है, तो कृपया बताइए।`
        : `I see you are filling the ${formTitle}, and you have already filled your ${filledFieldNames.join(', ')}. Let's continue! The form asks for your ${nextFieldLabel} next, please share it.`;
    } else {
      statusText = isHindi
        ? `मैं देख सकता हूँ कि आप ${formTitle} भर रहे हैं। आपने अभी तक कुछ नहीं भरा है, तो आइए इसे भरना शुरू करते हैं! फॉर्म में सबसे पहले आपका ${nextFieldLabel} पूछा गया है, तो कृपया बताइए।`
        : `I see you are filling the ${formTitle}. You haven't filled anything yet, so let's start filling it! The form asks for your ${nextFieldLabel} at first, please share it.`;
    }

    // 1. Instantly play pre-cached introductory line (0ms latency, zero waiting!)
    const intro = getCachedIntroAudio(localeRef.current);
    setAssistantMessage(intro.text);
    setOrbState('speaking');

    // In parallel: fetch status audio from backend while intro is playing!
    const statusAudioPromise = api.synthesizeTTS(statusText, localeRef.current).catch(() => null);

    // Play the instant intro
    await tts.speak(intro.text, intro.audioBase64, localeRef.current);

    // If user closed the call while intro was playing, abort immediately
    if (callSessionTokenRef.current !== currentToken || !isCallActiveRef.current) return;

    // 2. Natural 1-second pause
    setOrbState('thinking');
    await new Promise((r) => setTimeout(r, 1000));
    if (callSessionTokenRef.current !== currentToken || !isCallActiveRef.current) return;

    // 3. Play the freshly synthesized status audio
    const statusAudio = await statusAudioPromise;
    if (callSessionTokenRef.current !== currentToken || !isCallActiveRef.current) return;

    setAssistantMessage(statusText);
    setOrbState('speaking');
    await tts.speak(statusText, statusAudio, localeRef.current);

    // If still active, transition to listening mode
    if (callSessionTokenRef.current === currentToken && isCallActiveRef.current && !isPausedRef.current) {
      setOrbState('listening');
      await startRecording();
    }
  }, [startRecording]);

  // End voice call (completely terminates audio, recording, and resets state)
  const endCall = useCallback(async () => {
    callSessionTokenRef.current++;
    isCallActiveRef.current = false;
    isPausedRef.current = false;
    setIsPaused(false);
    tts.stop();
    await stopRecording();
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setIsCallActive(false);
    setOrbState('idle');
    setAssistantMessage('');
    setUserTranscript('');
  }, [stopRecording]);

  // Toggle pause/resume
  const togglePause = useCallback(async () => {
    if (!isCallActiveRef.current) return;

    if (!isPaused) {
      // Pause
      setIsPaused(true);
      isPausedRef.current = true;
      tts.stop();
      await stopRecording();
      setOrbState('idle');
    } else {
      // Resume
      setIsPaused(false);
      isPausedRef.current = false;
      setOrbState('listening');
      await startRecording();
    }
  }, [isPaused, startRecording, stopRecording]);

  // Phonetic spelling resolution
  const resolveSpelling = useCallback(
    (confirmedName: string) => {
      if (pendingSpellingVerification && onValuesExtracted) {
        onValuesExtracted({ [pendingSpellingVerification.fieldId]: confirmedName });
      }
      setPendingSpellingVerification(null);
      const ack =
        localeRef.current === 'hi-IN'
          ? `धन्यवाद! आपका नाम "${confirmedName}" दर्ज कर लिया गया है।`
          : `Thank you! I have confirmed your name as ${confirmedName}.`;
      setAssistantMessage(ack);
      tts.speak(ack, null, localeRef.current);
    },
    [onValuesExtracted, pendingSpellingVerification]
  );

  // Skip optional fields recommendation
  const skipOptionalAndFinalize = useCallback(() => {
    setIsDoneRecommendingOptional(true);
    const msg =
      localeRef.current === 'hi-IN'
        ? 'बहुत बढ़िया! सभी अनिवार्य फ़ील्ड भर चुके हैं। कृपया नीचे दिए गए फॉर्म की समीक्षा करें और पुष्टि करें।'
        : 'Great! All required fields are completed. Please review your details and confirm below.';
    setAssistantMessage(msg);
    tts.speak(msg, null, localeRef.current);
    endCall();
  }, [endCall]);

  useEffect(() => {
    return () => {
      callSessionTokenRef.current++;
      tts.stop();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  return {
    isCallActive,
    isPaused,
    orbState,
    assistantMessage,
    userTranscript,
    callDurationSeconds,
    volumeLevel,
    isRecording,
    pendingSpellingVerification,
    lastAutoFilledFields,
    isDoneRecommendingOptional,
    startCall,
    endCall,
    togglePause,
    interruptAssistant,
    submitCurrentSpeechTurn,
    resolveSpelling,
    skipOptionalAndFinalize,
  };
}
