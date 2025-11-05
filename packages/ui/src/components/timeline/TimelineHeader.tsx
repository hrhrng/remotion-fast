import React from 'react';
import { motion } from 'framer-motion';
import { colors, timeline, typography, borderRadius, shadows } from './styles';
import { formatTime } from './utils/timeFormatter';

interface TimelineHeaderProps {
  currentFrame: number;
  fps: number;
  zoom: number;
  snapEnabled: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleSnap: () => void;
}

export const TimelineHeader: React.FC<TimelineHeaderProps> = ({
  currentFrame,
  fps,
  zoom,
  snapEnabled,
  onZoomIn,
  onZoomOut,
  onToggleSnap,
}) => {
  const canZoomIn = zoom < timeline.zoomMax;
  const canZoomOut = zoom > timeline.zoomMin;

  return (
    <div
      style={{
        height: timeline.headerHeight,
        backgroundColor: colors.bg.secondary,
        borderBottom: `1px solid ${colors.border.default}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        boxShadow: shadows.sm,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      {/* 左侧：标题和时间显示 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div
          style={{
            fontSize: typography.fontSize.lg,
            fontWeight: typography.fontWeight.semibold,
            color: colors.text.primary,
          }}
        >
          Timeline
        </div>

        <div
          style={{
            backgroundColor: colors.bg.elevated,
            padding: '6px 12px',
            borderRadius: borderRadius.md,
            fontFamily: typography.fontFamily.mono,
            fontSize: typography.fontSize.sm,
            color: colors.text.primary,
            border: `1px solid ${colors.border.default}`,
          }}
        >
          {formatTime(currentFrame, fps)}
        </div>
      </div>

      {/* 中间：控制按钮 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* 缩放控制 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              fontSize: typography.fontSize.sm,
              color: colors.text.secondary,
              marginRight: 4,
            }}
          >
            缩放
          </span>

          <button
            onClick={onZoomOut}
            disabled={!canZoomOut}
            style={{
              width: 28,
              height: 28,
              backgroundColor: colors.bg.elevated,
              border: `1px solid ${colors.border.default}`,
              borderRadius: borderRadius.sm,
              color: canZoomOut ? colors.text.primary : colors.text.disabled,
              fontSize: typography.fontSize.lg,
              cursor: canZoomOut ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (canZoomOut) {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
                e.currentTarget.style.borderColor = colors.border.hover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.elevated;
              e.currentTarget.style.borderColor = colors.border.default;
            }}
          >
            −
          </button>

          <div
            style={{
              minWidth: 45,
              textAlign: 'center',
              fontFamily: typography.fontFamily.mono,
              fontSize: typography.fontSize.sm,
              color: colors.text.primary,
            }}
          >
            {zoom.toFixed(2)}x
          </div>

          <button
            onClick={onZoomIn}
            disabled={!canZoomIn}
            style={{
              width: 28,
              height: 28,
              backgroundColor: colors.bg.elevated,
              border: `1px solid ${colors.border.default}`,
              borderRadius: borderRadius.sm,
              color: canZoomIn ? colors.text.primary : colors.text.disabled,
              fontSize: typography.fontSize.lg,
              cursor: canZoomIn ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              if (canZoomIn) {
                e.currentTarget.style.backgroundColor = colors.bg.hover;
                e.currentTarget.style.borderColor = colors.border.hover;
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = colors.bg.elevated;
              e.currentTarget.style.borderColor = colors.border.default;
            }}
          >
            +
          </button>
        </div>

        {/* 分隔线 */}
        <div
          style={{
            width: 1,
            height: 24,
            backgroundColor: colors.border.default,
            margin: '0 4px',
          }}
        />

        {/* 吸附开关 */}
        <motion.button
          onClick={onToggleSnap}
          animate={{
            backgroundColor: snapEnabled ? colors.accent.primary : colors.bg.elevated,
            borderColor: snapEnabled ? colors.accent.primary : colors.border.default,
          }}
          transition={{ duration: 0.15 }}
          style={{
            height: 28,
            padding: '0 12px',
            border: `1px solid ${colors.border.default}`,
            borderRadius: borderRadius.sm,
            color: snapEnabled ? '#FFFFFF' : colors.text.primary,
            fontSize: typography.fontSize.sm,
            fontWeight: typography.fontWeight.medium,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <span>🧲</span>
          <span>吸附 {snapEnabled ? 'ON' : 'OFF'}</span>
        </motion.button>
      </div>
    </div>
  );
};
