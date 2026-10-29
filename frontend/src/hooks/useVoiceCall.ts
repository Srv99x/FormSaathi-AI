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

  // We keep a ref to sessionId, values, and formSchema so callbacks don't capture stale closures
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

  // Reference to current submit turn function to avoid closure staleness
  const submitTurnRef = useRef<() => Promise<void>>(async () => {});

  // When silence is detected after user speaking, automatically submit the speech turn!
  const handleSilenceDetected = useCallback(() => {
    if (!isProcessingTurnRef.current) {
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
    silenceThresholdMs: 1350, // Auto-submit when user pauses for 1.35s
    energyThreshold: 14,      // Responsive to natural speaking volume
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
          currentValues: currentValuesRef.current,
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
        let fallbackAudio: string | null = null;
        try {
          fallbackAudio = await api.synthesizeTTS(fallbackMsg, localeRef.current);
        } catch {
          // ignore
        }
        await tts.speak(fallbackMsg, fallbackAudio, localeRef.current);
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

  // Submit current speech turn manually or via automated VAD
  const submitCurrentSpeechTurn = useCallback(async () => {
    if (isProcessingTurnRef.current) return;
    const blob = await stopRecording();
    // Verify audio chunk contains spoken content
    if (blob && blob.size > 1500) {
      await executeTurn(blob);
    } else {
      if (isCallActive) {
        setOrbState('listening');
        await startRecording();
      }
    }
  }, [executeTurn, isCallActive, startRecording, stopRecording]);

  submitTurnRef.current = submitCurrentSpeechTurn;

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

    // Context-aware background form inspection on click
    const isHindi = localeRef.current === 'hi-IN';
    const formTitle = formSchemaRef.current?.title || (isHindi ? 'फॉर्म' : 'Form');
    const fields = formSchemaRef.current?.fields || [];
    const curVals = currentValuesRef.current || {};

    // Check which fields are already filled (manually written or stored)
    const filledFields = fields.filter((f) => {
      const v = curVals[f.id];
      return v !== null && v !== undefined && String(v).trim() !== '';
    });
    const filledFieldNames = filledFields.map((f) => f.label || f.id);

    // Find the next missing field in logical order
    const unfilledRequired = fields.filter(
      (f) => f.required && (curVals[f.id] === null || curVals[f.id] === undefined || String(curVals[f.id]).trim() === '')
    );
    const nextField =
      unfilledRequired.length > 0
        ? unfilledRequired[0]
        : fields.find((f) => curVals[f.id] === null || curVals[f.id] === undefined || String(curVals[f.id]).trim() === '');
    const nextFieldLabel = nextField ? (nextField.label || nextField.id) : (isHindi ? 'विवरण' : 'details');

    let initialGreeting = '';
    if (filledFields.length > 0) {
      initialGreeting = isHindi
        ? `नमस्ते! मैं आपका फॉर्म साथी हूँ। मैं देख सकता हूँ कि आप ${formTitle} भर रहे हैं। आपने अपना ${filledFieldNames.join(', ')} पहले ही भर लिया है। तो आइए बाकी का फॉर्म भरते हैं! फॉर्म में अब आपका ${nextFieldLabel} पूछा गया है, तो कृपया वह बताइए।`
        : `Hello! I am FormSaathi, and I can see you are filling the ${formTitle}. You have already filled your ${filledFieldNames.join(', ')}. So let's continue filling it! The form asks for your ${nextFieldLabel} next, so please share it whenever you are ready.`;
    } else {
      initialGreeting = isHindi
        ? `नमस्ते! मैं आपका फॉर्म साथी हूँ, और मैं देख सकता हूँ कि आप ${formTitle} भर रहे हैं। आपने अभी तक कुछ नहीं भरा है, तो आइए इसे भरना शुरू करते हैं! फॉर्म में सबसे पहले आपका ${nextFieldLabel} पूछा गया है, तो कृपया बताइए।`
        : `Hello! I am FormSaathi, and I can see you are filling the ${formTitle}. You haven't filled anything yet, so let's start filling it! The form asks for your ${nextFieldLabel} at first, so please share it whenever you are ready.`;
    }

    setAssistantMessage(initialGreeting);
    setOrbState('speaking');

    // Fetch realistic Sarvam Bulbul TTS audio from backend
    let sarvamAudio: string | null = null;
    try {
      sarvamAudio = await api.synthesizeTTS(initialGreeting, localeRef.current);
    } catch (err) {
      console.warn('Sarvam TTS unavailable for initial greeting, falling back to Web Speech', err);
    }

    await tts.speak(initialGreeting, sarvamAudio, localeRef.current);

    // Immediately start listening after greeting
    if (callTimerRef.current) {
      setOrbState('listening');
      await startRecording();
    }
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
