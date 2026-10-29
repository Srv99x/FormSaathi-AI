import React, { useCallback, useEffect, useRef, useState } from "react";
import { Locale, S4, t } from "../data/uiCopy";

export interface AudioRecorderProps {
  locale: Locale;
  maxDurationSeconds?: number;
  onRecordingComplete?: (
    audioBlob: Blob,
    filename: string,
    durationSeconds: number
  ) => void;
  onSkipToManual?: () => void;
}

type RecorderStatus =
  | "idle"
  | "requesting"
  | "recording"
  | "recorded"
  | "permission_denied"
  | "device_not_found"
  | "unsupported"
  | "error";

interface SupportedFormat {
  mimeType: string;
  extension: string;
}

const MIME_CANDIDATES: SupportedFormat[] = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  { mimeType: "audio/ogg", extension: "ogg" },
  { mimeType: "audio/mp4", extension: "mp4" },
  { mimeType: "audio/wav", extension: "wav" },
];

function detectBestMimeType(): SupportedFormat {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "audio/webm", extension: "webm" };
  }

  for (const candidate of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(candidate.mimeType)) {
      return candidate;
    }
  }

  return { mimeType: "", extension: "webm" };
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  locale,
  maxDurationSeconds = 25,
  onRecordingComplete,
  onSkipToManual,
}) => {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [formatInfo, setFormatInfo] = useState<SupportedFormat>({
    mimeType: "audio/webm",
    extension: "webm",
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const audioUrlRef = useRef<string | null>(null);

  // Stop and release media stream tracks safely
  const releaseStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore already stopped tracks
        }
      });
      streamRef.current = null;
    }
  }, []);

  // Clear timer
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Cleanup strictly on component unmount
  useEffect(() => {
    return () => {
      clearTimer();
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state === "recording"
      ) {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      releaseStream();
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [clearTimer, releaseStream]);

  // Handle explicit Stop request
  // Note: We do NOT call releaseStream() here synchronously. We signal the MediaRecorder
  // to stop, allowing it to flush all recorded audio buffers. releaseStream() is then
  // cleanly executed inside recorder.onstop.
  const stopRecording = useCallback(() => {
    clearTimer();
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, [clearTimer]);

  // Start recording triggered by user click
  const startRecording = async () => {
    setErrorMessage(null);

    // 1. Check secure context (getUserMedia requires HTTPS or localhost)
    if (
      typeof window !== "undefined" &&
      window.isSecureContext === false &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setStatus("unsupported");
      setErrorMessage(
        locale === "en-IN"
          ? "Microphone access requires a secure connection (HTTPS or localhost)."
          : "माइक्रोफ़ोन एक्सेस के लिए सुरक्षित कनेक्शन (HTTPS या localhost) आवश्यक है।"
      );
      return;
    }

    // 2. Check API availability
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setStatus("unsupported");
      setErrorMessage(
        locale === "en-IN"
          ? "Voice recording is not supported in this browser. Please enter details manually."
          : "इस ब्राउज़र में आवाज़ रिकॉर्डिंग समर्थित नहीं है। कृपया मैन्युअली जानकारी दर्ज करें।"
      );
      return;
    }

    setStatus("requesting");

    try {
      // 3. Request actual microphone permission using standard audio: true.
      // We avoid restrictive constraints (such as forced channelCount: 1 or aggressive
      // manual noise suppression) which can cause destructive phase cancellation on
      // laptop dual-microphone arrays and result in silent recordings.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      streamRef.current = stream;

      // 4. Determine supported MIME type
      const bestFormat = detectBestMimeType();
      setFormatInfo(bestFormat);

      const options: MediaRecorderOptions = bestFormat.mimeType
        ? { mimeType: bestFormat.mimeType }
        : {};

      const recorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        clearTimer();
        releaseStream();
        setStatus("error");
        setErrorMessage(t(S4.errorGeneric, locale));
      };

      recorder.onstop = () => {
        clearTimer();
        // Release stream tracks now that all audio chunks have been flushed
        releaseStream();

        const duration = Math.min(
          maxDurationSeconds,
          Math.max(1, Math.round((Date.now() - startTimeRef.current) / 1000))
        );

        // Prefer actual MIME type from MediaRecorder when available
        const actualMime =
          recorder.mimeType ||
          mediaRecorderRef.current?.mimeType ||
          bestFormat.mimeType ||
          "audio/webm";

        const finalBlob = new Blob(chunksRef.current, { type: actualMime });

        if (finalBlob.size === 0 || duration < 1) {
          setStatus("error");
          setErrorMessage(t(S4.errorTooShort, locale));
          return;
        }

        // Clean up any previously created object URL before creating a new one
        if (audioUrlRef.current) {
          URL.revokeObjectURL(audioUrlRef.current);
        }

        const url = URL.createObjectURL(finalBlob);
        audioUrlRef.current = url;
        setAudioUrl(url);
        setAudioBlob(finalBlob);
        setElapsedSeconds(duration);
        setStatus("recorded");
      };

      // 5. Start MediaRecorder
      recorder.start(250); // collect chunks every 250ms
      startTimeRef.current = Date.now();
      setElapsedSeconds(0);
      setStatus("recording");

      // 6. Elapsed timer (updates every second)
      timerRef.current = window.setInterval(() => {
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsedSeconds(elapsed);

        // Automatic stop at max duration (25 seconds)
        if (elapsed >= maxDurationSeconds) {
          stopRecording();
        }
      }, 500);
    } catch (err: unknown) {
      releaseStream();
      clearTimer();

      if (err instanceof DOMException) {
        if (
          err.name === "NotAllowedError" ||
          err.name === "PermissionDeniedError"
        ) {
          setStatus("permission_denied");
          setErrorMessage(t(S4.errorPermissionDenied, locale));
          return;
        }
        if (
          err.name === "NotFoundError" ||
          err.name === "DevicesNotFoundError"
        ) {
          setStatus("device_not_found");
          setErrorMessage(
            locale === "en-IN"
              ? "No microphone was found on your device. Please plug in a microphone or type your details manually."
              : "आपके डिवाइस पर कोई माइक्रोफ़ोन नहीं मिला। कृपया माइक्रोफ़ोन कनेक्ट करें या मैन्युअली जानकारी दर्ज करें।"
          );
          return;
        }
        if (err.name === "NotSupportedError") {
          setStatus("unsupported");
          setErrorMessage(t(S4.errorUnsupportedCodec, locale));
          return;
        }
      }

      setStatus("error");
      setErrorMessage(t(S4.errorGeneric, locale));
    }
  };

  // Discard recording and return to idle
  const handleDiscardAndRetry = () => {
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setAudioUrl(null);
    setAudioBlob(null);
    setElapsedSeconds(0);
    setErrorMessage(null);
    setStatus("idle");
  };

  // Pass confirmed recording to parent
  const handleProceedWithAudio = () => {
    if (audioBlob && onRecordingComplete) {
      const filename = `recording_${Date.now()}.${formatInfo.extension}`;
      onRecordingComplete(audioBlob, filename, elapsedSeconds);
    }
  };

  // Progress percentage for 25s visual meter
  const progressPercent = Math.min(
    100,
    Math.round((elapsedSeconds / maxDurationSeconds) * 100)
  );

  return (
    <div className="audio-recorder-container" aria-live="polite">
      {/* ------------------------------------------------------------- */}
      {/* State: IDLE                                                   */}
      {/* ------------------------------------------------------------- */}
      {status === "idle" && (
        <div className="recorder-idle-state">
          <p className="recorder-state-desc">{t(S4.stateIdle, locale)}</p>

          <button
            type="button"
            className="btn btn-mic-record"
            onClick={startRecording}
            aria-label={t(S4.ctaStartRecording, locale)}
          >
            <span className="mic-icon" aria-hidden="true">
              🎙️
            </span>
            <span>{t(S4.ctaStartRecording, locale)}</span>
          </button>

          <p className="recorder-limit-note">
            {locale === "en-IN"
              ? `Maximum recording time: ${maxDurationSeconds} seconds.`
              : `अधिकतम रिकॉर्डिंग समय: ${maxDurationSeconds} सेकंड।`}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* State: REQUESTING PERMISSION                                  */}
      {/* ------------------------------------------------------------- */}
      {status === "requesting" && (
        <div className="recorder-requesting-state">
          <div className="loading-spinner" aria-hidden="true" />
          <p className="recorder-state-desc">
            {locale === "en-IN"
              ? "Requesting microphone permission…"
              : "माइक्रोफ़ोन अनुमति का अनुरोध किया जा रहा है…"}
          </p>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* State: RECORDING ACTIVE                                       */}
      {/* ------------------------------------------------------------- */}
      {status === "recording" && (
        <div className="recorder-recording-state">
          <div className="recording-badge-row">
            <span className="recording-pulse-dot" aria-hidden="true" />
            <span className="recording-label">
              {locale === "en-IN" ? "RECORDING" : "रिकॉर्डिंग जारी"}
            </span>
          </div>

          {/* Accessible Elapsed Timer */}
          <div
            className="recorder-timer"
            role="timer"
            aria-label={t(S4.timerAriaLabel, locale)}
          >
            00:{elapsedSeconds.toString().padStart(2, "0")} / 00:
            {maxDurationSeconds.toString().padStart(2, "0")}
          </div>

          {/* Visual Progress Bar */}
          <div
            className="recorder-progress-bar"
            role="progressbar"
            aria-valuenow={elapsedSeconds}
            aria-valuemin={0}
            aria-valuemax={maxDurationSeconds}
          >
            <div
              className="recorder-progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <p className="recorder-listening-hint">
            {t(S4.stateListening, locale)}
          </p>

          <div className="recorder-actions">
            <button
              type="button"
              className="btn btn-danger"
              onClick={stopRecording}
              aria-label={t(S4.ctaStopRecording, locale)}
            >
              <span className="stop-icon" aria-hidden="true">
                ⏹
              </span>
              <span>{t(S4.ctaStopRecording, locale)}</span>
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* State: RECORDED (Review & Playback)                           */}
      {/* ------------------------------------------------------------- */}
      {status === "recorded" && audioUrl && (
        <div className="recorder-recorded-state">
          <div className="recorded-header">
            <span className="recorded-success-icon" aria-hidden="true">
              ✓
            </span>
            <div className="recorded-title-wrap">
              <span className="recorded-title">
                {locale === "en-IN"
                  ? "Recording Ready"
                  : "रिकॉर्डिंग तैयार है"}
              </span>
              <span className="recorded-meta">
                {elapsedSeconds}s • {audioBlob ? `${Math.round(audioBlob.size / 1024)} KB` : ""}{" "}
                • {formatInfo.extension}
              </span>
            </div>
          </div>

          {/* Accessible HTML5 Audio Player */}
          <div className="audio-player-wrapper">
            <audio
              controls
              preload="auto"
              src={audioUrl}
              className="audio-player"
              onPlay={(e) => {
                e.currentTarget.muted = false;
                if (e.currentTarget.volume === 0) {
                  e.currentTarget.volume = 1.0;
                }
              }}
              aria-label={
                locale === "en-IN"
                  ? "Play your voice recording"
                  : "अपनी आवाज़ रिकॉर्डिंग सुनें"
              }
            >
              Your browser does not support audio playback.
            </audio>
          </div>

          <div className="recorder-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleProceedWithAudio}
              aria-label={
                locale === "en-IN"
                  ? "Approve recording and continue to transcript"
                  : "रिकॉर्डिंग स्वीकृत करें और ट्रांसक्रिप्ट पर जाएं"
              }
            >
              {locale === "en-IN"
                ? "Accept & Continue →"
                : "स्वीकार करें और आगे बढ़ें →"}
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDiscardAndRetry}
              aria-label={t(S4.ctaRetryRecording, locale)}
            >
              🔄 {t(S4.ctaRetryRecording, locale)}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Error States: Permission Denied, Missing Device, Failure       */}
      {/* ------------------------------------------------------------- */}
      {(status === "permission_denied" ||
        status === "device_not_found" ||
        status === "unsupported" ||
        status === "error") && (
        <div className="recorder-error-state" role="alert">
          <div className="notice-error">
            <div className="error-title-row">
              <span className="error-icon" aria-hidden="true">
                ⚠️
              </span>
              <strong>
                {status === "permission_denied" &&
                  (locale === "en-IN"
                    ? "Microphone Access Denied"
                    : "माइक्रोफ़ोन अनुमति अस्वीकृत")}
                {status === "device_not_found" &&
                  (locale === "en-IN"
                    ? "Microphone Not Found"
                    : "माइक्रोफ़ोन नहीं मिला")}
                {status === "unsupported" &&
                  (locale === "en-IN"
                    ? "Recording Unsupported"
                    : "रिकॉर्डिंग असमर्थित")}
                {status === "error" &&
                  (locale === "en-IN" ? "Recording Error" : "रिकॉर्डिंग त्रुटि")}
              </strong>
            </div>

            <p style={{ marginTop: 6 }}>{errorMessage}</p>

            {status === "permission_denied" && (
              <p
                style={{
                  marginTop: 6,
                  fontSize: "0.8125rem",
                  color: "var(--color-error-text)",
                }}
              >
                {locale === "en-IN"
                  ? "Tip: Click the camera/microphone icon in your browser address bar to allow microphone access, then try again."
                  : "सुझाव: माइक्रोफ़ोन अनुमति देने के लिए अपने ब्राउज़र के एड्रेस बार में कैमरा/माइक्रोफ़ोन आइकन पर क्लिक करें, फिर पुनः प्रयास करें।"}
              </p>
            )}
          </div>

          <div className="recorder-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleDiscardAndRetry}
              aria-label={t(S4.ctaRetryRecording, locale)}
            >
              🔄 {t(S4.ctaRetryRecording, locale)}
            </button>

            {onSkipToManual && (
              <button
                type="button"
                className="btn btn-outline"
                onClick={onSkipToManual}
                aria-label={t(S4.ctaSkipToManual, locale)}
              >
                ✏️ {t(S4.ctaSkipToManual, locale)}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Fallback link to manual entry (available across states) */}
      {status === "idle" && onSkipToManual && (
        <div className="skip-manual-container">
          <button
            type="button"
            className="btn-text-link"
            onClick={onSkipToManual}
            aria-label={t(S4.ctaSkipToManual, locale)}
          >
            {t(S4.ctaSkipToManual, locale)} →
          </button>
        </div>
      )}
    </div>
  );
};

export default AudioRecorder;
