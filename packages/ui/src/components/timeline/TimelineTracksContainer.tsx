import React, { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useEditor } from '@remotion-fast/core';
import type { Track, Asset, Item } from '@remotion-fast/core';
import { colors, timeline, spacing, shadows, getItemColor, withOpacity, borderRadius } from './styles';
import { secondsToFrames } from './utils/timeFormatter';
import { TimelineItem } from './TimelineItem';
import { currentDraggedAsset } from '../AssetPanel';
import { calculateResizeSnap } from './utils/snapCalculator';

// Declare the global window property for TypeScript
declare global {
  interface Window {
    currentDraggedItem: { item: Item; trackId: string } | null;
  }
}

// Tracks viewport + labels with drag/drop and scroll syncing.
// Notes:
// - `onScrollXChange` keeps ruler and playhead horizontally aligned with tracks.
// - `viewportWidth` prevents empty timeline from scrolling and keeps ruler/track widths stable.
interface TimelineTracksContainerProps {
  durationInFrames: number;
  pixelsPerFrame: number;
  fps: number;
  snapEnabled?: boolean;
  selectedTrackId: string | null;
  selectedItemId: string | null;
  assets: Asset[];
  onSelectTrack: (trackId: string) => void;
  onSelectItem: (itemId: string) => void;
  onDeleteItem: (trackId: string, itemId: string) => void;
  onUpdateItem: (trackId: string, itemId: string, updates: Partial<Item>) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (trackId: string, e: React.DragEvent) => void;
  onEmptyDrop: (e: React.DragEvent) => void;
  onItemDragStart: (e: React.DragEvent, trackId: string, item: Item) => void;
  onItemDragOver: (e: React.DragEvent, trackId: string) => void;
  onItemDrop: (e: React.DragEvent, trackId: string) => void;
  onItemDragEnd: () => void;
  dragPreview: {
    itemId: string;
    item: Item;
    originalTrackId: string;
    originalFrom: number;
    previewTrackId: string;
    previewFrame: number;
    // Optional raw snapped frame before any collision push; used when creating new tracks
    rawPreviewFrame?: number;
    // Snap visualization
    snapEdge?: 'left' | 'right' | null;
    snapTargetType?: 'item-start' | 'item-end' | 'playhead' | 'track-start' | 'grid' | undefined | null;
    snapGuideFrame?: number | null;
  } | null;
  // Horizontal scroll sync – report viewport scrollLeft to parent
  onScrollXChange?: (scrollLeft: number) => void;
  // Available viewport content width (without labels), used to clamp min width
  viewportWidth?: number;
  // If provided, render labels panel into this element via portal
  labelsPortal?: HTMLElement | null;
  // Visual left inset for right content (px). Applied as padding on the tracks viewport.
  contentInsetLeftPx?: number;
  // External insert position (for dnd-kit drags). If provided, overrides internal detection
  externalInsertPosition?: number | null;
}

// Store dragged data globally to work around dataTransfer issues
let globalDragData: { assetId?: string; quickAdd?: string; quickAddType?: string; asset?: string } = {};

