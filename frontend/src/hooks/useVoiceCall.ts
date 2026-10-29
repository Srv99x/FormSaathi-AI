import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../services/api';
import { tts } from '../services/ttsService';
import { FormSchema } from '../types/form';
import { OrbState, PhoneticVerification } from '../types/voice';
import { useMediaRecorder } from './useMediaRecorder';

export interface UseVoiceCallOptions {
  formSchema: FormSchema | null;
  sessionId: string | null;
  locale?: 'en-IN' | 'hi-IN';
  enableBargeIn?: boolean;
  onValuesExtracted?: (newValues: Record<string, string | number | null>) => void;
  onFieldHighlighted?: (fieldId: string) => void;
}

export function useVoiceCall({
  formSchema,
  sessionId,
  locale = 'en-IN',
  enableBargeIn = true,
  onValuesExtracted,
  onFieldHighlighted,
}: UseVoiceCallOptions) {
  const [isCallActive, setIsCallActive] = useState(false);
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

  // We keep a ref to sessionId and values so callbacks don't capture stale closures
  const sessionIdRef = useRef<string | null>(sessionId);
  sessionIdRef.current = sessionId;

  const localeRef = useRef<'en-IN' | 'hi-IN'>(locale);
  localeRef.current = locale;

  const formSchemaRef = useRef<FormSchema | null>(formSchema);
  formSchemaRef.current = formSchema;

  // Barge-in monitor during TTS speech playback
  const handleAudioData = useCallback(
    (volume: number) => {
      // If assistant is speaking and user starts talking, trigger instant barge-in (<100ms)
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

  // When silence is detected during user speaking, automatically submit turn!
  const handleSilenceDetected = useCallback(() => {
    if (orbState === 'listening' && !isProcessingTurnRef.current) {
      submitCurrentSpeechTurn();
    }
  }, [orbState]);

  const {
    isRecording,
    volumeLevel,
    startRecording,
    stopRecording,
  } = useMediaRecorder({
    onAudioData: handleAudioData,
    onSilenceDetected: handleSilenceDetected,
    silenceThresholdMs: 1600,
    energyThreshold: 24,
  });

  // Execute one conversational turn by sending recorded audio blob or text to backend
  const executeTurn = useCallback(
    async (audioBlob?: Blob | null, textTranscript?: string) => {
      const currentSid = sessionIdRef.current;
      if (!currentSid) return;

      isProcessingTurnRef.current = true;
      setOrbState('thinking');

      try {
        const turnResponse = await api.sendAssistantTurn(currentSid, {
          audioBlob: audioBlob || undefined,
          transcript: textTranscript,
          locale: localeRef.current,
        });

        if (turnResponse.user_transcript) {
          setUserTranscript(turnResponse.user_transcript);
        }

        // 1. Live Field Auto-population
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

        // 2. Phonetic spelling verification modal trigger
        if (turnResponse.name_candidate && turnResponse.name_spelling) {
          setPendingSpellingVerification({
            name: turnResponse.name_candidate,
            spelling: turnResponse.name_spelling,
            fieldId: 'full_name',
          });
        }

        // 3. Dynamic dropdown handling or assistant spoken reply
        const replyText = turnResponse.assistant_message || '';
        setAssistantMessage(replyText);

        // 4. Speak response via TTS
        setOrbState('speaking');
        await tts.speak(replyText, turnResponse.assistant_audio_base64, localeRef.current);

        // 5. Seamless loop: once TTS concludes, resume listening if call is still active
        if (isCallActive) {
          setOrbState('listening');
          await startRecording();
        }
      } catch (err: any) {
        console.warn('Voice turn error, falling back gracefully', err);
        const fallbackMsg =
          localeRef.current === 'hi-IN'
            ? 'मैंने आपकी बात सुन ली है। कृपया अगले फ़ील्ड की जानकारी बताएं।'
            : "I heard you. Please continue with your details or tap any field to edit.";
        setAssistantMessage(fallbackMsg);
        setOrbState('speaking');
        await tts.speak(fallbackMsg, null, localeRef.current);
        if (isCallActive) {
          setOrbState('listening');
          await startRecording();
        }
      } finally {
        isProcessingTurnRef.current = false;
      }
    },
    [isCallActive, onFieldHighlighted, onValuesExtracted, startRecording]
  );

  // Submit current speech turn manually or via VAD
  const submitCurrentSpeechTurn = useCallback(async () => {
    if (!isRecording) return;
    const blob = await stopRecording();
    if (blob) {
      await executeTurn(blob);
    } else {
      setOrbState('listening');
      await startRecording();
    }
  }, [executeTurn, isRecording, startRecording, stopRecording]);

  // Barge-in interruption trigger (user clicks [✋ Tap to Interrupt])
  const interruptAssistant = useCallback(async () => {
    tts.stop();
    setOrbState('listening');
    if (!isRecording) {
      await startRecording();
    }
  }, [isRecording, startRecording]);

  // Start voice call
  const startCall = useCallback(async () => {
    setIsCallActive(true);
    callStartTimeRef.current = Date.now();
    setCallDurationSeconds(0);

    // Call duration timer
    callTimerRef.current = window.setInterval(() => {
      setCallDurationSeconds(Math.floor((Date.now() - callStartTimeRef.current) / 1000));
    }, 1000);

    // Initial greeting
    const isHindi = localeRef.current === 'hi-IN';
    const formTitle = formSchemaRef.current?.title || 'FormSaathi';
    const initialGreeting = isHindi
      ? `नमस्ते! मैं आपका फॉर्म साथी हूँ। आइए ${formTitle} भरते हैं। कृपया अपना पूरा नाम बताइए।`
      : `Hello! I am your FormSaathi assistant for ${formTitle}. Let's get started. What is your full name?`;

    setAssistantMessage(initialGreeting);
    setOrbState('speaking');

    await tts.speak(initialGreeting, null, localeRef.current);

    // Immediately start listening after greeting
    setOrbState('listening');
    await startRecording();
  }, [startRecording]);

  // End voice call
  const endCall = useCallback(async () => {
    tts.stop();
    await stopRecording();
    if (callTimerRef.current) {
      clearInterval(callTimerRef.current);
      callTimerRef.current = null;
    }
    setIsCallActive(false);
    setOrbState('idle');
  }, [stopRecording]);

  // Phonetic spelling resolution
  const resolveSpelling = useCallback(
    (confirmedName: string) => {
      if (pendingSpellingVerification && onValuesExtracted) {
        onValuesExtracted({ [pendingSpellingVerification.fieldId]: confirmedName });
      }
      setPendingSpellingVerification(null);
      // Assistant acknowledges verified spelling
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
      tts.stop();
      if (callTimerRef.current) {
        clearInterval(callTimerRef.current);
      }
    };
  }, []);

  return {
    isCallActive,
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
    interruptAssistant,
    submitCurrentSpeechTurn,
    resolveSpelling,
    skipOptionalAndFinalize,
  };
}
