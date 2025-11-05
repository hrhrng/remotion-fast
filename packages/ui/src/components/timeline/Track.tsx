import React from 'react';
import { Reorder } from 'framer-motion';
import type { Track as TrackType, Item, Asset } from '@remotion-fast/core';
import { TimelineItem } from './TimelineItem';

interface TrackProps {
  track: TrackType;
  pixelsPerFrame: number;
  fps: number;
  isSelected: boolean;
  selectedItemId: string | null;
  hoveredItemId: string | null;
  assets: Asset[];
  trackLabelWidth: number;
  onTrackClick: (trackId: string) => void;
  onItemDragStart: (e: React.DragEvent, trackId: string, item: Item) => void;
  onItemDragEnd: () => void;
  onItemClick: (e: React.MouseEvent, itemId: string) => void;
  onItemMouseEnter: (itemId: string) => void;
  onItemMouseLeave: () => void;
  onItemDragOver: (e: React.DragEvent, trackId: string) => void;
  onItemDrop: (e: React.DragEvent, trackId: string) => void;
  onVolumeMouseDown?: (e: React.MouseEvent, itemId: string, trackId: string) => void;
  onFadeMouseDown?: (e: React.MouseEvent, itemId: string, trackId: string, type: 'in' | 'out') => void;
  draggingFade?: { itemId: string; type: 'in' | 'out' } | null;
  dragPreview?: any;
  snapPreview?: any;
}

export const Track: React.FC<TrackProps> = ({
  track,
  pixelsPerFrame,
  fps,
  isSelected,
  selectedItemId,
  hoveredItemId,
  assets,
  trackLabelWidth,
  onTrackClick,
  onItemDragStart,
  onItemDragEnd,
  onItemClick,
  onItemMouseEnter,
  onItemMouseLeave,
  onItemDragOver,
  onItemDrop,
  onVolumeMouseDown,
  onFadeMouseDown,
  draggingFade,
  dragPreview,
  snapPreview,
}) => {
  const getColorByType = (type: string): string => {
    switch (type) {
      case 'text':
        return '#4CAF50';
      case 'video':
        return '#2196F3';
      case 'audio':
        return '#FF9800';
      case 'image':
        return '#9C27B0';
      default:
        return '#666666';
    }
  };

  return (
    <Reorder.Item
      key={track.id}
      value={track}
      dragListener={false}
      dragControls={undefined}
      style={{
        ...styles.track,
        backgroundColor: isSelected ? '#2a2a2a' : '#1e1e1e',
        listStyle: 'none',
      }}
      onClick={() => onTrackClick(track.id)}
      onDragOver={(e) => onItemDragOver(e, track.id)}
      onDrop={(e) => onItemDrop(e, track.id)}
      onDragEnd={onItemDragEnd}
    >
      <div style={{ ...styles.trackLabel, width: trackLabelWidth }}>
        <span style={styles.trackName}>{track.name}</span>
      </div>
      <div
        style={styles.trackContent}
        onPointerDown={(e) => e.stopPropagation()}
        draggable={false}
      >
        {/* Drag Preview */}
        {dragPreview && dragPreview.trackId === track.id && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              height: '44px',
              left: dragPreview.pixelX,
              width: dragPreview.duration * pixelsPerFrame,
              backgroundColor: getColorByType(dragPreview.type),
              opacity: 1,
              border: '1px solid rgba(0,0,0,0.2)',
              borderRadius: '4px',
              pointerEvents: 'none',
              zIndex: 4,
              backgroundImage: (dragPreview.type === 'video' ? dragPreview.thumbnail : dragPreview.src) ?
                `url(${dragPreview.type === 'video' ? dragPreview.thumbnail : dragPreview.src})` : 'none',
              backgroundSize: dragPreview.type === 'image' ? 'contain' : 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: dragPreview.type === 'image' ? 'no-repeat' : 'repeat-x',
            }}
          >
            <span style={{
              fontSize: '12px',
              color: 'white',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              backgroundColor: (dragPreview.thumbnail || dragPreview.src) ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
              padding: (dragPreview.thumbnail || dragPreview.src) ? '2px 6px' : '0',
              borderRadius: (dragPreview.thumbnail || dragPreview.src) ? '3px' : '0',
              position: 'absolute',
              top: '4px',
              right: '4px',
            }}>
              {dragPreview.type}
            </span>
          </div>
        )}

        {/* Snap Preview */}
        {snapPreview && snapPreview.trackId === track.id && (
          <div
            style={{
              position: 'absolute',
              top: '8px',
              height: '44px',
              left: snapPreview.frame * pixelsPerFrame,
              width: snapPreview.duration * pixelsPerFrame,
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '4px',
              pointerEvents: 'none',
              zIndex: 3,
            }}
          />
        )}

        {/* Items */}
        {track.items.map((item) => (
          <TimelineItem
            key={item.id}
            item={item}
            trackId={track.id}
            pixelsPerFrame={pixelsPerFrame}
            fps={fps}
            isSelected={selectedItemId === item.id}
            isHovered={hoveredItemId === item.id}
            trackHidden={track.hidden}
            assets={assets}
            onDragStart={onItemDragStart}
            onDragEnd={onItemDragEnd}
            onClick={onItemClick}
            onMouseEnter={onItemMouseEnter}
            onMouseLeave={onItemMouseLeave}
            onVolumeMouseDown={onVolumeMouseDown}
            onFadeMouseDown={onFadeMouseDown}
            draggingFade={draggingFade}
          />
        ))}
      </div>
    </Reorder.Item>
  );
};

const styles: Record<string, React.CSSProperties> = {
  track: {
    display: 'flex',
    minHeight: '60px',
    borderBottom: '1px solid #2a2a2a',
    cursor: 'pointer',
  },
  trackLabel: {
    display: 'flex',
    alignItems: 'center',
    padding: '0 12px',
    backgroundColor: '#2d2d2d',
    borderRight: '1px solid #3d3d3d',
    flexShrink: 0,
  },
  trackName: {
    fontSize: '14px',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackContent: {
    position: 'relative',
    flex: 1,
    minHeight: '60px',
  },
};
