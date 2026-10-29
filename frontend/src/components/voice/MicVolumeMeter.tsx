import React from 'react';
import { Mic } from 'lucide-react';

export interface MicVolumeMeterProps {
  volume: number; // 0 to 100
  isListening: boolean;
}

export const MicVolumeMeter: React.FC<MicVolumeMeterProps> = ({ volume, isListening }) => {
  const percentage = Math.min(100, Math.round((volume / 80) * 100));

  return (
    <div className="fs-mic-meter" title={`Mic volume: ${percentage}%`}>
      <Mic
        size={14}
        className={`fs-mic-icon ${isListening && volume > 15 ? 'is-active' : ''}`}
      />
      <div className="fs-meter-track">
        <div
          className="fs-meter-fill"
          style={{
            width: isListening ? `${percentage}%` : '0%',
            backgroundColor: percentage > 75 ? '#d93025' : percentage > 35 ? '#1e8e3e' : '#1a73e8',
          }}
        />
      </div>
    </div>
  );
};