export const TimelineTracksContainer: React.FC<TimelineTracksContainerProps> = ({
  durationInFrames,
  pixelsPerFrame,
  fps,
  snapEnabled = true,
  selectedTrackId,
  selectedItemId,
  assets,
  onSelectTrack,
  onSelectItem,
  onDeleteItem,
  onUpdateItem,
  onDragOver,
  onDrop,
  onEmptyDrop,
  onItemDragStart,
  onItemDragOver,
  onItemDrop,
  onItemDragEnd,
  dragPreview,
  onScrollXChange,
  viewportWidth,
  labelsPortal,
  contentInsetLeftPx,
  externalInsertPosition,
}) => {
  const { state, dispatch } = useEditor();
  const { tracks } = state;

  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const gapRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const handleInsertDropRef = useRef<((e: React.DragEvent, position: number) => void) | null>(null);
  const syncingRef = useRef(false); // Prevent circular scroll sync
  const rafIdRef = useRef<number | null>(null); // For autoscroll animation

  const [scrollSync, setScrollSync] = useState({ x: 0, y: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);
  // Prefer external insert position (from dnd-kit drag) when provided
  const effectiveInsertPosition = externalInsertPosition ?? insertPosition;
  // Keep the track labels vertically aligned with tracks when a horizontal
  // scrollbar appears in the tracks viewport (e.g. on Windows where scrollbars take space).
  // We measure the horizontal scrollbar height and add equivalent bottom padding to the
  // left labels panel so both columns end at the same visual baseline.
  const [hScrollbar, setHScrollbar] = useState(0);

  const measureScrollbars = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    // Horizontal scrollbar thickness (height) = offsetHeight - clientHeight
    const horiz = Math.max(0, vp.offsetHeight - vp.clientHeight);
    // Only update when changed to avoid re-renders while scrolling
    setHScrollbar((prev) => (prev !== horiz ? horiz : prev));
  }, []);

  // Compute preview item height to match actual item render sizing
  const getPreviewItemHeight = useCallback((item: Item): number => {
    // Waveform items (audio/video with waveform) are taller
    const hasWaveform = (item.type === 'audio' || item.type === 'video') && (item as any).waveform;
    // Video with waveform + thumbnail is slightly taller in actual renderer
    let hasVideoWithThumbnail = false;
    if (item.type === 'video' && hasWaveform && 'src' in item) {
      const asset = assets.find((a) => a.src === (item as any).src);
      hasVideoWithThumbnail = !!asset?.thumbnail;
    }
    if (hasVideoWithThumbnail) return 60;
    if (hasWaveform) return 56;
    return 44;
  }, [assets]);

  // Sync from viewport (only true scroll source) to labels and gap
  const syncFromViewport = useCallback(() => {
    if (!viewportRef.current) return;
    const top = viewportRef.current.scrollTop;
    syncingRef.current = true;
    if (labelsRef.current) labelsRef.current.scrollTop = top;
    if (gapRef.current) gapRef.current.scrollTop = top;
    syncingRef.current = false;
  }, []);

  // 同步垂直滚动（标签面板 ↔ gap ↔ 轨道视口）
  // Sync vertical scroll between labels, gap, and tracks; report horizontal scroll to parent.
  // Also enforce hard boundary to prevent scrolling beyond actual tracks content.
  const handleViewportScroll = useCallback(() => {
    if (viewportRef.current) {
      const vp = viewportRef.current;

      // Calculate hard boundary: don't scroll beyond actual tracks content
      const maxScrollTop = Math.max(0, tracks.length * timeline.trackHeight - vp.clientHeight);

      // Clamp scroll position to valid range
      if (vp.scrollTop > maxScrollTop) {
        vp.scrollTop = maxScrollTop;
        return; // Don't sync if we just clamped
      }

      syncFromViewport();
      setScrollSync(prev => ({ ...prev, y: vp.scrollTop }));

      // Sync horizontal scroll to consumers (ruler, playhead, etc.)
      const scrollLeft = vp.scrollLeft;
      setScrollSync(prev => ({ ...prev, x: scrollLeft }));
      onScrollXChange?.(scrollLeft);
      // Re-measure in case scrollbar visibility changed while scrolling
      measureScrollbars();
    }
  }, [onScrollXChange, measureScrollbars, syncFromViewport, tracks.length]);

  // Optional: if labels scroll detected (e.g. user wheel over labels), drive viewport
  const handleLabelsScroll = useCallback(() => {
    if (!syncingRef.current && labelsRef.current && viewportRef.current) {
      viewportRef.current.scrollTop = labelsRef.current.scrollTop;
    }
  }, []);

  // Measure on mount and whenever layout-affecting props change
  useEffect(() => {
    measureScrollbars();
    const onResize = () => measureScrollbars();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [measureScrollbars, durationInFrames, pixelsPerFrame, viewportWidth]);

  // #4 Prevent scroll bubbling to window during drag
  useEffect(() => {
    if (!isDraggingOver) return;
    const root = document.documentElement;
    const body = document.body;
    const prevDoc = root.style.overscrollBehavior;
    const prevBody = body.style.overscrollBehavior;
    root.style.overscrollBehavior = 'contain';
    body.style.overscrollBehavior = 'contain';
    return () => {
      root.style.overscrollBehavior = prevDoc;
      body.style.overscrollBehavior = prevBody;
    };
  }, [isDraggingOver]);

  // #5 Custom edge autoscroll - only scrolls viewport, not other containers
  // Also enforces hard boundary: max scroll = tracks.length * trackHeight
  const autoScrollOnEdge = useCallback((e: React.DragEvent) => {
    if (!viewportRef.current) return;
    const vp = viewportRef.current;
    const rect = vp.getBoundingClientRect();
    const y = e.clientY;

    const AUTO_SCROLL_MARGIN = 32;
    const MAX_STEP = 32;

    // Calculate hard boundary: don't scroll beyond actual tracks content
    const maxScrollTop = Math.max(0, tracks.length * timeline.trackHeight - vp.clientHeight);

    let delta = 0;
    if (y < rect.top + AUTO_SCROLL_MARGIN) {
      delta = -Math.min(MAX_STEP, rect.top + AUTO_SCROLL_MARGIN - y);
    } else if (y > rect.bottom - AUTO_SCROLL_MARGIN) {
      // Only scroll down if not at hard boundary
      if (vp.scrollTop < maxScrollTop) {
        delta = Math.min(MAX_STEP, y - (rect.bottom - AUTO_SCROLL_MARGIN));
      }
    }

    if (delta !== 0) {
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = requestAnimationFrame(() => {
        // Clamp to [0, maxScrollTop]
        const next = Math.max(0, Math.min(vp.scrollTop + delta, maxScrollTop));
        if (next !== vp.scrollTop) {
          vp.scrollTop = next;
          syncFromViewport(); // Keep all columns synced
        }
      });
    }
  }, [syncFromViewport, tracks.length]);

  // 拖放处理
  const handleContainerDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);

    // Store drag data globally when entering
    globalDragData = {
      assetId: e.dataTransfer.getData('assetId') || e.dataTransfer.getData('text/plain'),
      quickAdd: e.dataTransfer.getData('quickAdd'),
      quickAddType: e.dataTransfer.getData('quickAddType'),
      asset: e.dataTransfer.getData('asset'),
    };
  }, []);

  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    // 检查是否是真正离开容器（触控板可能在这里"drop"）
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isOutside =
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom;

    if (isOutside) {
      // 触控板 workaround: 如果有 insertPosition，视为 drop 操作
      if (insertPosition !== null) {
        // 执行 drop 逻辑
        const currentInsertPosition = insertPosition;
        setIsDraggingOver(false);
        setInsertPosition(null);

        if (handleInsertDropRef.current) {
          handleInsertDropRef.current(e, currentInsertPosition);
        }
        return;
      }

      setIsDraggingOver(false);
      setInsertPosition(null);
    }
  }, [insertPosition]);

  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); // CRITICAL: Must prevent default to allow drop
    e.dataTransfer.dropEffect = 'copy'; // CRITICAL: Must match effectAllowed from drag source
    onDragOver(e); // Call the parent's handler
  }, [onDragOver]);

  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    const currentInsertPosition = effectiveInsertPosition;
    setInsertPosition(null);

    // 如果有插入位置，调用 handleInsertDrop
    if (currentInsertPosition !== null) {
      if (handleInsertDropRef.current) {
        handleInsertDropRef.current(e, currentInsertPosition);
      }
      return;
    }

    // 如果没有轨道，调用空状态的 drop 处理
    if (tracks.length === 0) {
      onEmptyDrop(e);
    }
  }, [tracks.length, onEmptyDrop, effectiveInsertPosition]);

  // 检测鼠标是否在两个轨道之间
  const detectInsertPosition = useCallback((e: React.DragEvent) => {
    if (!viewportRef.current) return;

    // 如果timeline是空的，总是在位置0插入新轨道
    if (tracks.length === 0) {
      setInsertPosition(0);
      return 0;
    }

    const rect = viewportRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + viewportRef.current.scrollTop;
    const trackIndex = Math.floor(y / timeline.trackHeight);
    const relativeY = y % timeline.trackHeight;

    // 如果鼠标在轨道边界附近（上下 20px 范围内，增加容错范围）
    if (relativeY < 20 || relativeY > timeline.trackHeight - 20) {
      // 计算插入位置
      const position = relativeY < 20 ? trackIndex : trackIndex + 1;
      if (position >= 0 && position <= tracks.length) {
        setInsertPosition(position);
        return position;
      }
    }

    setInsertPosition(null);
    return null;
  }, [tracks.length]);

  // 处理轨道间插入
  const handleInsertDrop = useCallback((e: React.DragEvent, position: number) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if this is an existing item being moved
    const dragType = e.dataTransfer.getData('dragType');
    const itemId = e.dataTransfer.getData('itemId');
    const sourceTrackId = e.dataTransfer.getData('trackId');


    if (dragType === 'item' || window.currentDraggedItem) {
      // Moving an existing item to a new track

      const itemToMove = window.currentDraggedItem?.item;
      const sourceTrack = window.currentDraggedItem?.trackId || sourceTrackId;


      if (!itemToMove || !sourceTrack) {
        console.error('ERROR: Missing item or source track information');
        console.error('  - itemToMove:', itemToMove);
        console.error('  - sourceTrack:', sourceTrack);
        return;
      }

      // 立即清除window.currentDraggedItem，防止dragOver继续处理
      window.currentDraggedItem = null;

      // 找到当前item所在的实际track（可能已经被dragOver移动过）
      const currentTrack = tracks.find(t => t.items.some(i => i.id === itemToMove.id));
      const actualSourceTrackId = currentTrack?.id || sourceTrack;


      // Create new track with the item already in it
      // This way we avoid the issue of REMOVE_ITEM auto-deleting empty tracks
      const newTrack = {
        id: `track-${Date.now()}`,
        name: itemToMove.type.charAt(0).toUpperCase() + itemToMove.type.slice(1),
        items: [itemToMove]  // Start with the item already in the track
      };

      // Insert new track at the specified position (with item already in it)
      dispatch({
        type: 'INSERT_TRACK',
        payload: { track: newTrack, index: position }
      });

      // Then remove item from the source track
      setTimeout(() => {
        dispatch({
          type: 'REMOVE_ITEM',
          payload: { trackId: actualSourceTrackId, itemId: itemToMove.id }
        });

        // Select the moved item
        dispatch({ type: 'SELECT_ITEM', payload: itemToMove.id });
      }, 0);

      return;
    }

    // Otherwise, handle creating new items from assets
    // Try to get assetId from multiple sources, fallback to global data
    let assetId = e.dataTransfer.getData('assetId') ||
                  e.dataTransfer.getData('text/plain') ||
                  globalDragData.assetId;

    const isQuickAdd = (e.dataTransfer.getData('quickAdd') || globalDragData.quickAdd) === 'true';
    const quickAddType = e.dataTransfer.getData('quickAddType') || globalDragData.quickAddType;
    const assetData = e.dataTransfer.getData('asset') || globalDragData.asset;

    // If we still don't have assetId, try to get it from currentDraggedAsset
    let finalIsQuickAdd = isQuickAdd;
    let finalQuickAddType = quickAddType;

    if (!assetId && currentDraggedAsset) {
      assetId = currentDraggedAsset.id;
      if (currentDraggedAsset.quickAdd) {
        finalIsQuickAdd = true;
        finalQuickAddType = currentDraggedAsset.quickAddType;
      }
    }


    // 创建新轨道并插入到指定位置
    const itemType = finalIsQuickAdd ? finalQuickAddType :
                    (assets.find(a => a.id === assetId)?.type || 'Track');
    const newTrack = {
      id: `track-${Date.now()}`,
      name: itemType.charAt(0).toUpperCase() + itemType.slice(1),
      items: []
    };

    // 插入轨道到指定位置
    dispatch({
      type: 'INSERT_TRACK',
      payload: { track: newTrack, index: position }
    });

    // 添加素材到新轨道
    setTimeout(() => {
      let newItem: any = null;

      if (finalIsQuickAdd) {
        // Handle quick add items
        if (finalQuickAddType === 'text') {
          newItem = {
            id: `text-${Date.now()}`,
            type: 'text',
            text: 'Double click to edit',
            color: '#000000',
            from: 0,
            durationInFrames: 90,
            fontSize: 60,
          };
        } else if (finalQuickAddType === 'solid') {
          newItem = {
            id: `solid-${Date.now()}`,
            type: 'solid',
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            from: 0,
            durationInFrames: 60,
          };
        }
      } else {
        // Handle regular assets
        const asset = assets.find(a => a.id === assetId) || currentDraggedAsset;
        if (!asset) {
          console.error('No asset found for id:', assetId);
          return;
        }

        switch (asset.type) {
          case 'video':
            newItem = {
              id: `item-${Date.now()}`,
              type: 'video',
              from: 0,
              durationInFrames: (asset && asset.duration) ? secondsToFrames(asset.duration, fps) : 90,
              src: asset ? asset.src : '',
              waveform: asset ? asset.waveform : undefined,
            };
            break;
          case 'audio':
            newItem = {
              id: `item-${Date.now()}`,
              type: 'audio',
              from: 0,
              durationInFrames: asset.duration ? secondsToFrames(asset.duration, fps) : 90,
              src: asset.src,
              waveform: asset.waveform,
            };
            break;
          case 'image':
            newItem = {
              id: `item-${Date.now()}`,
              type: 'image',
              from: 0,
              durationInFrames: 90,
              src: asset.src,
            };
            break;
        }
      }

      if (newItem) {
        dispatch({
          type: 'ADD_ITEM',
          payload: { trackId: newTrack.id, item: newItem }
        });
        dispatch({ type: 'SELECT_ITEM', payload: newItem.id });
      }
    }, 0);
  }, [assets, dispatch]);

  // 更新 handleInsertDrop 的 ref
  useEffect(() => {
    handleInsertDropRef.current = handleInsertDrop;
  }, [handleInsertDrop]);

  // 扩展拖动悬停处理
  const handleTrackAreaDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault(); // CRITICAL: Must prevent default to allow drop
    e.dataTransfer.dropEffect = 'copy'; // CRITICAL: Must match effectAllowed from drag source
    onDragOver(e);
    detectInsertPosition(e);
    autoScrollOnEdge(e); // Custom controlled autoscroll
  }, [onDragOver, detectInsertPosition, autoScrollOnEdge]);

  // Keep content at least as wide as the viewport to avoid empty scroll area on empty timeline
  const totalWidth = Math.max(durationInFrames * pixelsPerFrame, viewportWidth ?? 0);

  const content = (
    <div
      ref={containerRef}
      className="timeline-tracks-container"
      style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        background: isDraggingOver ? colors.bg.hover : colors.bg.primary,
        borderRadius: 4,
        margin: 0,
        boxShadow: shadows.sm,
        border: 0,
        position: 'relative',
        // #2 Lock outer container height - prevents infinite growth
        height: 480, // Fixed height or could use timeline.height if defined
      }}
      onDragEnter={handleContainerDragEnter}
      onDragLeave={handleContainerDragLeave}
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
    >
      {/* 左侧标签面板（若提供 labelsPortal 则不内联渲染） */}
      {!labelsPortal && (
        <div
          ref={labelsRef}
          className="track-labels-panel"
          style={{
            width: timeline.trackLabelWidth,
            flexShrink: 0,
            background: colors.bg.secondary,
            borderRight: 0,
            // #1 Only viewport can scroll vertically, labels are synced via JS
            height: '100%',
            overflowY: 'hidden',
            overflowX: 'hidden',
            position: 'relative',
            zIndex: 10,
            marginRight: -(spacing.lg - 1),
            // Reserve space equal to the horizontal scrollbar in the tracks viewport
            // so the last row aligns when scrolled to bottom (esp. on Windows).
            paddingBottom: hScrollbar,
            // 隐藏滚动条但保持可滚动
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
          onScroll={handleLabelsScroll}
        >
          <style>{`
            .track-labels-panel::-webkit-scrollbar { display: none; }
          `}</style>

          {tracks.length === 0 ? (
            <div
              style={{
                height: 200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text.tertiary,
                fontSize: 12,
                padding: spacing.md,
                textAlign: 'center',
              }}
            >
              轨道标签
            </div>
          ) : (
            tracks.map((track) => (
              <div
                key={track.id}
                style={{
                  height: timeline.trackHeight,
                  borderBottom: `1px solid ${colors.border.default}`,
                  padding: `${spacing.md}px`,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  background: selectedTrackId === track.id ? colors.bg.selected : 'transparent',
                  transition: 'background-color 0.15s ease',
                }}
                onClick={() => onSelectTrack(track.id)}
              >
                <div
                  style={{
                    color: colors.text.primary,
                    fontSize: 13,
                    fontWeight: 500,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {track.name}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Gap div - 分隔左右面板 */}
      <div
        ref={gapRef}
        className="timeline-gap"
        style={{
          width: spacing.lg,
          flexShrink: 0,
          background: 'transparent',
          position: 'relative',
          // #1 Only viewport can scroll vertically, gap is synced via JS
          height: '100%',
          overflowY: 'hidden',
          overflowX: 'hidden',
          zIndex: 1,
          // 隐藏滚动条但保持可滚动
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          pointerEvents: 'none',
        }}
      >
        <style>{`
          .timeline-gap::-webkit-scrollbar { display: none; }
        `}</style>
        {/* 内容容器 - 撑开高度以允许滚动 */}
        <div
          style={{
            position: 'relative',
            // #3 Don't use track height to push layout, just fill container
            minHeight: '100%',
            paddingBottom: hScrollbar,
          }}
        />
      </div>

      {/* 右侧轨道视口 */}
      <div
        ref={viewportRef}
        className="tracks-viewport"
        style={{
          flex: 1,
          // #2 Fill container height, be the only vertical scroll ancestor
          height: '100%',
          overflowX: 'auto',
          overflowY: 'auto',
          position: 'relative',
          minWidth: 0,
          paddingLeft: contentInsetLeftPx ?? 0,
          zIndex: 10,
          marginLeft: -(spacing.lg - 1),
          overscrollBehavior: 'contain',
        }}
        onScroll={handleViewportScroll}
        onDragOver={handleTrackAreaDragOver}
      >
        <div
          style={{
            position: 'relative',
            minWidth: totalWidth,
            minHeight: '100%',
          }}
          onDrop={(e) => {
            // Handle drops when inserting between tracks or at the end
            if (effectiveInsertPosition !== null) {
              e.preventDefault();
              e.stopPropagation();
              handleInsertDrop(e, effectiveInsertPosition);
              setInsertPosition(null);
            } else {
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy'; // CRITICAL: Must match effectAllowed from drag source
            // Only use internal detection when no external insert position is provided
            if (externalInsertPosition == null) {
              detectInsertPosition(e);
            }
          }}
        >
          {tracks.length === 0 ? (
            // 空状态 - 使用 pointerEvents: 'none' 让 drop 事件穿透到父元素
            <div
              style={{
                height: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text.tertiary,
                gap: spacing.lg,
                pointerEvents: 'none', // 让拖放事件穿透到父元素
              }}
            >
              <div style={{ fontSize: 48, opacity: 0.3 }}>🎬</div>
              <div style={{ fontSize: 16, fontWeight: 500 }}>开始你的创作</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                拖放素材到这里开始编辑
              </div>
            </div>
          ) : (
            // 轨道列表 - 只渲染轨道内容区，不包括标签
            tracks.map((track, index) => (
              <Fragment key={track.id}>
                {/* 插入指示器 - 轨道上方 */}
                {effectiveInsertPosition === index && (
                  <div
                    style={{
                      position: 'relative',
                      height: 2,
                      backgroundColor: colors.accent.primary,
                      marginTop: -1,
                      marginBottom: -1,
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: colors.accent.primary,
                      }}
                    />
                  </div>
                )}

                <div
                  style={{
                    height: timeline.trackHeight,
                    borderBottom: `1px solid transparent`,
                    position: 'relative',
                    backgroundColor: selectedTrackId === track.id ? colors.bg.selected : 'transparent',
                  }}
                  onClick={() => onSelectTrack(track.id)}
                  onDragOver={(e) => {
                    // 检测插入位置
                    const insertPos = detectInsertPosition(e);
                    // 只在不是插入位置时才处理item拖动
                    if (insertPos === null) {
                      onItemDragOver(e, track.id);
                    }
                  }}
                  onDrop={(e) => {
                    // Don't handle drops that are meant for insertion
                    if (insertPosition !== null) {
                      return;  // Let the container handle it
                    }

                    // Check if this is an item being dragged
                    const dragType = e.dataTransfer.getData('dragType');
                    if (dragType === 'item' && dragPreview) {
                      // Item drag - call onItemDrop
                      onItemDrop(e, track.id);
                    } else {
                      // Otherwise, add to existing track from asset panel
                      onDrop(track.id, e);
                    }
                  }}
                >
                  {/* 使用 TimelineItem 组件保留所有功能 */}
                  {track.items.map((item) => (
                    <TimelineItem
                      key={item.id}
                      item={item}
                      trackId={track.id}
                      track={track}
                      pixelsPerFrame={pixelsPerFrame}
                      isSelected={selectedItemId === item.id}
                      assets={assets}
                      onSelect={() => onSelectItem(item.id)}
                      onDelete={() => onDeleteItem(track.id, item.id)}
                      onUpdate={(itemId, updates) => onUpdateItem(track.id, itemId, updates)}
                      onDragStart={(e) => onItemDragStart(e, track.id, item)}
                      onDragEnd={onItemDragEnd}
                      onResize={(edge, deltaFrames) => {
                        // 获取视频/音频素材的最大时长限制（以帧为单位）
                        let maxDurationInFrames: number | undefined;
                        if ((item.type === 'video' || item.type === 'audio') && 'src' in item) {
                          const asset = assets.find((a) => a.src === item.src);
                          if (asset?.duration) {
                            // 将秒转换为帧 (按项目 fps)
                            maxDurationInFrames = Math.floor(asset.duration * fps);
                          }
                        }

                        let newFrom = item.from;
                        let newDuration = item.durationInFrames;

                        if (edge === 'left') {
                          const rawFrom = Math.max(0, item.from + deltaFrames);

                          // 应用吸附（左边缘）
                          const snapped = calculateResizeSnap(
                            rawFrom,
                            'left',
                            state.tracks,
                            item.id,
                            state.currentFrame,
                            !!snapEnabled,
                            timeline.snapThreshold
                          );
                          newFrom = snapped.snappedFrame;
                          newDuration = item.from + item.durationInFrames - newFrom;
                        } else {
                          const rawDuration = Math.max(15, item.durationInFrames + deltaFrames);
                          const rawRight = item.from + rawDuration;

                          // 应用吸附（右边缘）
                          const snapped = calculateResizeSnap(
                            rawRight,
                            'right',
                            state.tracks,
                            item.id,
                            state.currentFrame,
                            !!snapEnabled,
                            timeline.snapThreshold
                          );
                          newDuration = Math.max(15, snapped.snappedFrame - item.from);
                        }

                        // 限制最大时长不超过素材实际时长
                        if (maxDurationInFrames && newDuration > maxDurationInFrames) {
                          newDuration = maxDurationInFrames;
                        }

                        if (newDuration >= 15) {
                          onUpdateItem(track.id, item.id, {
                            from: newFrom,
                            durationInFrames: newDuration,
                          });
                        }
                      }}
                      // 如果是被拖动的item，让它半透明（仅在原生拖拽或资产拖拽预览时）
                      style={{
                        opacity: dragPreview?.itemId === item.id && !window.currentDraggedItem ? 0.3 : 1,
                      }}
                    />
                  ))}

                  {/* 渲染预览影子（在目标位置） - dnd 拖动已有项时不显示 */}
                  {dragPreview && dragPreview.previewTrackId === track.id && externalInsertPosition == null && (
                    <div
                      style={{
                        position: 'absolute',
                        left: dragPreview.previewFrame * pixelsPerFrame,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: dragPreview.item.durationInFrames * pixelsPerFrame,
                        height: getPreviewItemHeight(dragPreview.item),
                        backgroundColor: 'rgba(255,255,255,0.55)',
                        border: '1px solid rgba(255,255,255,0.9)',
                        borderRadius: timeline.itemBorderRadius,
                        boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(0,0,0,0.08)',
                        pointerEvents: 'none',
                        zIndex: 999,
                        boxSizing: 'border-box',
                        backdropFilter: 'saturate(110%)',
                      }}
                    />
                  )}
                </div>

                {/* 插入指示器 - 最后一个轨道下方 */}
                {effectiveInsertPosition === tracks.length && index === tracks.length - 1 && (
                  <div
                    style={{
                      position: 'relative',
                      height: 2,
                      backgroundColor: colors.accent.primary,
                      marginTop: -1,
                      zIndex: 10,
                      pointerEvents: 'none',
                    }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: colors.accent.primary,
                      }}
                    />
                  </div>
                )}
              </Fragment>
            ))
          )}

          {/* 垂直吸附指示线（对齐到其他素材边缘时显示） */}
          {dragPreview?.snapGuideFrame != null && (
            <div
              style={{
                position: 'absolute',
                left: dragPreview.snapGuideFrame * pixelsPerFrame,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: colors.accent.primary,
                opacity: 0.9,
                pointerEvents: 'none',
                zIndex: 50,
              }}
            />
          )}
        </div>
      </div>

      {/* 拖放指示器 */}
      {isDraggingOver && tracks.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: `${colors.accent.primary}10`,
            border: `2px dashed ${colors.accent.primary}`,
            borderRadius: 4,
            pointerEvents: 'none',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: colors.bg.elevated,
              padding: `${spacing.lg}px ${spacing.xxl}px`,
              borderRadius: 6,
              boxShadow: shadows.lg,
              color: colors.text.primary,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            松开以添加到时间轴
          </div>
        </div>
      )}
    </div>
  );

  // Optional: Render labels panel externally using a portal
  if (labelsPortal) {
    const labelsNode = (
      <div
        ref={labelsRef}
        className="track-labels-panel"
        style={{
          width: timeline.trackLabelWidth,
          flexShrink: 0,
          background: colors.bg.secondary,
          borderRight: `1px solid ${colors.border.default}`,
          // #1 Only viewport can scroll vertically, labels are synced via JS
          height: '100%',
          overflowY: 'hidden',
          overflowX: 'hidden',
          position: 'sticky',
          left: 0,
          zIndex: 30,
          paddingBottom: hScrollbar,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        onScroll={handleLabelsScroll}
      >
        <style>{`.track-labels-panel::-webkit-scrollbar{display:none;}`}</style>
        {tracks.length === 0 ? (
          <div
            style={{
              height: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: colors.text.tertiary,
              fontSize: 12,
              padding: spacing.md,
              textAlign: 'center',
            }}
          >
            轨道标签
          </div>
        ) : (
          tracks.map((track) => (
            <div
              key={track.id}
              style={{
                height: timeline.trackHeight,
                borderBottom: `1px solid ${colors.border.default}`,
                padding: `${spacing.md}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                background: selectedTrackId === track.id ? colors.bg.selected : 'transparent',
                transition: 'background-color 0.15s ease',
              }}
              onClick={() => onSelectTrack(track.id)}
            >
              <div
                style={{
                  color: colors.text.primary,
                  fontSize: 13,
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {track.name}
              </div>
            </div>
          ))
        )}
      </div>
    );

    return (
      <>
        {createPortal(labelsNode, labelsPortal)}
        {content}
      </>
    );
  }

  return content;
};
