import React, { useState, useCallback, useEffect, useRef, CSSProperties } from 'react';
import { motion } from 'framer-motion';
import type { Item, Asset, Track } from '@remotion-fast/core';
import { useEditor } from '@remotion-fast/core';
import { colors, timeline, typography, shadows, animations, borderRadius } from './styles';
import { getItemColor, withOpacity } from './styles';
import { frameToPixels } from './utils/timeFormatter';

// Store dragged item globally on window object for cross-module access
declare global {
  interface Window {
    currentDraggedItem: { item: Item; trackId: string } | null;
  }
}

interface TimelineItemProps {
  item: Item;
  trackId: string;
  track: Track;
  pixelsPerFrame: number;
  isSelected: boolean;
  assets: Asset[];
  onSelect: () => void;
  onDelete: () => void;
  onUpdate: (itemId: string, updates: Partial<Item>) => void;
  onResizeStart?: (edge: 'left' | 'right') => void;
  onResize?: (edge: 'left' | 'right', deltaFrames: number) => void;
  onResizeEnd?: () => void;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  item,
  trackId,
  track,
  pixelsPerFrame,
  isSelected,
  assets,
  onSelect,
  onDelete,
  onUpdate,
  onResizeStart,
  onResize,
  onResizeEnd,
}) => {
  const { state } = useEditor();
  const [isHovered, setIsHovered] = useState(false);
  const [resizingEdge, setResizingEdge] = useState<'left' | 'right' | null>(null);
  const [draggingFade, setDraggingFade] = useState<{ type: 'in' | 'out' } | null>(null);
  const [draggingVolume, setDraggingVolume] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [tempText, setTempText] = useState('');

  const width = frameToPixels(item.durationInFrames, pixelsPerFrame);

  // Get item color based on type
  const getColor = () => {
    switch (item.type) {
      case 'solid':
        return item.color;
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

  // Get asset data (for thumbnail and waveform)
  const asset = React.useMemo(() => {
    if (item.type === 'video' || item.type === 'audio' || item.type === 'image') {
      // Items have src directly, not assetId
      return assets.find((a) => a.src === item.src);
    }
    return null;
  }, [item, assets]);

  const thumbnail = asset?.thumbnail || (item.type === 'image' ? item.src : undefined);
  const hasWaveform = (item.type === 'audio' || item.type === 'video') &&
    'waveform' in item && item.waveform;

  // Calculate heights - ensure items fit within 72px track height
  const hasVideoWithThumbnail = item.type === 'video' && thumbnail && hasWaveform;
  const itemHeight = hasVideoWithThumbnail ? 60 : (hasWaveform ? 56 : 44);
  const borderSize = isSelected ? 2 : 1;
  const availableHeight = itemHeight - (borderSize * 2);
  const thumbnailHeight = hasVideoWithThumbnail ? 30 : (hasWaveform ? Math.floor(availableHeight * 0.6) : 44);
  const waveformHeight = hasWaveform ? (hasVideoWithThumbnail ? 28 : availableHeight - thumbnailHeight) : 0;

  // Get audio/video properties
  const audioFadeIn = ((item.type === 'video' || item.type === 'audio') && 'audioFadeIn' in item)
    ? item.audioFadeIn || 0 : 0;
  const audioFadeOut = ((item.type === 'video' || item.type === 'audio') && 'audioFadeOut' in item)
    ? item.audioFadeOut || 0 : 0;
  const itemVolume = ((item.type === 'video' || item.type === 'audio') && 'volume' in item)
    ? item.volume ?? 1 : 1;

  // Get display label
  const getItemLabel = () => {
    if (item.type === 'text') {
      return item.text;
    }
    if (item.type === 'solid') {
      return 'Solid';
    }
    // For media items, extract filename from src
    if ('src' in item && item.src) {
      const filename = item.src.split('/').pop() || item.type;
      const cleanName = filename.replace(/\.[^.]+$/, '').replace(/_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i, '');
      return cleanName.substring(0, 30);
    }
    return item.type;
  };

  // Render waveform with volume and clipping
  const renderWaveform = (
    waveform: number[],
    width: number,
    height: number
  ) => {
    const barCount = waveform.length;
    const barWidth = width / barCount;

    return (
      <svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          pointerEvents: 'none',
        }}
        preserveAspectRatio="none"
      >
        {waveform.map((peak, i) => {
          const targetBarHeight = peak * height * itemVolume;
          const x = i * barWidth;
          const isClipping = targetBarHeight > height;
          const barHeight = Math.min(targetBarHeight, height);
          const normalHeight = isClipping ? height : barHeight;

          return (
            <g key={i}>
              <rect
                x={x}
                y={height - normalHeight}
                width={Math.max(barWidth, 1)}
                height={normalHeight}
                fill="rgba(200, 200, 200, 0.9)"
              />
              {isClipping && (
                <rect
                  x={x}
                  y={0}
                  width={Math.max(barWidth, 1)}
                  height={2}
                  fill="rgba(255, 60, 60, 0.9)"
                />
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  // Render fade curve
  const renderFadeCurve = (
    width: number,
    height: number,
    fadeFrames: number,
    type: 'in' | 'out'
  ) => {
    if (fadeFrames <= 0) return null;

    const fadeWidth = fadeFrames * pixelsPerFrame;
    const handleCenterY = thumbnailHeight;

    let curvePath: string;
    let fillPath: string;

    if (type === 'in') {
      const handleCenterX = fadeWidth;
      const controlX = fadeWidth / 2;
      const controlY = handleCenterY - 1;
      curvePath = `M 0,${height} Q ${controlX},${controlY} ${handleCenterX},${handleCenterY}`;
      fillPath = `M 0,${height} Q ${controlX},${controlY} ${handleCenterX},${handleCenterY} L 0,${handleCenterY} Z`;
    } else {
      const handleCenterX = width - fadeWidth;
      const controlX = width - fadeWidth / 2;
      const controlY = handleCenterY - 1;
      curvePath = `M ${width},${height} Q ${controlX},${controlY} ${handleCenterX},${handleCenterY}`;
      fillPath = `M ${width},${height} Q ${controlX},${controlY} ${handleCenterX},${handleCenterY} L ${width},${handleCenterY} Z`;
    }

    return (
      <svg
        width={width}
        height={height}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <path d={fillPath} fill="black" />
        <path d={curvePath} stroke="rgba(100, 150, 255, 0.8)" strokeWidth="0.5" fill="none" />
      </svg>
    );
  };

  // Fade drag handlers
  const handleFadeMouseDown = (e: React.MouseEvent, type: 'in' | 'out') => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingFade({ type });
  };

  const handleFadeDrag = useCallback((e: MouseEvent) => {
    if (!draggingFade) return;

    const container = document.querySelector('[data-timeline-container]');
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const x = e.clientX - rect.left - 200; // Account for track label width
    const relativeX = x - (item.from * pixelsPerFrame);
    const frames = Math.max(0, Math.floor(relativeX / pixelsPerFrame));

    if (draggingFade.type === 'in') {
      const maxFade = Math.floor((item.durationInFrames * 2) / 3);
      const newFadeIn = Math.max(0, Math.min(maxFade, frames));
      onUpdate(item.id, { audioFadeIn: newFadeIn });
    } else {
      const distanceFromEnd = item.durationInFrames - frames;
      const maxFade = Math.floor((item.durationInFrames * 2) / 3);
      const newFadeOut = Math.max(0, Math.min(maxFade, distanceFromEnd));
      onUpdate(item.id, { audioFadeOut: newFadeOut });
    }
  }, [draggingFade, item, pixelsPerFrame, onUpdate]);

  const handleFadeMouseUp = useCallback(() => {
    setDraggingFade(null);
  }, []);

  // Volume drag handlers
  const handleVolumeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDraggingVolume(true);
  };

  const handleVolumeDrag = useCallback((e: MouseEvent) => {
    if (!draggingVolume) return;

    const waveformElement = document.querySelector(`[data-waveform-id="${item.id}"]`);
    if (!waveformElement) return;

    const rect = waveformElement.getBoundingClientRect();
    const rawY = e.clientY - rect.top;
    const y = Math.max(0, Math.min(rect.height, rawY));
    const normalizedY = y / rect.height;
    const volume = Math.max(0, Math.min(2, (1 - normalizedY) * 2));

    onUpdate(item.id, { volume });
  }, [draggingVolume, item.id, onUpdate]);

  const handleVolumeMouseUp = useCallback(() => {
    setDraggingVolume(false);
  }, []);

  // Text editing handlers
  const handleTextEdit = () => {
    if (item.type === 'text') {
      setTempText(item.text);
      setIsEditingText(true);
    }
  };

  const handleTextSave = () => {
    if (item.type === 'text' && tempText.trim()) {
      onUpdate(item.id, { text: tempText.trim() });
    }
    setIsEditingText(false);
  };

  const handleTextCancel = () => {
    setIsEditingText(false);
    setTempText('');
  };

  // Setup drag listeners
  useEffect(() => {
    if (draggingFade) {
      window.addEventListener('mousemove', handleFadeDrag);
      window.addEventListener('mouseup', handleFadeMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleFadeDrag);
        window.removeEventListener('mouseup', handleFadeMouseUp);
      };
    }
  }, [draggingFade, handleFadeDrag, handleFadeMouseUp]);

  useEffect(() => {
    if (draggingVolume) {
      window.addEventListener('mousemove', handleVolumeDrag);
      window.addEventListener('mouseup', handleVolumeMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleVolumeDrag);
        window.removeEventListener('mouseup', handleVolumeMouseUp);
      };
    }
  }, [draggingVolume, handleVolumeDrag, handleVolumeMouseUp]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect();
  }, [onSelect]);

  const handleDeleteClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  }, [onDelete]);

  // Handle resize
  const handleResizeMouseDown = useCallback(
    (edge: 'left' | 'right', e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      setResizingEdge(edge);
      onResizeStart?.(edge);

      const startX = e.clientX;

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
    [pixelsPerFrame, onResizeStart, onResize, onResizeEnd]
  );

  const handleDragStart = (e: React.DragEvent) => {
    // Store item and track data globally on window object
    window.currentDraggedItem = { item, trackId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('dragType', 'item');
    e.dataTransfer.setData('itemId', item.id);
    e.dataTransfer.setData('trackId', trackId);
    e.dataTransfer.setData('item', JSON.stringify(item));
    console.log('TimelineItem drag started:', { item, trackId });
    console.log('Set window.currentDraggedItem:', window.currentDraggedItem);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    // Clear the global dragged item reference
    window.currentDraggedItem = null;
    console.log('TimelineItem drag ended, cleared window.currentDraggedItem');
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleTextEdit}
      style={{
        position: 'absolute',
        left: frameToPixels(item.from, pixelsPerFrame),
        width: width,
        height: `${itemHeight}px`,
        top: '50%',
        transform: 'translateY(-50%)',
        backgroundColor: getColor(),
        borderRadius: '4px',
        border: isSelected
          ? `${borderSize}px solid #ffffff`
          : `${borderSize}px solid rgba(0,0,0,0.2)`,
        cursor: 'move',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundImage: (hasWaveform || item.type === 'audio') ? 'none' : (thumbnail ? `url(${thumbnail})` : 'none'),
        backgroundSize: item.type === 'image' ? 'contain' : 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: item.type === 'image' ? 'no-repeat' : 'repeat-x',
        opacity: track.hidden ? 0.3 : 1,
      }}
    >
      {/* Thumbnail for video with waveform */}
      {item.type === 'video' && thumbnail && hasWaveform && (
        <div
          data-thumbnail-id={item.id}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${thumbnailHeight}px`,
            backgroundImage: `url(${thumbnail})`,
            backgroundSize: 'auto 100%',
            backgroundPosition: 'left top',
            backgroundRepeat: 'repeat-x',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        />
      )}

      {/* Waveform */}
      {hasWaveform && item.waveform && (
        <div
          data-waveform-id={item.id}
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: '100%',
            height: `${waveformHeight}px`,
            overflow: 'hidden',
            zIndex: 2,
            contain: 'strict',
          }}
        >
          {renderWaveform(item.waveform, width, waveformHeight)}

          {/* Volume control line */}
          {(item.type === 'audio' || item.type === 'video') && (() => {
            const lineY = waveformHeight * (1 - itemVolume / 2);
            const clampedLineY = Math.max(0, Math.min(waveformHeight - 1, lineY));

            return (
              <div
                onMouseDown={isHovered ? handleVolumeMouseDown : undefined}
                style={{
                  position: 'absolute',
                  top: `${clampedLineY}px`,
                  left: 0,
                  width: '100%',
                  height: '1px',
                  backgroundColor: isHovered ? 'rgba(255, 255, 255, 0.5)' : 'transparent',
                  cursor: isHovered ? 'ns-resize' : 'default',
                  zIndex: 3,
                  pointerEvents: isHovered ? 'auto' : 'none',
                }}
                title={isHovered ? `Volume: ${Math.round(itemVolume * 100)}%` : ''}
              />
            );
          })()}
        </div>
      )}

      {/* Fade curves */}
      {hasWaveform && isSelected && (
        <>
          {renderFadeCurve(width, itemHeight, audioFadeIn, 'in')}
          {renderFadeCurve(width, itemHeight, audioFadeOut, 'out')}
        </>
      )}

      {/* Fade handles */}
      {hasWaveform && isHovered && (
        <>
          {/* Fade In Handle */}
          <div
            onMouseDown={(e) => handleFadeMouseDown(e, 'in')}
            onDragStart={(e) => e.preventDefault()}
            style={{
              position: 'absolute',
              left: `${audioFadeIn * pixelsPerFrame - 6}px`,
              top: hasVideoWithThumbnail ? `${thumbnailHeight - 6}px` : (hasWaveform ? `${thumbnailHeight - 6}px` : '-6px'),
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              border: '2px solid #0066ff',
              cursor: 'ew-resize',
              zIndex: 30,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              pointerEvents: 'auto',
            }}
            title={`Fade In: ${(audioFadeIn / state.fps).toFixed(1)}s`}
          >
            {draggingFade?.type === 'in' && (
              <div style={{
                position: 'absolute',
                top: '-24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,0,0,0.9)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                {(audioFadeIn / state.fps).toFixed(2)}s
              </div>
            )}
          </div>

          {/* Fade Out Handle */}
          <div
            onMouseDown={(e) => handleFadeMouseDown(e, 'out')}
            onDragStart={(e) => e.preventDefault()}
            style={{
              position: 'absolute',
              right: `${audioFadeOut * pixelsPerFrame - 6}px`,
              top: hasVideoWithThumbnail ? `${thumbnailHeight - 6}px` : (hasWaveform ? `${thumbnailHeight - 6}px` : '-6px'),
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#fff',
              border: '2px solid #0066ff',
              cursor: 'ew-resize',
              zIndex: 30,
              boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              pointerEvents: 'auto',
            }}
            title={`Fade Out: ${(audioFadeOut / state.fps).toFixed(1)}s`}
          >
            {draggingFade?.type === 'out' && (
              <div style={{
                position: 'absolute',
                top: '-24px',
                left: '50%',
                transform: 'translateX(-50%)',
                backgroundColor: 'rgba(0,0,0,0.9)',
                color: '#fff',
                padding: '2px 6px',
                borderRadius: '3px',
                fontSize: '11px',
                whiteSpace: 'nowrap',
                pointerEvents: 'none',
              }}>
                {(audioFadeOut / state.fps).toFixed(2)}s
              </div>
            )}
          </div>
        </>
      )}

      {/* Item Label */}
      <span style={{
        position: 'absolute',
        top: '4px',
        right: '4px',
        fontSize: '12px',
        color: '#ffffff',
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        backgroundColor: (thumbnail || hasWaveform) ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
        padding: (thumbnail || hasWaveform) ? '2px 6px' : '0',
        borderRadius: (thumbnail || hasWaveform) ? '3px' : '0',
        zIndex: 1,
        maxWidth: isHovered ? 'calc(100% - 40px)' : 'calc(100% - 16px)',
        pointerEvents: 'none',
      }}>
        {isEditingText && item.type === 'text' ? (
          <input
            type="text"
            value={tempText}
            onChange={(e) => setTempText(e.target.value)}
            onBlur={handleTextSave}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTextSave();
              if (e.key === 'Escape') handleTextCancel();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#FFFFFF',
              width: '100%',
              font: 'inherit',
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          getItemLabel()
        )}
      </span>

      {/* Delete button - only on hover */}
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
            backgroundColor: 'rgba(255, 68, 68, 0.9)',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: 14,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 31,
            fontWeight: 'bold',
          }}
        >
          ×
        </motion.button>
      )}

      {/* Resize handles */}
      {isHovered && (
        <>
          <div
            onMouseDown={(e) => handleResizeMouseDown('left', e)}
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: 'ew-resize',
              zIndex: 4,
              backgroundColor: resizingEdge === 'left' ? 'rgba(0, 102, 255, 0.3)' : 'transparent',
            }}
          />
          <div
            onMouseDown={(e) => handleResizeMouseDown('right', e)}
            style={{
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: 8,
              cursor: 'ew-resize',
              zIndex: 4,
              backgroundColor: resizingEdge === 'right' ? 'rgba(0, 102, 255, 0.3)' : 'transparent',
            }}
          />
        </>
      )}

      {/* Color picker for solid items */}
      {item.type === 'solid' && isHovered && (
        <input
          type="color"
          value={item.color}
          onChange={(e) => onUpdate(item.id, { color: e.target.value })}
          style={{
            position: 'absolute',
            bottom: 4,
            right: 4,
            width: 20,
            height: 20,
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            zIndex: 2,
          }}
          onClick={(e) => e.stopPropagation()}
        />
      )}
    </div>
  );
};