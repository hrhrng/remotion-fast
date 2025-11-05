import React, { useState, useCallback, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import { Item, Asset } from '../../types';
import { colors, timeline, typography, shadows, animations, borderRadius } from './styles';
import { getItemColor, withOpacity } from './styles';
import { frameToPixels } from './utils/timeFormatter';

interface TimelineItemProps {
  item: Item;
  pixelsPerFrame: number;
  isSelected: boolean;
  assets: Asset[];
  onSelect: () => void;
  onDelete: () => void;
  onResizeStart?: (edge: 'left' | 'right') => void;
  onResize?: (edge: 'left' | 'right', deltaFrames: number) => void;
  onResizeEnd?: () => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  item,
  pixelsPerFrame,
  isSelected,
  assets,
  onSelect,
  onDelete,
  onResizeStart,
  onResize,
  onResizeEnd,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [resizingEdge, setResizingEdge] = useState<'left' | 'right' | null>(null);

  const width = frameToPixels(item.durationInFrames, pixelsPerFrame);
  const itemColor = getItemColor(
    item.type,
    item.type === 'solid' ? item.color : undefined
  );

  // 获取素材资源（用于缩略图和波形）
  const asset = item.type === 'video' || item.type === 'audio' || item.type === 'image'
    ? assets.find((a) => a.id === item.assetId)
    : null;

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onSelect();
    },
    [onSelect]
  );

  const handleDeleteClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onDelete();
    },
    [onDelete]
  );

  // 调整大小处理
  const handleResizeMouseDown = useCallback(
    (edge: 'left' | 'right', e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setResizingEdge(edge);
      onResizeStart?.(edge);

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaFrames = Math.round(deltaX / pixelsPerFrame);

        onResize?.(edge, deltaFrames);
      };

      const handleMouseUp = () => {
        setResizingEdge(null);
        onResizeEnd?.();
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [width, pixelsPerFrame, onResizeStart, onResize, onResizeEnd]
  );

  // 渲染波形图
  const renderWaveform = () => {
    if ((item.type !== 'audio' && item.type !== 'video') || !asset?.waveform) {
      return null;
    }

    const waveformHeight = 24;
    const samples = asset.waveform;
    const sampleWidth = width / samples.length;

    return (
      <svg
        width={width}
        height={waveformHeight}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
        }}
      >
        {samples.map((amplitude, index) => {
          const barHeight = amplitude * waveformHeight;
          return (
            <rect
              key={index}
              x={index * sampleWidth}
              y={(waveformHeight - barHeight) / 2}
              width={Math.max(1, sampleWidth)}
              height={barHeight}
              fill={withOpacity(colors.text.secondary, 0.6)}
            />
          );
        })}
      </svg>
    );
  };

  // 渲染缩略图（视频和图片）
  const renderThumbnail = () => {
    if ((item.type !== 'video' && item.type !== 'image') || !asset?.thumbnail) {
      return null;
    }

    return (
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: item.type === 'video' ? 40 : '100%',
          backgroundImage: `url(${asset.thumbnail})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'repeat-x',
          opacity: 0.8,
        }}
      />
    );
  };

  const containerStyle: CSSProperties = {
    position: 'relative',
    width: Math.max(width, timeline.itemMinWidth),
    height: timeline.trackHeight - timeline.itemVerticalPadding * 2,
    backgroundColor: itemColor,
    borderRadius: timeline.itemBorderRadius,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: resizingEdge ? 'none' : 'filter 0.15s ease',
    filter: isHovered && !isSelected ? 'brightness(1.1)' : 'brightness(1)',
  };

  return (
    <motion.div
      style={containerStyle}
      animate={{
        scale: isSelected ? 1.02 : 1,
        boxShadow: isSelected ? shadows.selected : 'none',
      }}
      transition={animations.spring}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      {/* 背景内容 */}
      {renderThumbnail()}
      {renderWaveform()}

      {/* 素材名称标签 */}
      <div
        style={{
          position: 'absolute',
          top: 4,
          left: 6,
          right: isHovered ? 28 : 6,
          fontSize: typography.fontSize.xs,
          fontWeight: typography.fontWeight.medium,
          color: colors.text.primary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
          pointerEvents: 'none',
          zIndex: 2,
        }}
      >
        {item.type === 'text'
          ? item.text?.substring(0, 20) || 'Text'
          : asset?.name || item.type}
      </div>

      {/* 删除按钮 - 仅在悬停时显示 */}
      {isHovered && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.15 }}
          onClick={handleDeleteClick}
          style={{
            position: 'absolute',
            top: 4,
            right: 4,
            width: 20,
            height: 20,
            backgroundColor: withOpacity(colors.bg.elevated, 0.9),
            border: 'none',
            borderRadius: borderRadius.sm,
            color: colors.text.primary,
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 3,
            boxShadow: shadows.sm,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = colors.accent.danger;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = withOpacity(colors.bg.elevated, 0.9);
          }}
        >
          ×
        </motion.button>
      )}

      {/* 左边缘调整大小手柄 */}
      <div
        onMouseDown={(e) => handleResizeMouseDown('left', e)}
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: timeline.resizeHandleWidth,
          cursor: 'ew-resize',
          zIndex: 4,
          backgroundColor:
            resizingEdge === 'left' || (isHovered && !resizingEdge)
              ? withOpacity(colors.accent.primary, 0.3)
              : 'transparent',
          transition: 'background-color 0.15s ease',
        }}
      />

      {/* 右边缘调整大小手柄 */}
      <div
        onMouseDown={(e) => handleResizeMouseDown('right', e)}
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: timeline.resizeHandleWidth,
          cursor: 'ew-resize',
          zIndex: 4,
          backgroundColor:
            resizingEdge === 'right' || (isHovered && !resizingEdge)
              ? withOpacity(colors.accent.primary, 0.3)
              : 'transparent',
          transition: 'background-color 0.15s ease',
        }}
      />

      {/* 选中边框（使用伪元素效果） */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            border: `2px solid ${colors.accent.primary}`,
            borderRadius: timeline.itemBorderRadius,
            pointerEvents: 'none',
            zIndex: 5,
          }}
        />
      )}
    </motion.div>
  );
};
