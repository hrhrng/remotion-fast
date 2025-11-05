import React, { useState, useCallback, useRef } from 'react';
import { useEditor } from '@remotion-fast/core';
import type { Item } from '@remotion-fast/core';
import { TimelineHeader } from './timeline/TimelineHeader';
import { TimelineRuler } from './timeline/TimelineRuler';
import { TimelineTracksContainer } from './timeline/TimelineTracksContainer';
import { TimelinePlayhead } from './timeline/TimelinePlayhead';
import { useKeyboardShortcuts } from './timeline/hooks/useKeyboardShortcuts';
import { colors, timeline as timelineStyles, typography } from './timeline/styles';
import { getPixelsPerFrame, pixelsToFrame, frameToPixels } from './timeline/utils/timeFormatter';
import { calculateSnap } from './timeline/utils/snapCalculator';

export const Timeline: React.FC = () => {
  const { state, dispatch } = useEditor();
  const {
    tracks,
    selectedItemId,
    selectedTrackId,
    currentFrame,
    zoom,
    fps,
    durationInFrames,
    assets,
    playing,
  } = state;

  const [snapEnabled, setSnapEnabled] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const pixelsPerFrame = getPixelsPerFrame(zoom);

  // ==================== 缩放控制 ====================
  const handleZoomIn = useCallback(() => {
    if (zoom < timelineStyles.zoomMax) {
      dispatch({ type: 'SET_ZOOM', payload: Math.min(zoom + 0.25, timelineStyles.zoomMax) });
    }
  }, [zoom, dispatch]);

  const handleZoomOut = useCallback(() => {
    if (zoom > timelineStyles.zoomMin) {
      dispatch({ type: 'SET_ZOOM', payload: Math.max(zoom - 0.25, timelineStyles.zoomMin) });
    }
  }, [zoom, dispatch]);

  // ==================== 播放头控制 ====================
  const handleSeek = useCallback(
    (frame: number) => {
      dispatch({ type: 'SET_CURRENT_FRAME', payload: Math.max(0, Math.min(frame, durationInFrames)) });
    },
    [dispatch, durationInFrames]
  );

  // ==================== 轨道操作 ====================
  const handleAddTrack = useCallback(() => {
    const newTrack = {
      id: `track-${Date.now()}`,
      name: 'Track',
      items: [],
    };
    dispatch({ type: 'ADD_TRACK', payload: newTrack });
  }, [dispatch]);

  const handleSelectTrack = useCallback(
    (trackId: string) => {
      dispatch({ type: 'SELECT_TRACK', payload: trackId });
      dispatch({ type: 'SELECT_ITEM', payload: null });
    },
    [dispatch]
  );

  // ==================== 素材项操作 ====================
  const handleSelectItem = useCallback(
    (itemId: string) => {
      dispatch({ type: 'SELECT_ITEM', payload: itemId });
    },
    [dispatch]
  );

  const handleDeleteItem = useCallback(
    (trackId: string, itemId: string) => {
      dispatch({
        type: 'REMOVE_ITEM',
        payload: { trackId, itemId },
      });
    },
    [dispatch]
  );

  const handleUpdateItem = useCallback(
    (trackId: string, itemId: string, updates: Partial<Item>) => {
      dispatch({
        type: 'UPDATE_ITEM',
        payload: { trackId, itemId, updates },
      });
    },
    [dispatch]
  );

  // ==================== 拖放处理（从 AssetPanel 拖入素材）====================
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    console.log('Drag over Timeline');
  }, []);

  // 创建素材项的辅助函数
  const createItemFromAsset = useCallback((asset: any, frame: number): Item | null => {
    const baseId = `item-${Date.now()}`;

    switch (asset.type) {
      case 'video':
        return {
          id: baseId,
          type: 'video' as const,
          from: frame,
          durationInFrames: asset.duration || 90,
          src: asset.src,
          waveform: asset.waveform,
        } as Item;
      case 'audio':
        return {
          id: baseId,
          type: 'audio' as const,
          from: frame,
          durationInFrames: asset.duration || 90,
          src: asset.src,
          waveform: asset.waveform,
        } as Item;
      case 'image':
        return {
          id: baseId,
          type: 'image' as const,
          from: frame,
          durationInFrames: 90,
          src: asset.src,
        } as Item;
      default:
        return null;
    }
  }, []);

  // 处理拖放到空白时间轴区域（自动创建轨道）
  const handleTimelineDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      console.log('Timeline drop event triggered');

      const isQuickAdd = e.dataTransfer.getData('quickAdd') === 'true';
      const quickAddType = e.dataTransfer.getData('quickAddType');
      const assetId = e.dataTransfer.getData('assetId');

      console.log('Drop data:', { isQuickAdd, quickAddType, assetId });

      // 如果没有轨道，先创建一个
      if (tracks.length === 0) {
        const itemType = isQuickAdd ? quickAddType :
                        (assets.find(a => a.id === assetId)?.type || 'Track');
        const newTrack = {
          id: `track-${Date.now()}`,
          name: itemType.charAt(0).toUpperCase() + itemType.slice(1),
          items: [],
        };
        dispatch({ type: 'ADD_TRACK', payload: newTrack });

        // 然后添加素材到新轨道
        setTimeout(() => {
          let newItem: Item | null = null;

          if (isQuickAdd) {
            // Handle quick add items
            if (quickAddType === 'text') {
              newItem = {
                id: `text-${Date.now()}`,
                type: 'text',
                text: 'Double click to edit',
                color: '#000000',
                from: 0,
                durationInFrames: 90,
                fontSize: 60,
              } as Item;
            } else if (quickAddType === 'solid') {
              newItem = {
                id: `solid-${Date.now()}`,
                type: 'solid',
                color: '#' + Math.floor(Math.random() * 16777215).toString(16),
                from: 0,
                durationInFrames: 60,
              } as Item;
            }
          } else {
            // Handle regular assets
            const asset = assets.find((a) => a.id === assetId);
            if (!asset) {
              console.log('Asset not found in assets list');
              return;
            }
            newItem = createItemFromAsset(asset, 0);
          }

          if (newItem) {
            dispatch({
              type: 'ADD_ITEM',
              payload: { trackId: newTrack.id, item: newItem },
            });
            dispatch({ type: 'SELECT_ITEM', payload: newItem.id });
          }
        }, 0);
      }
    },
    [assets, tracks, dispatch, createItemFromAsset]
  );

  const handleDrop = useCallback(
    (trackId: string) => (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation(); // 防止冒泡到容器的handleTimelineDrop
      console.log('Track drop event triggered for track:', trackId);

      const isQuickAdd = e.dataTransfer.getData('quickAdd') === 'true';
      const quickAddType = e.dataTransfer.getData('quickAddType');
      const assetId = e.dataTransfer.getData('assetId');

      console.log('Drop data:', { isQuickAdd, quickAddType, assetId });

      // 计算放置位置
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const rawFrame = pixelsToFrame(x, pixelsPerFrame);

      // 应用吸附
      const snapResult = calculateSnap(
        rawFrame,
        tracks,
        null,
        currentFrame,
        snapEnabled,
        timelineStyles.snapThreshold
      );

      const frame = Math.max(0, snapResult.snappedFrame);

      let newItem: Item | null = null;

      if (isQuickAdd) {
        // Handle quick add items
        if (quickAddType === 'text') {
          newItem = {
            id: `text-${Date.now()}`,
            type: 'text',
            text: 'Double click to edit',
            color: '#000000',
            from: frame,
            durationInFrames: 90,
            fontSize: 60,
          } as Item;
        } else if (quickAddType === 'solid') {
          newItem = {
            id: `solid-${Date.now()}`,
            type: 'solid',
            color: '#' + Math.floor(Math.random() * 16777215).toString(16),
            from: frame,
            durationInFrames: 60,
          } as Item;
        }
      } else {
        // Handle regular assets
        const asset = assets.find((a) => a.id === assetId);
        if (!asset) {
          console.log('Asset not found in assets list');
          return;
        }
        newItem = createItemFromAsset(asset, frame);
      }

      if (!newItem) return;

      dispatch({
        type: 'ADD_ITEM',
        payload: { trackId, item: newItem },
      });

      // 选中新添加的素材
      dispatch({ type: 'SELECT_ITEM', payload: newItem.id });
    },
    [assets, tracks, currentFrame, snapEnabled, pixelsPerFrame, dispatch, createItemFromAsset]
  );

  // ==================== 键盘快捷键 ====================
  useKeyboardShortcuts(
    {
      onDelete: () => {
        if (selectedItemId) {
          // 找到包含该素材的轨道
          const track = tracks.find((t) => t.items.some((i) => i.id === selectedItemId));
          if (track) {
            handleDeleteItem(track.id, selectedItemId);
          }
        }
      },
      onPlayPause: () => {
        dispatch({ type: 'SET_PLAYING', payload: !playing });
      },
      onFrameForward: (frames) => {
        handleSeek(currentFrame + frames);
      },
      onFrameBackward: (frames) => {
        handleSeek(currentFrame - frames);
      },
      onZoomIn: handleZoomIn,
      onZoomOut: handleZoomOut,
      // TODO: 实现复制、粘贴、撤销、重做
      onCopy: () => console.log('Copy not yet implemented'),
      onPaste: () => console.log('Paste not yet implemented'),
      onDuplicate: () => console.log('Duplicate not yet implemented'),
      onUndo: () => console.log('Undo not yet implemented'),
      onRedo: () => console.log('Redo not yet implemented'),
    },
    true
  );

  const totalWidth = frameToPixels(durationInFrames, pixelsPerFrame);

  return (
    <div
      ref={containerRef}
      data-timeline-container
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: colors.bg.primary,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* 头部工具栏 - 固定高度 */}
      <TimelineHeader
        currentFrame={currentFrame}
        fps={fps}
        zoom={zoom}
        snapEnabled={snapEnabled}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
      />

      {/* 工作区域 - 占据剩余高度 */}
      <div
        className="timeline-workspace"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* 时间标尺 - 固定高度 */}
        <div
          style={{
            height: timelineStyles.rulerHeight,
            flexShrink: 0,
            display: 'flex',
            backgroundColor: colors.bg.secondary,
            borderBottom: `2px solid ${colors.border.default}`,
            position: 'sticky',
            top: 0,
            zIndex: 15,
          }}
        >
          {/* 左侧占位（对齐标签宽度） */}
          <div
            style={{
              width: timelineStyles.trackLabelWidth,
              flexShrink: 0,
              backgroundColor: colors.bg.secondary,
              borderRight: `1px solid ${colors.border.default}`,
            }}
          />

          {/* 标尺内容 */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <TimelineRuler
              durationInFrames={durationInFrames}
              pixelsPerFrame={pixelsPerFrame}
              fps={fps}
              onSeek={handleSeek}
              zoom={zoom}
            />
          </div>
        </div>

        {/* 轨道容器 - 独立的视觉容器 */}
        <TimelineTracksContainer
          durationInFrames={durationInFrames}
          pixelsPerFrame={pixelsPerFrame}
          selectedTrackId={selectedTrackId}
          selectedItemId={selectedItemId}
          assets={assets}
          onSelectTrack={handleSelectTrack}
          onSelectItem={handleSelectItem}
          onDeleteItem={handleDeleteItem}
          onUpdateItem={handleUpdateItem}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onEmptyDrop={handleTimelineDrop}
        />

        {/* 播放头 - 覆盖层 */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          <TimelinePlayhead
            currentFrame={currentFrame}
            pixelsPerFrame={pixelsPerFrame}
            fps={fps}
            timelineHeight={tracks.length * timelineStyles.trackHeight + timelineStyles.rulerHeight}
            onSeek={handleSeek}
          />
        </div>
      </div>
    </div>
  );
};
