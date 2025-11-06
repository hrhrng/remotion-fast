import React, { useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { colors, timeline, zIndex, shadows, animations } from './styles';
import { formatTime, frameToPixels } from './utils/timeFormatter';

interface TimelinePlayheadProps {
  currentFrame: number;
  pixelsPerFrame: number;
  fps: number;
  timelineHeight: number;
  onSeek: (frame: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  // Horizontal scroll sync from tracks viewport
  scrollLeft?: number;
}

export const TimelinePlayhead: React.FC<TimelinePlayheadProps> = ({
  currentFrame,
  pixelsPerFrame,
  fps,
  timelineHeight,
  onSeek,
  onDragStart,
  onDragEnd,
  scrollLeft = 0,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const position = frameToPixels(currentFrame, pixelsPerFrame);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      setIsDragging(true);
      onDragStart?.();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const timelineContainer = (e.target as HTMLElement).closest('[data-timeline-container]');
        if (!timelineContainer) return;

        const rect = timelineContainer.getBoundingClientRect();
        const x = moveEvent.clientX - rect.left - timeline.trackLabelWidth + scrollLeft;
        const frame = Math.max(0, Math.round(x / pixelsPerFrame));
        onSeek(frame);
      };

      const handleMouseUp = () => {
        setIsDragging(false);
        onDragEnd?.();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [pixelsPerFrame, onSeek, onDragStart, onDragEnd]
  );

  return (
    <div
      style={{
        position: 'absolute',
        // Align with tracks area: add label gutter and subtract scrollLeft
        // The playhead sits in the overlay layer, so we translate by
        // the fixed label gutter (left) and compensate for the tracks viewport scroll.
        left: timeline.trackLabelWidth + position - scrollLeft,
        top: 0,
        bottom: 0,
        width: timeline.playheadWidth,
        zIndex: zIndex.playhead,
        pointerEvents: 'none',
      }}
    >
      {/* 播放头线 */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: timeline.playheadWidth,
          backgroundColor: colors.accent.primary,
          boxShadow: isDragging ? '0 0 8px rgba(74, 158, 255, 0.6)' : 'none',
          transition: isDragging ? 'none' : 'box-shadow 0.2s ease',
        }}
      />

      {/* 顶部三角形拖拽手柄 */}
      <motion.div
        onMouseDown={handleMouseDown}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        animate={{
          scale: isDragging ? 1.3 : isHovered ? 1.2 : 1,
        }}
        transition={animations.springGentle}
        style={{
          position: 'absolute',
          left: -timeline.playheadTriangleSize / 2 + timeline.playheadWidth / 2,
          top: -1,
          width: 0,
          height: 0,
          borderLeft: `${timeline.playheadTriangleSize / 2}px solid transparent`,
          borderRight: `${timeline.playheadTriangleSize / 2}px solid transparent`,
          borderTop: `${timeline.playheadTriangleSize}px solid ${colors.accent.primary}`,
          cursor: 'ew-resize',
          pointerEvents: 'auto',
          filter: isDragging ? 'drop-shadow(0 0 4px rgba(74, 158, 255, 0.8))' : 'none',
        }}
      >
        {/* Tooltip - 显示当前时间 */}
        {(isHovered || isDragging) && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              left: '50%',
              bottom: timeline.playheadTriangleSize + 4,
              transform: 'translateX(-50%)',
              backgroundColor: colors.bg.elevated,
              color: colors.text.primary,
              fontSize: 11,
              fontFamily: 'monospace',
              padding: '4px 8px',
              borderRadius: 4,
              whiteSpace: 'nowrap',
              boxShadow: shadows.md,
              pointerEvents: 'none',
              zIndex: zIndex.tooltip,
            }}
          >
            {formatTime(currentFrame, fps)}
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};
