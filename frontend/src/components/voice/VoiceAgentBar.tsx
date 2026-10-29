import React, { useState, useEffect } from 'react';
import { PhoneOff, Pause, Play, ChevronDown, Sparkles, X, Mic } from 'lucide-react';
import { OrbState } from '../../types/voice';
import { AudioVisualizer } from './AudioVisualizer';
import { VoiceOrb } from './VoiceOrb';

export interface VoiceAgentBarProps {
  isCallActive: boolean;
  isPaused?: boolean;
  orbState: OrbState;
  callDurationSeconds: number;
  volumeLevel: number;
  locale?: 'en-IN' | 'hi-IN';
  lastAutoFilledCount?: number;
  onStartCall: () => void;
  onEndCall: () => void;
  onTogglePause?: () => void;
  onInterrupt?: () => void;
}

export const VoiceAgentBar: React.FC<VoiceAgentBarProps> = ({
  isCallActive,
  isPaused = false,
  orbState,
  callDurationSeconds,
  volumeLevel,
  locale = 'en-IN',
  lastAutoFilledCount = 0,
  onStartCall,
  onEndCall,
  onTogglePause,
  onInterrupt,
}) => {
  // When call starts, expand automatically
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    if (isCallActive) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isCallActive]);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const isHindi = locale === 'hi-IN';

  // Luxurious color palette: Champagne Gold for Speaking, Emerald for Listening, Amethyst for Thinking
  const orbColor =
    orbState === 'listening'
      ? '#10b981'
      : orbState === 'thinking'
      ? '#c084fc'
      : orbState === 'speaking'
      ? '#d4af37'
      : '#94a3b8';

  // 1. Idle state OR Minimized state -> Sleek floating FAB on bottom-right
  if (!isCallActive || !isExpanded) {
    return (
      <aside className="fs-voice-fab-wrap" aria-label="Voice Assistant Floating Action Button">
        {/* Subtle hover tooltip on the left of the button */}
        <div className="fs-voice-fab-tooltip">
          <span className="fs-voice-fab-tooltip-title">
            {isCallActive
              ? (isHindi ? 'आवाज़ सहायक सक्रिय है' : 'Voice Assistant Active')
              : (isHindi ? 'बोलकर फॉर्म भरें' : 'Fill Form with Voice')}
          </span>
          <span className="fs-voice-fab-tooltip-sub">
            {isCallActive
              ? (isHindi ? 'टैप करके देखें' : 'Click to expand')
              : (isHindi ? 'आवाज़ सहायक शुरू करें' : 'Click to start')}
          </span>
        </div>

        <button
          type="button"
          className={`fs-voice-fab-btn ${isCallActive ? `fs-fab-active fs-fab-${orbState}` : 'fs-fab-idle'}`}
          onClick={() => {
            if (!isCallActive) {
              onStartCall();
              setIsExpanded(true);
            } else {
              setIsExpanded(true);
            }
          }}
          title={isHindi ? 'आवाज़ सहायक' : 'Voice Assistant'}
          aria-label={
            isCallActive
              ? 'Expand Voice Assistant'
              : 'Start Hands-Free Voice Assistant'
          }
        >
          {/* Animated circular wave ring */}
          <span className="fs-fab-ripple fs-fab-ripple-1" />
          <span className="fs-fab-ripple fs-fab-ripple-2" />

          {isCallActive ? (
            <div className="fs-fab-mini-orb-container">
              <VoiceOrb state={orbState} size={42} volumeLevel={volumeLevel} />
              <span className="fs-fab-live-dot" style={{ backgroundColor: orbColor }} />
            </div>
          ) : (
            <div className="fs-fab-icon-inner">
              <Mic size={24} className="fs-fab-mic-icon" />
              <Sparkles size={14} className="fs-fab-sparkle" />
            </div>
          )}
        </button>
      </aside>
    );
  }

  // 2. Expanded Voice Agent Luxury Card (Floating Bottom-Right)
  return (
    <aside
      className="fs-voice-widget-card fs-luxury-card"
      role="dialog"
      aria-label="Active Voice Assistant Call"
    >
      {/* Top Header: Title, Timer, Minimize & End */}
      <div className="fs-widget-header">
        <div className="fs-widget-header-left">
          <span className="fs-widget-live-dot" style={{ backgroundColor: orbColor }} />
          <div className="fs-widget-titles">
            <span className="fs-widget-title">FormSaathi AI</span>
            <span className="fs-widget-timer">{formatTimer(callDurationSeconds)}</span>
          </div>
        </div>

        <div className="fs-widget-header-actions">
          {/* Minimize button (keeps audio/call active in background) */}
          <button
            type="button"
            className="fs-widget-icon-btn fs-btn-minimize"
            onClick={() => setIsExpanded(false)}
            title={isHindi ? 'छोटा करें' : 'Minimize (keeps call active)'}
            aria-label="Minimize Voice Assistant"
          >
            <ChevronDown size={18} />
          </button>

          {/* Close button (stops and completely resets call) */}
          <button
            type="button"
            className="fs-widget-icon-btn fs-widget-btn-close"
            onClick={onEndCall}
            title={isHindi ? 'बंद करें और रीसेट करें' : 'Close and stop assistant'}
            aria-label="Close and stop assistant"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Center Stage: Large Elegant Voice Orb */}
      <div className="fs-widget-body">
        <div className="fs-widget-orb-stage">
          <VoiceOrb state={isPaused ? 'idle' : orbState} size={124} volumeLevel={volumeLevel} />
        </div>

        {/* Dynamic Frequency Waveform beneath orb */}
        <div className="fs-widget-viz-wrap">
          <AudioVisualizer
            volume={isPaused ? 0 : volumeLevel}
            isActive={!isPaused && (orbState === 'listening' || orbState === 'speaking')}
            color={orbColor}
            barsCount={12}
          />
        </div>

        {/* State Status Pill */}
        <div className="fs-widget-status-badge" style={{ color: orbColor }}>
          <span className="fs-state-dot" style={{ backgroundColor: orbColor }} />
          <span className="fs-status-label">
            {isPaused && (isHindi ? 'कॉल रुकी हुई है' : 'Assistant Paused')}
            {!isPaused && orbState === 'listening' &&
              (volumeLevel > 14
                ? (isHindi ? 'सुन रहा हूँ...' : 'Listening...')
                : (isHindi ? 'सुन रहा हूँ... बोलिए' : 'Listening... speak now'))}
            {!isPaused && orbState === 'thinking' && (isHindi ? 'समझ रहा हूँ...' : 'Processing...')}
            {!isPaused && orbState === 'speaking' && (isHindi ? 'सहायक बोल रहा है...' : 'Assistant Speaking...')}
            {!isPaused && orbState === 'idle' && (isHindi ? 'तैयार' : 'Ready')}
          </span>

          {lastAutoFilledCount > 0 && (
            <span className="fs-autofill-badge">
              ✓ {lastAutoFilledCount} {isHindi ? 'फ़ील्ड भरे' : 'auto-filled'}
            </span>
          )}
        </div>
      </div>

      {/* Footer Controls: Sleek Circular Action Buttons */}
      <div className="fs-widget-footer fs-luxury-footer">
        {/* Tap to Interrupt (when speaking) */}
        {!isPaused && orbState === 'speaking' && onInterrupt && (
          <button
            type="button"
            className="fs-luxury-pill-btn fs-btn-tap-interrupt"
            onClick={onInterrupt}
            title={isHindi ? 'टैप करके रोकें' : 'Tap to interrupt and speak'}
          >
            <span>{isHindi ? 'रोकें व बोलें' : 'Tap to Speak'}</span>
          </button>
        )}

        <div className="fs-circular-controls-row">
          {/* Circular Pause / Resume Button */}
          {onTogglePause && (
            <button
              type="button"
              className={`fs-circle-btn fs-circle-pause ${isPaused ? 'fs-circle-paused' : ''}`}
              onClick={onTogglePause}
              title={isPaused ? (isHindi ? 'शुरू करें' : 'Resume Assistant') : (isHindi ? 'रोकें' : 'Pause Assistant')}
              aria-label={isPaused ? 'Resume Assistant' : 'Pause Assistant'}
            >
              {isPaused ? <Play size={20} /> : <Pause size={20} />}
            </button>
          )}

          {/* Circular End Call Button */}
          <button
            type="button"
            className="fs-circle-btn fs-circle-end"
            onClick={onEndCall}
            title={isHindi ? 'कॉल समाप्त करें' : 'End Call & Reset'}
            aria-label="End Call and Reset"
          >
            <PhoneOff size={20} />
          </button>
        </div>
      </div>
    </aside>
  );
};
