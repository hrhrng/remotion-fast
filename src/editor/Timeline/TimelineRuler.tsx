import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { colors, timeline, typography, shadows, zIndex } from './styles';
import {
  formatTime,
  frameToPixels,
  pixelsToFrame,
  getRulerInterval,
  getSubInterval,
} from './utils/timeFormatter';

interface TimelineRulerProps {
  durationInFrames: number;
  pixelsPerFrame: number;
  fps: number;
  onSeek: (frame: number) => void;
  zoom: number;
}

export const TimelineRuler: React.FC<TimelineRulerProps> = ({
  durationInFrames,
  pixelsPerFrame,
  fps,
  onSeek,
  zoom,
}) => {
  const [hoveredFrame, setHoveredFrame] = useState<number | null>(null);
  const [mouseX, setMouseX] = useState<number>(0);

  const mainInterval = getRulerInterval(zoom);
  const subInterval = getSubInterval(mainInterval);

  const totalWidth = frameToPixels(durationInFrames, pixelsPerFrame);

  // 生成主刻度
  const mainTicks = useMemo(() => {
    const ticks: { frame: number; position: number; label: string }[] = [];
    for (let frame = 0; frame <= durationInFrames; frame += mainInterval) {
      ticks.push({
        frame,
        position: frameToPixels(frame, pixelsPerFrame),
        label: formatTime(frame, fps),
      });
    }
    return ticks;
  }, [durationInFrames, mainInterval, pixelsPerFrame, fps]);

  // 生成次刻度
  const subTicks = useMemo(() => {
    const ticks: { frame: number; position: number }[] = [];
    for (let frame = 0; frame <= durationInFrames; frame += subInterval) {
      // 跳过与主刻度重合的位置
      if (frame % mainInterval !== 0) {
        ticks.push({
          frame,
          position: frameToPixels(frame, pixelsPerFrame),
        });
      }
    }
    return ticks;
  }, [durationInFrames, subInterval, mainInterval, pixelsPerFrame]);

  const handleClick = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frame = Math.max(0, Math.min(durationInFrames, pixelsToFrame(x, pixelsPerFrame)));
    onSeek(frame);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const frame = Math.max(0, Math.min(durationInFrames, pixelsToFrame(x, pixelsPerFrame)));
    setHoveredFrame(frame);
    setMouseX(x);
  };

  const handleMouseLeave = () => {
    setHoveredFrame(null);
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: timeline.rulerHeight,
        background: `linear-gradient(180deg, ${colors.bg.secondary} 0%, ${colors.bg.elevated} 100%)`,
        borderBottom: `1px solid ${colors.border.default}`,
        boxShadow: shadows.sm,
        zIndex: zIndex.ruler,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {/* SVG 刻度和标签 */}
      <svg
        width={totalWidth}
        height={timeline.rulerHeight}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
        }}
      >
        {/* 次刻度（细线） */}
        {subTicks.map((tick) => (
          <line
            key={`sub-${tick.frame}`}
            x1={tick.position}
            y1={timeline.rulerHeight - 6}
            x2={tick.position}
            y2={timeline.rulerHeight}
            stroke={colors.border.default}
            strokeWidth={1}
          />
        ))}

        {/* 主刻度（粗线和标签） */}
        {mainTicks.map((tick) => (
          <g key={`main-${tick.frame}`}>
            <line
              x1={tick.position}
              y1={timeline.rulerHeight - 10}
              x2={tick.position}
              y2={timeline.rulerHeight}
              stroke={colors.text.tertiary}
              strokeWidth={1}
            />
            <text
              x={tick.position + 4}
              y={14}
              fill={colors.text.secondary}
              fontSize={typography.fontSize.xs}
              fontFamily={typography.fontFamily.mono}
            >
              {tick.label}
            </text>
          </g>
        ))}
      </svg>

      {/* 悬停时的时间提示 */}
      {hoveredFrame !== null && (
        <motion.div
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -5 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'absolute',
            left: mouseX,
            top: -28,
            transform: 'translateX(-50%)',
            backgroundColor: colors.bg.elevated,
            color: colors.text.primary,
            fontSize: typography.fontSize.xs,
            fontFamily: typography.fontFamily.mono,
            padding: '4px 8px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            boxShadow: shadows.md,
            pointerEvents: 'none',
            zIndex: zIndex.tooltip,
            border: `1px solid ${colors.border.default}`,
          }}
        >
          {formatTime(hoveredFrame, fps)}
        </motion.div>
      )}
    </div>
  );
};
