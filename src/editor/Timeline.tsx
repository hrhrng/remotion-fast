import React, { useState, useCallback, useRef } from 'react';
import { useEditor } from '../state/EditorContext';
import { TimelineHeader } from './Timeline/TimelineHeader';
import { TimelineRuler } from './Timeline/TimelineRuler';
import { TimelineTrack } from './Timeline/TimelineTrack';
import { TimelinePlayhead } from './Timeline/TimelinePlayhead';
import { useKeyboardShortcuts } from './Timeline/hooks/useKeyboardShortcuts';
import { colors, timeline as timelineStyles } from './Timeline/styles';
import { getPixelsPerFrame, pixelsToFrame, frameToPixels } from './Timeline/utils/timeFormatter';
import { calculateSnap } from './Timeline/utils/snapCalculator';
import { Item } from '../types';

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
      name: `Track ${tracks.length + 1}`,
      items: [],
    };
    dispatch({ type: 'ADD_TRACK', payload: newTrack });
  }, [tracks.length, dispatch]);

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
  }, []);

  const handleDrop = useCallback(
    (trackId: string) => (e: React.DragEvent) => {
      e.preventDefault();

      const assetId = e.dataTransfer.getData('assetId');
      if (!assetId) return;

      const asset = assets.find((a) => a.id === assetId);
      if (!asset) return;

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

      // 创建新的素材项
      let newItem: Item;
      const baseId = `item-${Date.now()}`;

      switch (asset.type) {
        case 'video':
          newItem = {
            id: baseId,
            type: 'video',
            from: frame,
            durationInFrames: asset.duration || 90,
            src: asset.src,
            assetId: asset.id,
          };
          break;
        case 'audio':
          newItem = {
            id: baseId,
            type: 'audio',
            from: frame,
            durationInFrames: asset.duration || 90,
            src: asset.src,
            assetId: asset.id,
          };
          break;
        case 'image':
          newItem = {
            id: baseId,
            type: 'image',
            from: frame,
            durationInFrames: 90,
            src: asset.src,
            assetId: asset.id,
          };
          break;
        default:
          return;
      }

      dispatch({
        type: 'ADD_ITEM',
        payload: { trackId, item: newItem },
      });

      // 选中新添加的素材
      dispatch({ type: 'SELECT_ITEM', payload: newItem.id });
    },
    [assets, tracks, currentFrame, snapEnabled, pixelsPerFrame, dispatch]
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
      {/* 头部工具栏 */}
      <TimelineHeader
        currentFrame={currentFrame}
        fps={fps}
        zoom={zoom}
        snapEnabled={snapEnabled}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onToggleSnap={() => setSnapEnabled(!snapEnabled)}
        onAddTrack={handleAddTrack}
      />

      {/* 时间轴主体区域 */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {/* 左侧轨道标签占位 */}
        <div
          style={{
            width: timelineStyles.trackLabelWidth,
            flexShrink: 0,
            backgroundColor: colors.bg.secondary,
            borderRight: `1px solid ${colors.border.default}`,
            position: 'sticky',
            left: 0,
            zIndex: 5,
          }}
        />

        {/* 右侧时间轴内容 */}
        <div
          style={{
            flex: 1,
            position: 'relative',
            minWidth: totalWidth,
          }}
        >
          {/* 时间标尺 */}
          <div
            style={{
              position: 'sticky',
              top: 0,
              left: 0,
              width: totalWidth,
              zIndex: 4,
            }}
          >
            <TimelineRuler
              durationInFrames={durationInFrames}
              pixelsPerFrame={pixelsPerFrame}
              fps={fps}
              onSeek={handleSeek}
              zoom={zoom}
            />
          </div>

          {/* 轨道列表（绝对定位，以便被左侧标签覆盖）*/}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: -timelineStyles.trackLabelWidth,
              right: 0,
              paddingTop: timelineStyles.rulerHeight,
            }}
          >
            {tracks.map((track) => (
              <TimelineTrack
                key={track.id}
                track={track}
                durationInFrames={durationInFrames}
                pixelsPerFrame={pixelsPerFrame}
                isSelected={selectedTrackId === track.id}
                selectedItemId={selectedItemId}
                assets={assets}
                onSelectTrack={() => handleSelectTrack(track.id)}
                onSelectItem={handleSelectItem}
                onDeleteItem={(itemId) => handleDeleteItem(track.id, itemId)}
                onUpdateItem={(itemId, updates) => handleUpdateItem(track.id, itemId, updates)}
                onDragOver={handleDragOver}
                onDrop={handleDrop(track.id)}
              />
            ))}
          </div>

          {/* 播放头（覆盖在所有内容上）*/}
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: 'none',
              zIndex: 10,
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
    </div>
  );
};
