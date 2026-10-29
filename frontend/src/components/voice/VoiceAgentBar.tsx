import React, { useState, useEffect } from 'react';
import { PhoneOff, Hand, Check, Mic, ChevronDown, Sparkles, X } from 'lucide-react';
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
  // When a call becomes active, ensure it is expanded by default
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

  const orbColor =
    orbState === 'listening'
      ? '#10b981'
      : orbState === 'thinking'
      ? '#9333ea'
      : orbState === 'speaking'
      ? '#2563eb'
      : '#64748b';

  // 1. Idle state OR Minimized state -> Small icon floating on the bottom right
  if (!isCallActive || !isExpanded) {
    return (
      <aside className="fs-voice-fab-wrap" aria-label="Voice Assistant Floating Action Button">
        {/* Subtle hover tooltip/pill on the left of the button */}
        <div className="fs-voice-fab-tooltip">
          <span className="fs-voice-fab-tooltip-title">
            {isCallActive
              ? (isHindi ? 'कॉल जारी है' : 'Call Active')
              : (isHindi ? 'बोलकर फॉर्म भरें' : 'Fill Form with Voice')}
          </span>
          <span className="fs-voice-fab-tooltip-sub">
            {isCallActive
              ? (isHindi ? 'टैप करके देखें' : 'Click to open assistant')
              : (isHindi ? 'आवाज़ सहायक शुरू करें' : 'Click to start voice agent')}
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
          {/* Animated circular wave ring around the button */}
          <span className="fs-fab-ripple fs-fab-ripple-1" />
          <span className="fs-fab-ripple fs-fab-ripple-2" />

          {isCallActive ? (
            <div className="fs-fab-mini-orb-container">
              <VoiceOrb state={orbState} size={38} volumeLevel={volumeLevel} />
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

  // 2. Expanded Voice Agent Dialog Card (Floating Bottom-Right)
  return (
    <aside
      className="fs-voice-widget-card"
      role="dialog"
      aria-label="Active Voice Assistant Call"
    >
      {/* Top Header */}
      <div className="fs-widget-header">
        <div className="fs-widget-header-left">
          <span className="fs-widget-live-dot" style={{ backgroundColor: orbColor }} />
          <div className="fs-widget-titles">
            <span className="fs-widget-title">
              {isHindi ? 'आवाज़ सहायक' : 'Voice Assistant'}
            </span>
            <span className="fs-widget-timer">{formatTimer(callDurationSeconds)}</span>
          </div>
        </div>

        <div className="fs-widget-header-actions">
          {/* Minimize button to collapse into small right-side icon */}
          <button
            type="button"
            className="fs-widget-icon-btn"
            onClick={() => setIsExpanded(false)}
            title={isHindi ? 'छोटा करें' : 'Minimize to floating icon'}
            aria-label="Minimize Voice Assistant"
          >
            <ChevronDown size={18} />
          </button>

          {/* End Call button */}
          <button
            type="button"
            className="fs-widget-icon-btn fs-widget-btn-close"
            onClick={onEndCall}
            title={isHindi ? 'कॉल समाप्त' : 'End Call'}
            aria-label="End call"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Main Center: Circular Wave Voice Agent */}
      <div className="fs-widget-body">
        <div className="fs-widget-orb-stage">
          <VoiceOrb state={orbState} size={88} volumeLevel={volumeLevel} />
        </div>

        {/* Audio Visualizer beneath the orb */}
        <div className="fs-widget-viz-wrap">
          <AudioVisualizer
            volume={volumeLevel}
            isActive={orbState === 'listening' || orbState === 'speaking'}
            color={orbColor}
            barsCount={10}
          />
        </div>

        {/* State Pill */}
        <div className="fs-widget-status-badge" style={{ color: orbColor }}>
          <span className="fs-state-dot" style={{ backgroundColor: orbColor }} />
          <span className="fs-status-label">
            {orbState === 'listening' &&
              (volumeLevel > 14
                ? (isHindi ? 'आपकी बात सुन रहा हूँ...' : 'Hearing you speak...')
                : (isHindi ? 'सुन रहा हूँ... बोलिए' : 'Listening... speak now'))}
            {orbState === 'thinking' && (isHindi ? 'समझ रहा हूँ...' : 'Processing your response...')}
            {orbState === 'speaking' && (isHindi ? 'बोल रहा हूँ...' : 'Speaking...')}
            {orbState === 'idle' && (isHindi ? 'तैयार' : 'Ready')}
          </span>

          {lastAutoFilledCount > 0 && (
            <span className="fs-autofill-badge">
              ✓ {lastAutoFilledCount} {isHindi ? 'फ़ील्ड भरे गए' : 'fields populated'}
            </span>
          )}
        </div>

        {/* Dialogue / Speech Bubble */}
        <div className="fs-widget-dialogue-box">
          <div className="fs-widget-assistant-msg" aria-live="polite">
            <span className="fs-dialogue-sender">
              {isHindi ? 'सहायक: ' : 'Assistant: '}
            </span>
            {assistantMessage ||
              (isHindi
                ? 'नमस्ते! कृपया अपनी जानकारी बताएं...'
                : "Hello! I'm listening. Please speak your details...")}
          </div>

          {userTranscript && orbState !== 'speaking' && (
            <div className="fs-widget-user-msg">
              <span className="fs-user-label">{isHindi ? 'आपने कहा: ' : 'You: '}</span>
              <span className="fs-user-text">"{userTranscript}"</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer Controls */}
      <div className="fs-widget-footer">
        {/* Barge-in interrupt button when assistant is speaking */}
        {orbState === 'speaking' && (
          <button
            type="button"
            className="fs-control-btn fs-btn-interrupt fs-widget-action-btn"
            onClick={onInterrupt}
            title="Interrupt Assistant (Barge-in)"
            aria-label="Tap to interrupt assistant"
          >
            <Hand size={16} />
            <span>{isHindi ? 'रोकें व बोलें' : 'Tap to Interrupt'}</span>
          </button>
        )}

        {/* Automated VAD active: pauses automatically submit, or user can tap */}
        {orbState === 'listening' && (
          <button
            type="button"
            className="fs-control-btn fs-btn-done fs-widget-action-btn"
            onClick={onDoneSpeaking}
            title="Auto-detects when you finish speaking, or tap to send immediately"
            aria-label="Done speaking"
          >
            <Check size={16} />
            <span>{isHindi ? 'रुकें या टैप करें' : 'Done (or just pause)'}</span>
          </button>
        )}

        {/* End Call Button */}
        <button
          type="button"
          className="fs-control-btn fs-btn-end fs-widget-end-btn"
          onClick={onEndCall}
          title="End Voice Call"
          aria-label="End call"
        >
          <PhoneOff size={16} />
          <span>{isHindi ? 'कॉल समाप्त' : 'End Call'}</span>
        </button>
      </div>
    </aside>
  );
};
