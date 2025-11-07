import React, { useState, useCallback, useEffect, useRef, CSSProperties } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { CSS as DndCSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import type { Item, Asset, Track } from '@remotion-fast/core';
import { useEditor } from '@remotion-fast/core';
import { colors, timeline, typography, shadows, animations, borderRadius } from './styles';
import { getItemColor, withOpacity } from './styles';
import { frameToPixels, secondsToFrames } from './utils/timeFormatter';
import { getRendererForItem } from './items/registry';

// Simple in-memory cache for per-asset filmstrips built at a high sample rate
type FilmstripCacheEntry = {
  canvas: HTMLCanvasElement;
  frameWidth: number;
  frameHeight: number;
  framesPerRow: number;
  sampleCount: number;
  duration: number; // seconds
};

const filmstripCache = new Map<string, FilmstripCacheEntry>();

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
  // Legacy native DnD callbacks (kept for compatibility with old flow if needed)
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onResizeStart?: (edge: 'left' | 'right') => void;
  onResize?: (edge: 'left' | 'right', deltaFrames: number) => void;
  onResizeEnd?: () => void;
  style?: CSSProperties;
  // DragOverlay mode: disable positioning, let DragOverlay handle it
  isDragOverlay?: boolean;
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
  onDragStart: onDragStartProp,
  onDragEnd: onDragEndProp,
  onResizeStart,
  onResize,
  onResizeEnd,
  style: customStyle,
  isDragOverlay = false,
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
  // For video items with both thumbnail and waveform, use a 7:3 ratio (thumbnail:waveform)
  // Keep existing behavior for other item types
  const thumbnailHeight = hasVideoWithThumbnail
    ? Math.max(1, Math.floor(availableHeight * 0.7))
    : (hasWaveform ? Math.floor(availableHeight * 0.6) : 44);

  // Dynamic thumbnail generation based on zoom level
  const [dynamicThumbnail, setDynamicThumbnail] = React.useState<string | null>(null);
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = React.useState(false);
  const lastZoomRef = React.useRef<number>(pixelsPerFrame);
  const thumbnailCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Generate thumbnail based on current zoom level
  const generateDynamicThumbnail = React.useCallback(async () => {
    if (!asset?.duration || item.type !== 'video' || !('src' in item)) {
      return;
    }

    setIsGeneratingThumbnail(true);

    try {
      const videoSrc = item.src;
      const duration = asset.duration;
      const totalFrames = secondsToFrames(duration, state.fps);

      // 计算目标显示区域的高度和宽度（像素）
      const displayHeight = hasWaveform ? thumbnailHeight : itemHeight; // 与实际渲染一致
      const timelinePixelWidth = frameToPixels(item.durationInFrames, pixelsPerFrame);

      const canvasEl = thumbnailCanvasRef.current;
      const ctx = canvasEl?.getContext('2d');
      if (!canvasEl || !ctx) {
        setIsGeneratingThumbnail(false);
        return;
      }

      // 初始化画布尺寸并先填充全黑
      const destHeight = Math.max(16, Math.floor(displayHeight));
      canvasEl.width = Math.max(1, Math.ceil(timelinePixelWidth));
      canvasEl.height = destHeight;
      ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

      // Generate filmstrip progressively; avoid runtime logs in production

      // 1) Ensure we have a max-sample filmstrip cached for this asset
      const ensureFilmstrip = async (
        onSample?: (sampleIndex: number, entry: FilmstripCacheEntry) => void
      ): Promise<FilmstripCacheEntry> => {
        const cached = filmstripCache.get(videoSrc);
        if (cached && Math.abs(cached.duration - duration) < 0.001) {
          return cached;
        }

        const video = document.createElement('video');
        video.src = videoSrc;
        video.crossOrigin = 'anonymous';
        video.preload = 'metadata';

        await new Promise<void>((resolve, reject) => {
          const onLoaded = () => resolve();
          const onError = () => reject(new Error('video metadata error'));
          video.addEventListener('loadedmetadata', onLoaded, { once: true });
          video.addEventListener('error', onError, { once: true });
        });

        const BASE_HEIGHT = 80; // 基础缓存高度
        const frameHeight = BASE_HEIGHT;
        const frameWidth = Math.max(1, Math.floor((video.videoWidth / video.videoHeight) * frameHeight));

        // 设定最大缓存帧数，并将画布做成网格，避免超大宽度
        const MAX_CACHE_FRAMES = 360; // 例如每秒6帧*60秒
        const sampleCount = Math.min(MAX_CACHE_FRAMES, totalFrames);
        const framesPerRow = 60; // 网格每行放置帧数，控制宽度
        const rows = Math.ceil(sampleCount / framesPerRow);

        const filmstrip = document.createElement('canvas');
        filmstrip.width = frameWidth * Math.min(sampleCount, framesPerRow);
        filmstrip.height = frameHeight * rows;
        const fctx = filmstrip.getContext('2d');
        if (!fctx) {
          throw new Error('Cannot get filmstrip context');
        }

        const interval = duration / Math.max(sampleCount, 1);
        for (let i = 0; i < sampleCount; i++) {
          const time = Math.min(i * interval, Math.max(0, duration - 0.05));
          await new Promise<void>((resolveSeek) => {
            const seeked = () => {
              video.removeEventListener('seeked', seeked);
              resolveSeek();
            };
            video.addEventListener('seeked', seeked);
            video.currentTime = time;
          });

          const row = Math.floor(i / framesPerRow);
          const col = i % framesPerRow;
          const dx = col * frameWidth;
          const dy = row * frameHeight;
          fctx.drawImage(
            video,
            0, 0, video.videoWidth, video.videoHeight,
            dx, dy, frameWidth, frameHeight
          );

          if (onSample) {
            onSample(i, {
              canvas: filmstrip,
              frameWidth,
              frameHeight,
              framesPerRow,
              sampleCount,
              duration,
            });
          }
        }

        const entry: FilmstripCacheEntry = {
          canvas: filmstrip,
          frameWidth,
          frameHeight,
          framesPerRow,
          sampleCount,
          duration,
        };
        filmstripCache.set(videoSrc, entry);
        return entry;
      };

      // Helpers to map columns to sample indices and draw
      const drawFromEntry = (entry: FilmstripCacheEntry) => {
        const destFrameWidth = Math.max(1, Math.floor(entry.frameWidth * (destHeight / entry.frameHeight)));
        const columns = Math.max(1, Math.ceil(timelinePixelWidth / destFrameWidth));
        const colToIdx: number[] = new Array(columns);
        for (let col = 0; col < columns; col++) {
          const ratio = columns === 1 ? 0 : col / (columns - 1);
          colToIdx[col] = Math.min(entry.sampleCount - 1, Math.max(0, Math.round(ratio * (entry.sampleCount - 1))));
        }

        const BATCH = 8;
        let col = 0;
        const step = () => {
          const end = Math.min(columns, col + BATCH);
          for (; col < end; col++) {
            const idx = colToIdx[col];
            const srcRow = Math.floor(idx / entry.framesPerRow);
            const srcCol = idx % entry.framesPerRow;
            const sx = srcCol * entry.frameWidth;
            const sy = srcRow * entry.frameHeight;
            const dx = col * destFrameWidth;
            ctx.drawImage(entry.canvas, sx, sy, entry.frameWidth, entry.frameHeight, dx, 0, destFrameWidth, destHeight);
          }
          if (col < columns) requestAnimationFrame(step);
          else setIsGeneratingThumbnail(false);
        };
        requestAnimationFrame(step);
      };

      const cached = filmstripCache.get(videoSrc);
      if (cached && Math.abs(cached.duration - duration) < 0.001) {
        drawFromEntry(cached);
      } else {
        // Build cache and progressively paint as samples become available
        let mapped = false;
        let entryForMap: FilmstripCacheEntry | null = null;
        let destFrameWidth = 1;
        let columns = 1;
        let colToIdx: number[] = [];
        let idxToCols: number[][] = [];

        await ensureFilmstrip((readyIdx, entry) => {
          if (!mapped) {
            entryForMap = entry;
            destFrameWidth = Math.max(1, Math.floor(entry.frameWidth * (destHeight / entry.frameHeight)));
            columns = Math.max(1, Math.ceil(timelinePixelWidth / destFrameWidth));
            colToIdx = new Array(columns);
            idxToCols = new Array(entry.sampleCount).fill(null).map(() => []);
            for (let col = 0; col < columns; col++) {
              const ratio = columns === 1 ? 0 : col / (columns - 1);
              const idx = Math.min(entry.sampleCount - 1, Math.max(0, Math.round(ratio * (entry.sampleCount - 1))));
              colToIdx[col] = idx;
              idxToCols[idx].push(col);
            }
            mapped = true;
          }

          if (!entryForMap) return;
          const cols = idxToCols[readyIdx];
          if (cols && cols.length) {
            for (const c of cols) {
              const idx = colToIdx[c];
              const srcRow = Math.floor(idx / entryForMap.framesPerRow);
              const srcCol = idx % entryForMap.framesPerRow;
              const sx = srcCol * entryForMap.frameWidth;
              const sy = srcRow * entryForMap.frameHeight;
              const dx = c * destFrameWidth;
              ctx.drawImage(entry.canvas, sx, sy, entryForMap.frameWidth, entryForMap.frameHeight, dx, 0, destFrameWidth, destHeight);
            }
          }
        });
        setIsGeneratingThumbnail(false);
      }
    } catch (error) {
      console.error('Error generating dynamic thumbnail:', error);
      setIsGeneratingThumbnail(false);
    }
  }, [asset?.duration, item, pixelsPerFrame, thumbnailHeight, itemHeight, hasWaveform]);

  // Regenerate on mount and when zoom changes meaningfully
  const didInitRef = React.useRef(false);
  React.useEffect(() => {
    if (!didInitRef.current) {
      didInitRef.current = true;
      lastZoomRef.current = pixelsPerFrame;
      generateDynamicThumbnail();
      return;
    }

    const zoomChanged = Math.abs(pixelsPerFrame - lastZoomRef.current) > 0.01;
    if (zoomChanged && !isGeneratingThumbnail) {
      lastZoomRef.current = pixelsPerFrame;
      generateDynamicThumbnail();
    }
  }, [pixelsPerFrame, generateDynamicThumbnail, isGeneratingThumbnail, item.id]);

  // Also regenerate when waveform availability toggles (e.g., when item.waveform loads)
  const prevHasWaveformRef = React.useRef<boolean | null>(null);
  React.useEffect(() => {
    if (prevHasWaveformRef.current === hasWaveform) return;
    prevHasWaveformRef.current = hasWaveform;
    if (hasWaveform && !isGeneratingThumbnail) {
      generateDynamicThumbnail();
    }
  }, [hasWaveform, isGeneratingThumbnail, generateDynamicThumbnail]);

  // Revoke previously created object URLs to avoid memory leaks and reduce flicker
  const prevThumbUrlRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (prevThumbUrlRef.current && prevThumbUrlRef.current !== dynamicThumbnail) {
      URL.revokeObjectURL(prevThumbUrlRef.current);
    }
    prevThumbUrlRef.current = dynamicThumbnail;
  }, [dynamicThumbnail]);

  // Use dynamic thumbnail if available, otherwise fallback to static one
  const displayThumbnail = dynamicThumbnail || thumbnail;
  const isDynamicReady = Boolean(dynamicThumbnail);

  // (removed) Previously used to stretch thumbnail to fit width.
  // Match 3:7 ratio when video has waveform; otherwise keep previous calculation
  const waveformHeight = hasWaveform
    ? (hasVideoWithThumbnail
      ? Math.max(0, availableHeight - thumbnailHeight)
      : availableHeight - thumbnailHeight)
    : 0;

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
    // 计算应该显示波形的哪一部分
    let visibleWaveform = waveform;
    if (asset?.duration) {
      const totalFrames = secondsToFrames(asset.duration, state.fps);
      const currentFrames = item.durationInFrames;
      // 截取波形数据：只显示当前item时长对应的部分
      const endIndex = Math.floor(waveform.length * (currentFrames / totalFrames));
      visibleWaveform = waveform.slice(0, Math.max(1, endIndex));
    }

    const barCount = visibleWaveform.length;
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
        {visibleWaveform.map((peak, i) => {
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
      // Auto-scroll support when resizing towards edges
      // Find the horizontal scroll container (tracks viewport)
      const viewportEl = (e.currentTarget as HTMLElement).closest('.tracks-viewport') as HTMLDivElement | null;
      const SCROLL_EDGE = 40; // px from edge to start autoscroll
      const MAX_STEP = 40; // px per mousemove tick (capped)

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const deltaFrames = Math.round(deltaX / pixelsPerFrame);
        onResize?.(edge, deltaFrames);

        // Auto-scroll horizontally if cursor nears viewport edges
        if (viewportEl) {
          const vr = viewportEl.getBoundingClientRect();
          const x = moveEvent.clientX;
          let step = 0;
          if (x > vr.right - SCROLL_EDGE) {
            step = Math.min(MAX_STEP, (x - (vr.right - SCROLL_EDGE)) * 0.5);
          } else if (x < vr.left + SCROLL_EDGE) {
            step = -Math.min(MAX_STEP, ((vr.left + SCROLL_EDGE) - x) * 0.5);
          }
          if (step !== 0) {
            viewportEl.scrollLeft += step;
          }
        }
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
    // Forward to parent; avoid debug logs in production
    if (onDragStartProp) {
      onDragStartProp(e);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    if (onDragEndProp) {
      onDragEndProp(e);
    }
  };

  // dnd-kit draggable (overlay-only integration; does not alter static layout)
  // DragOverlay中的item不需要draggable
  const draggableHook = useDraggable({
    id: `item-${item.id}`,
    data: {
      item,
      trackId,
      from: item.from,
      durationInFrames: item.durationInFrames,
    },
    disabled: isDragOverlay, // DragOverlay中禁用draggable
  });
  
  const {attributes, listeners, setNodeRef, isDragging, transform} = isDragOverlay 
    ? { attributes: {}, listeners: {}, setNodeRef: () => {}, isDragging: false, transform: null }
    : draggableHook;

  // Decoupled renderers: first enable for image/text, others keep existing path
  const useNewRenderer = item.type === 'image' || item.type === 'text';
  const Renderer = React.useMemo(() => getRendererForItem(item), [item.type]);

  return (
    <div
      // dnd-kit takes over dragging; disable native dragging to avoid conflicts
      draggable={false}
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-dnd-id={`item-${item.id}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
      onDoubleClick={handleTextEdit}
      style={{
        position: isDragOverlay ? undefined : 'absolute',
        left: isDragOverlay ? undefined : frameToPixels(item.from, pixelsPerFrame),
        width: width,
        height: `${itemHeight}px`,
        top: isDragOverlay ? undefined : '50%',
        transform: isDragOverlay ? undefined : 'translateY(-50%)',
        backgroundColor: getColor(),
        borderRadius: '4px',
        border: isSelected
          ? `${borderSize}px solid #ffffff`
          : `${borderSize}px solid rgba(0,0,0,0.2)`,
        cursor: 'move',
        overflow: 'hidden',
        boxSizing: 'border-box',
        backgroundImage: (useNewRenderer || hasWaveform || item.type === 'audio') ? 'none' : (displayThumbnail ? `url(${displayThumbnail})` : 'none'),
        // Dynamic ready -> 'auto 100%'; fallback poster -> 'cover' to fill width immediately
        backgroundSize: useNewRenderer ? 'cover' : (item.type === 'image' ? 'contain' : (isDynamicReady ? 'auto 100%' : 'cover')),
        backgroundPosition: 'left top',
        backgroundRepeat: 'no-repeat',
        opacity: isDragging ? 0 : (track.hidden ? 0.3 : 1),
        outline: isDragging ? '1px dashed rgba(0, 153, 255, 0.8)' : 'none',
        ...customStyle, // 应用自定义样式（可以覆盖默认样式，如opacity）
      }}
    >
      {/* New renderer (image/text) */}
      {useNewRenderer && (
        <div style={{ position: 'absolute', inset: 0 }}>
          <Renderer item={item} asset={asset} width={width} height={itemHeight} pixelsPerFrame={pixelsPerFrame} />
        </div>
      )}
      {/* Thumbnail for video with waveform */}
      {item.type === 'video' && hasWaveform && (
        <div
          data-thumbnail-id={item.id}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: `${thumbnailHeight}px`,
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <canvas
            ref={thumbnailCanvasRef}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
            }}
          />
        </div>
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
