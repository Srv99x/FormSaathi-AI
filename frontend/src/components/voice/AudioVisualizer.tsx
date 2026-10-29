import React from 'react';

export interface AudioVisualizerProps {
  volume: number; // 0 to 100+
  isActive: boolean;
  color?: string;
  barsCount?: number;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  volume,
  isActive,
  color = '#1a73e8',
  barsCount = 8,
}) => {
  const bars = Array.from({ length: barsCount });

  return (
    <div className="fs-audio-visualizer" aria-hidden="true">
      {bars.map((_, i) => {
        // Pseudo-random wave variations centered on middle bars
        const distanceCenter = Math.abs(i - barsCount / 2);
        const factor = Math.max(0.2, 1 - distanceCenter / (barsCount / 2));
        const height = isActive
          ? Math.min(28, Math.max(4, (volume / 2.5) * factor + Math.random() * 4))
          : 4;

        return (
          <span
            key={i}
            className="fs-viz-bar"
            style={{
              height: `${height}px`,
              backgroundColor: color,
              transition: 'height 0.08s ease',
            }}
          />
        );
      })}
    </div>
  );
};

