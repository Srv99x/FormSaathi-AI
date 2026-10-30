import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseMediaRecorderOptions {
  onAudioData?: (volume: number, frequencyData: Uint8Array) => void;
  onSilenceDetected?: () => void;
  silenceThresholdMs?: number;
  energyThreshold?: number; // 0 to 255 (moderate threshold filters out ambient room/fan noise)
  maxRecordingDurationMs?: number; // Failsafe safety cap to prevent indefinite listening
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}) {
  const {
    onAudioData,
    onSilenceDetected,
    silenceThresholdMs = 1500,
    energyThreshold = 20,
    maxRecordingDurationMs = 25000,
  } = options;

  const [isRecording, setIsRecording] = useState(false);
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Keep callback refs so closures always invoke latest handlers
  const onAudioDataRef = useRef(onAudioData);
  onAudioDataRef.current = onAudioData;

  const onSilenceDetectedRef = useRef(onSilenceDetected);
  onSilenceDetectedRef.current = onSilenceDetected;

  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const silenceTimerRef = useRef<number | null>(null);
  const speechDetectedRef = useRef(false);
  const speechStartTimeRef = useRef(0);
  const consecutiveSpeechFramesRef = useRef(0);

  const cleanupAudioNodes = useCallback(() => {
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (silenceTimerRef.current) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch (e) {
        // ignore
      }
      audioContextRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
  }, []);

  const startMonitoring = useCallback(
    (stream: MediaStream) => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.5;
        source.connect(analyser);
        analyserRef.current = analyser;

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getByteFrequencyData(dataArray);

          // Calculate average energy
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const avg = sum / bufferLength;
          setVolumeLevel(avg);

          onAudioDataRef.current?.(avg, dataArray);

          // Automated Speech Activity & Silence Detection (VAD)
          if (avg > energyThreshold) {
            consecutiveSpeechFramesRef.current += 1;
            // Require ~60ms (3 frames) of speech energy to confirm human voice
            if (consecutiveSpeechFramesRef.current >= 3) {
              if (!speechDetectedRef.current) {
                speechDetectedRef.current = true;
                speechStartTimeRef.current = Date.now();
              }
            }
            if (silenceTimerRef.current) {
              window.clearTimeout(silenceTimerRef.current);
              silenceTimerRef.current = null;
            }

            // Failsafe safety cap: If user or background has been active for maxRecordingDurationMs, finalize!
            if (
              speechDetectedRef.current &&
              speechStartTimeRef.current &&
              Date.now() - speechStartTimeRef.current > maxRecordingDurationMs
            ) {
              speechDetectedRef.current = false;
              speechStartTimeRef.current = 0;
              onSilenceDetectedRef.current?.();
              return;
            }
          } else {
            consecutiveSpeechFramesRef.current = 0;
            // When user stops speaking, start silence countdown
            if (speechDetectedRef.current && !silenceTimerRef.current) {
              silenceTimerRef.current = window.setTimeout(() => {
                if (speechDetectedRef.current) {
                  speechDetectedRef.current = false;
                  speechStartTimeRef.current = 0;
                  if (silenceTimerRef.current) {
                    window.clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                  }
                  onSilenceDetectedRef.current?.();
                }
              }, silenceThresholdMs);
            }
          }

          animFrameRef.current = requestAnimationFrame(tick);
        };

        animFrameRef.current = requestAnimationFrame(tick);
      } catch (err) {
        console.warn('Web Audio Analyser not available', err);
      }
    },
    [energyThreshold, silenceThresholdMs, maxRecordingDurationMs]
  );

  const startRecording = useCallback(async (): Promise<boolean> => {
    chunksRef.current = [];
    cleanupAudioNodes();
    releaseStream();
    speechDetectedRef.current = false;
    speechStartTimeRef.current = 0;
    consecutiveSpeechFramesRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      setMicPermission('granted');

      startMonitoring(stream);

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
          mimeType = 'audio/ogg';
        } else {
          mimeType = '';
        }
      }

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.start(200); // 200ms slice
      setIsRecording(true);
      return true;
    } catch (err) {
      console.error('Microphone permission / access error:', err);
      setMicPermission('denied');
      setIsRecording(false);
      return false;
    }
  }, [cleanupAudioNodes, releaseStream, startMonitoring]);

  const stopRecording = useCallback(async (): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        cleanupAudioNodes();
        releaseStream();
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const mimeType = recorder.mimeType || 'audio/webm';
        const finalBlob = new Blob(chunksRef.current, { type: mimeType });
        cleanupAudioNodes();
        releaseStream();
        setIsRecording(false);
        resolve(finalBlob.size > 0 ? finalBlob : null);
      };

      try {
        recorder.stop();
      } catch (err) {
        cleanupAudioNodes();
        releaseStream();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, [cleanupAudioNodes, releaseStream]);

  useEffect(() => {
    return () => {
      cleanupAudioNodes();
      releaseStream();
    };
  }, [cleanupAudioNodes, releaseStream]);

  return {
    isRecording,
    micPermission,
    volumeLevel,
    startRecording,
    stopRecording,
    analyser: analyserRef.current,
  };
}
