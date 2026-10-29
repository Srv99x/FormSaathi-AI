import React from 'react';
import { OrbState } from '../../types/voice';

export interface VoiceOrbProps {
  state: OrbState;
  size?: number;
  volumeLevel?: number;
}

export const VoiceOrb: React.FC<VoiceOrbProps> = ({
  state,
  size = 64,
  volumeLevel = 0,
}) => {
  // Dynamic scale influenced by audio energy during listening/speaking
  const dynamicScale = Math.min(1.35, 1 + volumeLevel / 120);

  return (
    <div
      className={`fs-voice-orb fs-orb-${state}`}
      style={{
        width: size,
        height: size,
        transform: state === 'listening' ? `scale(${dynamicScale})` : undefined,
      }}
      aria-label={`Voice Assistant Status: ${state}`}
    >
      {/* Outer ambient glow ring */}
      <div className="fs-orb-glow" />

      {/* State-specific ripple rings */}
      {state === 'listening' && (
        <>
          <div className="fs-orb-ring fs-ring-green-1" />
          <div className="fs-orb-ring fs-ring-green-2" />
        </>
      )}

      {state === 'thinking' && (
        <>
          <div className="fs-orb-ring fs-ring-purple-1" />
          <div className="fs-orb-ring fs-ring-purple-2" />
        </>
      )}

      {state === 'speaking' && (
        <>
          <div className="fs-orb-ring fs-ring-blue-1" />
          <div className="fs-orb-ring fs-ring-blue-2" />
        </>
      )}

      {/* SVG Core Orb */}
      <svg
        viewBox="0 0 100 100"
        className="fs-orb-svg"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Gradients for each state */}
          <radialGradient id="grad-idle" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="100%" stopColor="#475569" />
          </radialGradient>

          <radialGradient id="grad-listening" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="60%" stopColor="#10b981" />
            <stop offset="100%" stopColor="#059669" />
          </radialGradient>

          <radialGradient id="grad-thinking" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="60%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#6b21a8" />
          </radialGradient>

          <radialGradient id="grad-speaking" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="60%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </radialGradient>
        </defs>

        {/* Base orb circle */}
        <circle
          cx="50"
          cy="50"
          r="40"
          fill={
            state === 'listening'
              ? 'url(#grad-listening)'
              : state === 'thinking'
              ? 'url(#grad-thinking)'
              : state === 'speaking'
              ? 'url(#grad-speaking)'
              : 'url(#grad-idle)'
          }
          className="fs-orb-core-circle"
        />

        {/* Center icon / shape */}
        {state === 'idle' && (
          <path
            d="M50 32a6 6 0 0 0-6 6v12a6 6 0 0 0 12 0V38a6 6 0 0 0-6-6zm12 12a1 1 0 0 1 2 0 14 14 0 0 1-13 13.9V63h4a1 1 0 1 1 0 2H45a1 1 0 1 1 0-2h4v-5.1A14 14 0 0 1 36 44a1 1 0 1 1 2 0 12 12 0 0 0 24 0z"
            fill="#ffffff"
            opacity="0.9"
          />
        )}

        {state === 'listening' && (
          <g fill="#ffffff" opacity="0.95">
            <circle cx="50" cy="50" r="10" />
            <circle cx="36" cy="50" r="4" opacity="0.75" />
            <circle cx="64" cy="50" r="4" opacity="0.75" />
          </g>
        )}

        {state === 'thinking' && (
          <g stroke="#ffffff" strokeWidth="4" strokeLinecap="round" fill="none">
            <line x1="36" y1="50" x2="64" y2="50" className="fs-anim-pulse-line" />
            <line x1="50" y1="36" x2="50" y2="64" className="fs-anim-pulse-line-delay" />
          </g>
        )}

        {state === 'speaking' && (
          <g fill="#ffffff">
            <rect x="36" y="44" width="4" height="12" rx="2" className="fs-wave-bar bar-1" />
            <rect x="44" y="38" width="4" height="24" rx="2" className="fs-wave-bar bar-2" />
            <rect x="52" y="34" width="4" height="32" rx="2" className="fs-wave-bar bar-3" />
            <rect x="60" y="44" width="4" height="12" rx="2" className="fs-wave-bar bar-4" />
          </g>
        )}
      </svg>
    </div>
  );
};

