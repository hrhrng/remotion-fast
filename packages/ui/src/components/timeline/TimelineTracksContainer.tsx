import React, { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { useEditor } from '@remotion-fast/core';
import type { Track, Asset, Item } from '@remotion-fast/core';
import { colors, timeline, spacing, shadows, getItemColor } from './styles';
import { TimelineItem } from './TimelineItem';
import { currentDraggedAsset } from '../AssetPanel';

// Declare the global window property for TypeScript
declare global {
  interface Window {
    currentDraggedItem: { item: Item; trackId: string } | null;
  }
}

interface TimelineTracksContainerProps {
  durationInFrames: number;
  pixelsPerFrame: number;
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
}

// Store dragged data globally to work around dataTransfer issues
let globalDragData: { assetId?: string; quickAdd?: string; quickAddType?: string; asset?: string } = {};

export const TimelineTracksContainer: React.FC<TimelineTracksContainerProps> = ({
  durationInFrames,
  pixelsPerFrame,
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
}) => {
  const { state, dispatch } = useEditor();
  const { tracks } = state;

  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [scrollSync, setScrollSync] = useState({ x: 0, y: 0 });
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [insertPosition, setInsertPosition] = useState<number | null>(null);

  // 同步垂直滚动（标签面板 ↔ 轨道视口）
  const handleViewportScroll = useCallback(() => {
    if (viewportRef.current && labelsRef.current) {
      const scrollTop = viewportRef.current.scrollTop;
      labelsRef.current.scrollTop = scrollTop;
      setScrollSync(prev => ({ ...prev, y: scrollTop }));
    }
  }, []);

  const handleLabelsScroll = useCallback(() => {
    if (labelsRef.current && viewportRef.current) {
      const scrollTop = labelsRef.current.scrollTop;
      viewportRef.current.scrollTop = scrollTop;
      setScrollSync(prev => ({ ...prev, y: scrollTop }));
    }
  }, []);

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
    console.log('Stored global drag data on enter:', globalDragData);
  }, []);

  const handleContainerDragLeave = useCallback((e: React.DragEvent) => {
    // 只有离开整个容器时才隐藏指示器
    if (e.currentTarget === e.target) {
      setIsDraggingOver(false);
      setInsertPosition(null);
    }
  }, []);

  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);

    // Don't handle the drop here if we're inserting between tracks
    // It will be handled by the track's own drop handler
    if (insertPosition !== null) {
      return;
    }

    setInsertPosition(null);

    // 如果没有轨道，调用空状态的 drop 处理
    if (tracks.length === 0) {
      onEmptyDrop(e);
    }
  }, [tracks.length, onEmptyDrop, insertPosition]);

  // 检测鼠标是否在两个轨道之间
  const detectInsertPosition = useCallback((e: React.DragEvent) => {
    if (!viewportRef.current) return;

    const rect = viewportRef.current.getBoundingClientRect();
    const y = e.clientY - rect.top + viewportRef.current.scrollTop;
    const trackIndex = Math.floor(y / timeline.trackHeight);
    const relativeY = y % timeline.trackHeight;

    console.log('detectInsertPosition:', {
      y,
      trackIndex,
      relativeY,
      trackHeight: timeline.trackHeight,
      tracksLength: tracks.length
    });

    // 如果鼠标在轨道边界附近（上下 20px 范围内，增加容错范围）
    if (relativeY < 20 || relativeY > timeline.trackHeight - 20) {
      // 计算插入位置
      const position = relativeY < 20 ? trackIndex : trackIndex + 1;
      console.log('Near boundary, position would be:', position);
      if (position >= 0 && position <= tracks.length) {
        console.log('Setting insertPosition to:', position);
        setInsertPosition(position);
        return position;
      }
    }

    setInsertPosition(null);
    return null;
  }, [tracks.length]);

  // 处理轨道间插入
  const handleInsertDrop = useCallback((e: React.DragEvent, position: number) => {
    console.log('=== handleInsertDrop called! position:', position);
    e.preventDefault();
    e.stopPropagation();

    // Check if this is an existing item being moved
    const dragType = e.dataTransfer.getData('dragType');
    const itemId = e.dataTransfer.getData('itemId');
    const sourceTrackId = e.dataTransfer.getData('trackId');

    console.log('Drop event data transfer info:');
    console.log('  - dragType:', dragType);
    console.log('  - itemId:', itemId);
    console.log('  - sourceTrackId:', sourceTrackId);
    console.log('  - window.currentDraggedItem:', window.currentDraggedItem);
    console.log('  - Condition check: dragType === "item"?', dragType === 'item');
    console.log('  - Condition check: window.currentDraggedItem exists?', !!window.currentDraggedItem);

    if (dragType === 'item' || window.currentDraggedItem) {
      // Moving an existing item to a new track
      console.log('>>> MOVING EXISTING ITEM TO NEW TRACK <<<');
      console.log('currentDraggedItem:', window.currentDraggedItem);

      const itemToMove = window.currentDraggedItem?.item;
      const sourceTrack = window.currentDraggedItem?.trackId || sourceTrackId;

      console.log('  - Item to move:', itemToMove);
      console.log('  - Source track ID:', sourceTrack);

      if (!itemToMove || !sourceTrack) {
        console.error('ERROR: Missing item or source track information');
        console.error('  - itemToMove:', itemToMove);
        console.error('  - sourceTrack:', sourceTrack);
        return;
      }

      // Create new track with appropriate name based on item type
      const newTrack = {
        id: `track-${Date.now()}`,
        name: itemToMove.type.charAt(0).toUpperCase() + itemToMove.type.slice(1),
        items: []
      };

      // Insert new track at the specified position
      console.log('Creating new track for moved item:', newTrack);
      dispatch({
        type: 'INSERT_TRACK',
        payload: { track: newTrack, index: position }
      });

      // Wait for track creation, then move the item
      setTimeout(() => {
        // Remove item from source track
        console.log('Removing item from source track:', sourceTrack);
        dispatch({
          type: 'REMOVE_ITEM',
          payload: { trackId: sourceTrack, itemId: itemToMove.id }
        });

        // Add item to new track
        console.log('Adding item to new track:', newTrack.id);
        dispatch({
          type: 'ADD_ITEM',
          payload: { trackId: newTrack.id, item: itemToMove }
        });

        // Select the moved item
        dispatch({ type: 'SELECT_ITEM', payload: itemToMove.id });
      }, 0);

      return;
    }

    console.log('>>> NOT AN EXISTING ITEM - CREATING NEW ITEM FROM ASSET <<<');
    // Otherwise, handle creating new items from assets
    // Try to get assetId from multiple sources, fallback to global data
    let assetId = e.dataTransfer.getData('assetId') ||
                  e.dataTransfer.getData('text/plain') ||
                  globalDragData.assetId;

    const isQuickAdd = (e.dataTransfer.getData('quickAdd') || globalDragData.quickAdd) === 'true';
    const quickAddType = e.dataTransfer.getData('quickAddType') || globalDragData.quickAddType;
    const assetData = e.dataTransfer.getData('asset') || globalDragData.asset;

    console.log('Drop data from event:', {
      assetId: e.dataTransfer.getData('assetId'),
      quickAdd: e.dataTransfer.getData('quickAdd'),
      quickAddType: e.dataTransfer.getData('quickAddType')
    });
    console.log('Drop data from global:', globalDragData);
    console.log('currentDraggedAsset:', currentDraggedAsset);

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

    console.log('Final drop data:', { finalIsQuickAdd, finalQuickAddType, assetId, assetData });

    // 创建新轨道并插入到指定位置
    const itemType = finalIsQuickAdd ? finalQuickAddType :
                    (assets.find(a => a.id === assetId)?.type || 'Track');
    const newTrack = {
      id: `track-${Date.now()}`,
      name: itemType.charAt(0).toUpperCase() + itemType.slice(1),
      items: []
    };

    // 插入轨道到指定位置
    console.log('Dispatching INSERT_TRACK with:', { track: newTrack, index: position });
    dispatch({
      type: 'INSERT_TRACK',
      payload: { track: newTrack, index: position }
    });
    console.log('INSERT_TRACK dispatched');

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
              durationInFrames: (asset && asset.duration) || 90,
              src: asset ? asset.src : '',
              waveform: asset ? asset.waveform : undefined,
            };
            break;
          case 'audio':
            newItem = {
              id: `item-${Date.now()}`,
              type: 'audio',
              from: 0,
              durationInFrames: asset.duration || 90,
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

  // 扩展拖动悬停处理
  const handleTrackAreaDragOver = useCallback((e: React.DragEvent) => {
    onDragOver(e);
    detectInsertPosition(e);
  }, [onDragOver, detectInsertPosition]);

  const totalWidth = durationInFrames * pixelsPerFrame;

  return (
    <div
      ref={containerRef}
      className="timeline-tracks-container"
      style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        background: colors.bg.primary,
        borderRadius: 4,
        margin: `${spacing.xs}px`,
        boxShadow: shadows.sm,
        border: `1px solid ${colors.border.default}`,
        position: 'relative',
        // 拖放时的视觉反馈
        ...(isDraggingOver && {
          background: colors.bg.hover,
          borderColor: colors.accent.primary,
        }),
      }}
      onDragEnter={handleContainerDragEnter}
      onDragLeave={handleContainerDragLeave}
      onDragOver={onDragOver}
      onDrop={handleContainerDrop}
    >
      {/* 左侧标签面板 */}
      <div
        ref={labelsRef}
        className="track-labels-panel"
        style={{
          width: timeline.trackLabelWidth,
          flexShrink: 0,
          background: colors.bg.secondary,
          borderRight: `1px solid ${colors.border.default}`,
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'sticky',
          left: 0,
          zIndex: 10,
          // 隐藏滚动条但保持可滚动
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
        onScroll={handleLabelsScroll}
      >
        <style>{`
          .track-labels-panel::-webkit-scrollbar {
            display: none;
          }
        `}</style>

        {tracks.length === 0 ? (
          // 空状态标签
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
          // 轨道标签（这部分会在后续拆分到独立组件）
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

      {/* 右侧轨道视口 */}
      <div
        ref={viewportRef}
        className="tracks-viewport"
        style={{
          flex: 1,
          overflowX: 'auto',
          overflowY: 'auto',
          position: 'relative',
          minWidth: 0,
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
            console.log('Container onDrop, insertPosition:', insertPosition);
            // Handle drops when inserting between tracks or at the end
            if (insertPosition !== null) {
              console.log('Handling insert drop at position:', insertPosition);
              e.preventDefault();
              e.stopPropagation();
              handleInsertDrop(e, insertPosition);
              setInsertPosition(null);
            } else {
              console.log('No insertPosition, not handling drop');
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            detectInsertPosition(e);
          }}
        >
          {tracks.length === 0 ? (
            // 空状态
            <div
              style={{
                height: 200,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.text.tertiary,
                gap: spacing.lg,
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
                {insertPosition === index && (
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
                    borderBottom: `1px solid ${colors.border.default}`,
                    position: 'relative',
                    backgroundColor: selectedTrackId === track.id ? colors.bg.selected : 'transparent',
                  }}
                  onClick={() => onSelectTrack(track.id)}
                  onDragOver={(e) => {
                    onDragOver(e);
                    detectInsertPosition(e);
                  }}
                  onDrop={(e) => {
                    console.log(`Track ${index} onDrop, insertPosition:`, insertPosition);
                    // Don't handle drops that are meant for insertion
                    if (insertPosition !== null) {
                      console.log(`Track ${index} ignoring drop, insertPosition is:`, insertPosition);
                      return;  // Let the container handle it
                    }

                    // Otherwise, add to existing track
                    console.log(`Track ${index} handling drop to add item`);
                    onDrop(track.id, e);
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
                      onResize={(edge, deltaFrames) => {
                        const newFrom = edge === 'left'
                          ? Math.max(0, item.from + deltaFrames)
                          : item.from;
                        const newDuration = edge === 'left'
                          ? item.durationInFrames + (item.from - newFrom)
                          : Math.max(15, item.durationInFrames + deltaFrames);

                        if (newDuration >= 15) {
                          onUpdateItem(track.id, item.id, {
                            from: newFrom,
                            durationInFrames: newDuration,
                          });
                        }
                      }}
                    />
                  ))}
                </div>

                {/* 插入指示器 - 最后一个轨道下方 */}
                {insertPosition === tracks.length && index === tracks.length - 1 && (
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
};