import React from 'react';
import { PhoneCall, PhoneOff, Hand, Check, Mic } from 'lucide-react';
import { OrbState } from '../../types/voice';
import { AudioVisualizer } from './AudioVisualizer';
import { VoiceOrb } from './VoiceOrb';

export interface VoiceAgentBarProps {
  isCallActive: boolean;
  orbState: OrbState;
  assistantMessage: string;
  userTranscript?: string;
  callDurationSeconds: number;
  volumeLevel: number;
  locale?: 'en-IN' | 'hi-IN';
  lastAutoFilledCount?: number;
  onStartCall: () => void;
  onEndCall: () => void;
  onInterrupt: () => void;
  onDoneSpeaking: () => void;
}

export const VoiceAgentBar: React.FC<VoiceAgentBarProps> = ({
  isCallActive,
  orbState,
  assistantMessage,
  userTranscript,
  callDurationSeconds,
  volumeLevel,
  locale = 'en-IN',
  lastAutoFilledCount = 0,
  onStartCall,
  onEndCall,
  onInterrupt,
  onDoneSpeaking,
}) => {
  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isHindi = locale === 'hi-IN';

  if (!isCallActive) {
    return (
      <div className="fs-voice-bar-idle-wrap">
        <div className="fs-voice-bar-idle">
          <div className="fs-voice-bar-idle-info">
            <div className="fs-voice-bar-idle-icon">
              <Mic size={20} />
            </div>
            <div className="fs-voice-bar-idle-text">
              <strong>{isHindi ? 'हाथ खाली रख कर फॉर्म भरें' : 'Fill Form Hands-Free'}</strong>
              <span>
                {isHindi
                  ? 'हिन्दी या अंग्रेज़ी में बोलकर आसानी से फॉर्म पूरा करें'
                  : 'Start a natural voice call in English or Hindi'}
              </span>
            </div>
          </div>

          <button
            type="button"
            className="fs-start-call-btn"
            onClick={onStartCall}
            aria-label="Start Voice Call"
          >
            <PhoneCall size={18} />
            <span>{isHindi ? '📞 आवाज़ कॉल शुरू करें' : '📞 Start Voice Call'}</span>
          </button>
        </div>
      </div>
    );
  }

  const orbColor =
    orbState === 'listening'
      ? '#10b981'
      : orbState === 'thinking'
      ? '#9333ea'
      : orbState === 'speaking'
      ? '#2563eb'
      : '#64748b';

  return (
    <div className="fs-voice-bar-dock" role="region" aria-label="Active Voice Assistant Call">
      <div className="fs-voice-bar-inner">
        {/* Left: Animated Orb + Audio Visualizer */}
        <div className="fs-voice-bar-left">
          <VoiceOrb state={orbState} size={54} volumeLevel={volumeLevel} />
          <div className="fs-voice-bar-viz">
            <AudioVisualizer
              volume={volumeLevel}
              isActive={orbState === 'listening' || orbState === 'speaking'}
              color={orbColor}
            />
            <span className="fs-call-duration">{formatTimer(callDurationSeconds)}</span>
          </div>
        </div>

        {/* Center: Live Assistant subtitles and user speech */}
        <div className="fs-voice-bar-center">
          <div className="fs-voice-state-pill" style={{ color: orbColor }}>
            <span className="fs-state-dot" style={{ backgroundColor: orbColor }} />
            <span className="fs-state-text">
              {orbState === 'listening' && (isHindi ? 'सुन रहा हूँ... बोलिए' : "Listening... speak now")}
              {orbState === 'thinking' && (isHindi ? 'सोच रहा हूँ...' : 'Processing entity extraction...')}
              {orbState === 'speaking' && (isHindi ? 'बोल रहा हूँ...' : 'Speaking...')}
              {orbState === 'idle' && (isHindi ? 'निष्क्रिय' : 'Ready')}
            </span>

            {lastAutoFilledCount > 0 && (
              <span className="fs-autofill-badge">
                ✓ {lastAutoFilledCount} {isHindi ? 'फ़ील्ड भरे गए' : 'fields populated'}
              </span>
            )}
          </div>

          <div
            className="fs-voice-message"
            aria-live="polite"
            title={assistantMessage}
          >
            {assistantMessage ||
              (isHindi
                ? 'नमस्ते! कृपया अपनी जानकारी बताएं...'
                : "Hello! I'm listening. Please speak your details...")}
          </div>

          {userTranscript && orbState !== 'speaking' && (
            <div className="fs-user-transcript-preview">
              <span className="fs-transcript-label">{isHindi ? 'आपने कहा: ' : 'You said: '}</span>
              <span className="fs-transcript-text">"{userTranscript}"</span>
            </div>
          )}
        </div>

        {/* Right: Controls (Interrupt, Done Speaking, End Call) */}
        <div className="fs-voice-bar-right">
          {/* Barge-in interrupt button */}
          {orbState === 'speaking' && (
            <button
              type="button"
              className="fs-control-btn fs-btn-interrupt"
              onClick={onInterrupt}
              title="Interrupt Assistant (Barge-in)"
              aria-label="Tap to interrupt assistant"
            >
              <Hand size={16} />
              <span>{isHindi ? 'बोलने दें' : 'Tap to Interrupt'}</span>
            </button>
          )}

          {/* Done speaking button (manual push when done) */}
          {orbState === 'listening' && (
            <button
              type="button"
              className="fs-control-btn fs-btn-done"
              onClick={onDoneSpeaking}
              title="Done speaking, submit turn"
              aria-label="Done speaking"
            >
              <Check size={16} />
              <span>{isHindi ? 'बोल चुका' : 'Done Speaking'}</span>
            </button>
          )}

          {/* End Call Button */}
          <button
            type="button"
            className="fs-control-btn fs-btn-end"
            onClick={onEndCall}
            title="End Voice Call"
            aria-label="End call"
          >
            <PhoneOff size={16} />
            <span>{isHindi ? 'कॉल समाप्त' : 'End Call'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
