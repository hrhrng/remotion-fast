import React from 'react';

interface PlayheadProps {
  currentFrame: number;
  pixelsPerFrame: number;
  onMouseDown: (e: React.MouseEvent) => void;
  rulerHeight: number;
  trackAreaHeight: number;
}

export const Playhead: React.FC<PlayheadProps> = ({
  currentFrame,
  pixelsPerFrame,
  onMouseDown,
  rulerHeight,
  trackAreaHeight,
}) => {
  if (currentFrame < 0) return null;

  const position = currentFrame * pixelsPerFrame;

  return (
    <div
      style={{
        position: 'sticky',
        left: position,
        top: 0,
        width: 0,
        height: '100%',
        zIndex: 100,
        pointerEvents: 'none',
      }}
    >
      {/* Playhead Pin - Triangle at top */}
      <div
        onMouseDown={onMouseDown}
        style={{
          position: 'absolute',
          top: '14px',
          left: '-8px',
          width: 0,
          height: 0,
          borderLeft: '8px solid transparent',
          borderRight: '8px solid transparent',
          borderTop: '12px solid #0066ff',
          cursor: 'ew-resize',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))',
          zIndex: 100,
          pointerEvents: 'auto',
        }}
        title="Drag to scrub timeline"
      />

      {/* Playhead Line - extends down through tracks */}
      <div
        style={{
          position: 'absolute',
          top: `${rulerHeight}px`,
          left: 0,
          width: '2px',
          height: trackAreaHeight,
          backgroundColor: '#0066ff',
          pointerEvents: 'none',
          zIndex: 5,
          transform: 'translateX(-1px)', // Center the line
        }}
      />
    </div>
  );
};
