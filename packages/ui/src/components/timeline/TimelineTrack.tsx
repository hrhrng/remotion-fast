import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Track, Asset, Item } from '../../types';
import { TimelineItem } from './TimelineItem';
import { colors, timeline, typography, borderRadius, shadows, withOpacity } from './styles';
import { frameToPixels } from './utils/timeFormatter';

interface TimelineTrackProps {
  track: Track;
  durationInFrames: number;
  pixelsPerFrame: number;
  isSelected: boolean;
  selectedItemId: string | null;
  assets: Asset[];
  onSelectTrack: () => void;
  onSelectItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<Item>) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}

export const TimelineTrack: React.FC<TimelineTrackProps> = ({
  track,
  durationInFrames,
  pixelsPerFrame,
  isSelected,
  selectedItemId,
  assets,
  onSelectTrack,
  onSelectItem,
  onDeleteItem,
  onUpdateItem,
  onDragOver,
  onDrop,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(track.name);

  const totalWidth = frameToPixels(durationInFrames, pixelsPerFrame);

  const handleTrackClick = useCallback(() => {
    onSelectTrack();
  }, [onSelectTrack]);

  const handleNameDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsEditingName(true);
      setEditedName(track.name);
    },
    [track.name]
  );

  const handleNameChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value);
  }, []);

  const handleNameBlur = useCallback(() => {
    setIsEditingName(false);
    // TODO: dispatch action to update track name
    // For now, just close the editor
  }, []);

  const handleNameKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleNameBlur();
      } else if (e.key === 'Escape') {
        setEditedName(track.name);
        setIsEditingName(false);
      }
    },
    [track.name, handleNameBlur]
  );

  const handleItemResize = useCallback(
    (itemId: string, edge: 'left' | 'right', deltaFrames: number) => {
      const item = track.items.find((i) => i.id === itemId);
      if (!item) return;

      if (edge === 'left') {
        // 调整起点和时长
        const newFrom = Math.max(0, item.from + deltaFrames);
        const newDuration = item.durationInFrames + (item.from - newFrom);

        if (newDuration >= 15) {
          onUpdateItem(itemId, {
            from: newFrom,
            durationInFrames: newDuration,
          });
        }
      } else {
        // 调整时长
        const newDuration = Math.max(15, item.durationInFrames + deltaFrames);
        onUpdateItem(itemId, {
          durationInFrames: newDuration,
        });
      }
    },
    [track.items, onUpdateItem]
  );

  return (
    <div
      style={{
        display: 'flex',
        height: timeline.trackHeight,
        borderBottom: `1px solid ${colors.border.default}`,
        backgroundColor: isSelected ? colors.bg.selected : colors.bg.primary,
        transition: 'background-color 0.15s ease',
        opacity: track.hidden ? 0.3 : 1,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 轨道标签区域 */}
      <div
        style={{
          width: timeline.trackLabelWidth,
          flexShrink: 0,
          backgroundColor: colors.bg.secondary,
          borderRight: `1px solid ${colors.border.default}`,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
        onClick={handleTrackClick}
      >
        {/* 轨道名称 */}
        <div>
          {isEditingName ? (
            <input
              type="text"
              value={editedName}
              onChange={handleNameChange}
              onBlur={handleNameBlur}
              onKeyDown={handleNameKeyDown}
              autoFocus
              style={{
                width: '100%',
                backgroundColor: colors.bg.elevated,
                border: `1px solid ${colors.accent.primary}`,
                borderRadius: borderRadius.sm,
                color: colors.text.primary,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                padding: '4px 6px',
                outline: 'none',
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              onDoubleClick={handleNameDoubleClick}
              style={{
                color: colors.text.primary,
                fontSize: typography.fontSize.sm,
                fontWeight: typography.fontWeight.medium,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                userSelect: 'none',
              }}
            >
              {track.name}
            </div>
          )}
        </div>

        {/* 轨道控制按钮 */}
        {isHovered && !isEditingName && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            style={{
              display: 'flex',
              gap: 4,
              marginTop: 8,
            }}
          >
            {/* 静音按钮 */}
            <button
              style={{
                width: 24,
                height: 24,
                backgroundColor: colors.bg.elevated,
                border: `1px solid ${colors.border.default}`,
                borderRadius: borderRadius.sm,
                color: colors.text.secondary,
                fontSize: typography.fontSize.xs,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={(e) => {
                e.stopPropagation();
                // TODO: toggle mute
              }}
              title="静音 (M)"
            >
              M
            </button>

            {/* 独奏按钮 */}
            <button
              style={{
                width: 24,
                height: 24,
                backgroundColor: colors.bg.elevated,
                border: `1px solid ${colors.border.default}`,
                borderRadius: borderRadius.sm,
                color: colors.text.secondary,
                fontSize: typography.fontSize.xs,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={(e) => {
                e.stopPropagation();
                // TODO: toggle solo
              }}
              title="独奏 (S)"
            >
              S
            </button>

            {/* 锁定按钮 */}
            <button
              style={{
                width: 24,
                height: 24,
                backgroundColor: track.locked ? colors.accent.warning : colors.bg.elevated,
                border: `1px solid ${colors.border.default}`,
                borderRadius: borderRadius.sm,
                color: track.locked ? colors.text.primary : colors.text.secondary,
                fontSize: typography.fontSize.xs,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              onClick={(e) => {
                e.stopPropagation();
                // TODO: toggle lock
              }}
              title="锁定 (L)"
            >
              {track.locked ? '🔒' : 'L'}
            </button>
          </motion.div>
        )}
      </div>

      {/* 轨道内容区域 */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          height: '100%',
          overflow: 'visible',
        }}
        onClick={handleTrackClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {/* 时间网格背景 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: totalWidth,
            height: '100%',
            pointerEvents: 'none',
          }}
        >
          {/* 可以在这里添加网格线 */}
        </div>

        {/* 素材项 */}
        <div
          style={{
            position: 'absolute',
            top: timeline.itemVerticalPadding,
            left: 0,
            right: 0,
            bottom: timeline.itemVerticalPadding,
            display: 'flex',
            gap: 0,
          }}
        >
          {track.items.map((item) => (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: frameToPixels(item.from, pixelsPerFrame),
                top: 0,
              }}
            >
              <TimelineItem
                item={item}
                pixelsPerFrame={pixelsPerFrame}
                isSelected={selectedItemId === item.id}
                assets={assets}
                onSelect={() => onSelectItem(item.id)}
                onDelete={() => onDeleteItem(item.id)}
                onResize={(edge, deltaFrames) => handleItemResize(item.id, edge, deltaFrames)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
