import React, { useRef, useState, useCallback } from 'react';
import { useEditor } from '../state/EditorContext';
import type { Item, Track } from '../types';
import { Reorder } from 'framer-motion';

export const Timeline: React.FC = () => {
  const { state, dispatch } = useEditor();
  const [draggedItem, setDraggedItem] = useState<{ trackId: string; item: Item } | null>(null);
  const [draggedTrackId, setDraggedTrackId] = useState<string | null>(null);
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [snapPreview, setSnapPreview] = useState<{ trackId: string; frame: number; duration: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<{ trackId: string; frame: number; pixelX: number; duration: number; type: string; src?: string; thumbnail?: string } | null>(null);
  const [dragOffset, setDragOffset] = useState<number>(0); // 鼠标相对于素材左边缘的偏移量（像素）
  const timelineRef = useRef<HTMLDivElement>(null);

  const pixelsPerFrame = 2 * state.zoom;
  const trackHeight = 60;
  const snapThreshold = 3; // 吸附阈值（帧数）- 更精确

  // 智能吸附到网格和其他items
  const getSnappedFrame = (rawFrame: number, excludeItemId?: string, disableSnap?: boolean): { frame: number; snapped: boolean } => {
    // 如果禁用吸附，直接返回原始帧
    if (disableSnap) {
      return { frame: rawFrame, snapped: false };
    }
    let closestFrame = rawFrame;
    let minDistance = snapThreshold + 1;

    // 收集所有吸附点
    const snapPoints: number[] = [];

    // 1. 优先吸附到轨道起点
    snapPoints.push(0);

    // 2. 添加所有items的边界作为吸附点（优先级最高）
    state.tracks.forEach(track => {
      track.items.forEach(item => {
        if (item.id !== excludeItemId) {
          snapPoints.push(item.from); // 开始位置
          snapPoints.push(item.from + item.durationInFrames); // 结束位置
        }
      });
    });

    // 找到最近的吸附点
    snapPoints.forEach(point => {
      const distance = Math.abs(rawFrame - point);
      if (distance < minDistance) {
        minDistance = distance;
        closestFrame = point;
      }
    });

    // 3. 如果没有找到Item吸附点，尝试网格吸附（每5帧）
    if (minDistance > snapThreshold) {
      const gridSize = 5;
      const gridPoint = Math.round(rawFrame / gridSize) * gridSize;
      const gridDistance = Math.abs(rawFrame - gridPoint);
      if (gridDistance < snapThreshold && gridDistance < minDistance) {
        closestFrame = gridPoint;
        minDistance = gridDistance;
      }
    }

    return {
      frame: closestFrame,
      snapped: minDistance < snapThreshold,
    };
  };

  const handleTrackClick = (trackId: string) => {
    dispatch({ type: 'SELECT_TRACK', payload: trackId });
  };

  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    dispatch({ type: 'SELECT_ITEM', payload: itemId });
  };

  const handleTimelineClick = (e: React.MouseEvent) => {
    if (timelineRef.current) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - 200; // Account for track labels
      const frame = Math.floor(x / pixelsPerFrame);
      if (frame >= 0 && frame <= state.durationInFrames) {
        dispatch({ type: 'SET_CURRENT_FRAME', payload: frame });
      }
    }
  };

  const handleItemDragStart = (e: React.DragEvent, trackId: string, item: Item) => {
    setDraggedItem({ trackId, item });
    e.dataTransfer.effectAllowed = 'move';

    // 隐藏浏览器默认的拖动图像
    const img = new Image();
    img.src = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    e.dataTransfer.setDragImage(img, 0, 0);

    // 计算鼠标相对于素材左边缘的偏移量
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const offsetX = e.clientX - rect.left;
    setDragOffset(offsetX);
  };

  const handleItemDragOver = (e: React.DragEvent, trackId: string) => {
    e.preventDefault();

    // Check if it's an asset being dragged
    const hasAsset = e.dataTransfer.types.includes('asset');
    e.dataTransfer.dropEffect = hasAsset ? 'copy' : 'move';

    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - 200;

    // 预览框左边缘位置 = 鼠标位置 - 拖动偏移量
    const previewLeftX = hasAsset ? mouseX : mouseX - dragOffset;
    const rawFrame = Math.max(0, Math.floor(previewLeftX / pixelsPerFrame));

    // 计算吸附 - Shift键或按钮禁用吸附
    const disableSnap = e.shiftKey || !snapEnabled;
    const snapResult = getSnappedFrame(rawFrame, draggedItem?.item.id, disableSnap);

    // 如果是从 timeline 拖动已有素材，实时更新位置
    if (draggedItem) {
      dispatch({
        type: 'UPDATE_ITEM',
        payload: {
          trackId: draggedItem.trackId,
          itemId: draggedItem.item.id,
          updates: { from: snapResult.frame },
        },
      });

      // 如果跨轨道拖动，需要移动到新轨道
      if (trackId !== draggedItem.trackId) {
        // 先从旧轨道删除
        dispatch({
          type: 'REMOVE_ITEM',
          payload: { trackId: draggedItem.trackId, itemId: draggedItem.item.id },
        });
        // 添加到新轨道
        dispatch({
          type: 'ADD_ITEM',
          payload: {
            trackId: trackId,
            item: { ...draggedItem.item, from: snapResult.frame },
          },
        });
        // 更新 draggedItem 的 trackId
        setDraggedItem({ trackId, item: draggedItem.item });
      }

      // 设置吸附预览
      if (snapResult.snapped) {
        setSnapPreview({
          trackId,
          frame: snapResult.frame,
          duration: draggedItem.item.durationInFrames,
        });
      } else {
        setSnapPreview(null);
      }
    } else if (hasAsset) {
      // 从 Assets 拖动新素材，显示预览
      let duration = 90;
      let type = 'item';
      let src: string | undefined;
      let thumbnail: string | undefined;

      try {
        const assetData = e.dataTransfer.getData('asset');
        if (assetData) {
          const asset = JSON.parse(assetData);
          type = asset.type;
          src = asset.src;
          thumbnail = asset.thumbnail;
          if (asset.type === 'video' || asset.type === 'audio') {
            duration = 150;
          } else if (asset.type === 'image') {
            duration = 90;
          }
        }
      } catch (err) {
        // 忽略解析错误
      }

      setDragPreview({
        trackId,
        frame: snapResult.frame,
        pixelX: previewLeftX,
        duration,
        type,
        src,
        thumbnail,
      });

      if (snapResult.snapped) {
        setSnapPreview({
          trackId,
          frame: snapResult.frame,
          duration,
        });
      } else {
        setSnapPreview(null);
      }
    }
  };

  const handleItemDrop = (e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault();
    setSnapPreview(null); // 清除吸附预览
    setDragPreview(null); // 清除拖动预览

    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left - 200;

    // Check if dragging from Assets panel
    const assetData = e.dataTransfer.getData('asset');

    if (assetData) {
      // 从 Assets 拖入新素材
      const previewLeftX = mouseX;
      const rawFrame = Math.max(0, Math.floor(previewLeftX / pixelsPerFrame));
      const disableSnap = e.shiftKey || !snapEnabled;
      const snapResult = getSnappedFrame(rawFrame, undefined, disableSnap);
      const newFrom = snapResult.frame;

      try {
        const asset = JSON.parse(assetData);
        let newItem: Item;

        if (asset.type === 'video') {
          newItem = {
            id: `video-${Date.now()}`,
            type: 'video',
            src: asset.src,
            from: newFrom,
            durationInFrames: 150, // 5 seconds default
          };
        } else if (asset.type === 'audio') {
          newItem = {
            id: `audio-${Date.now()}`,
            type: 'audio',
            src: asset.src,
            from: newFrom,
            durationInFrames: 150,
            volume: 1,
          };
        } else if (asset.type === 'image') {
          newItem = {
            id: `image-${Date.now()}`,
            type: 'image',
            src: asset.src,
            from: newFrom,
            durationInFrames: 90, // 3 seconds default
          };
        } else {
          return;
        }

        dispatch({
          type: 'ADD_ITEM',
          payload: { trackId: targetTrackId, item: newItem },
        });
      } catch (err) {
        console.error('Failed to parse asset data:', err);
      }
    }
    // timeline 内的拖动已经在 dragOver 中实时处理了，这里不需要额外操作
  };

  const handleTrackDragStart = (e: React.DragEvent, trackId: string) => {
    setDraggedTrackId(trackId);
    e.dataTransfer.effectAllowed = 'move';
    // Prevent item drag when dragging track label
    e.stopPropagation();
  };

  const handleTrackDragOver = (e: React.DragEvent) => {
    // Only allow track reordering, not asset drops on track labels
    if (draggedTrackId) {
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
    }
  };

  const handleTrackDrop = (e: React.DragEvent, targetTrackId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedTrackId || draggedTrackId === targetTrackId) {
      setDraggedTrackId(null);
      return;
    }

    const draggedIndex = state.tracks.findIndex((t) => t.id === draggedTrackId);
    const targetIndex = state.tracks.findIndex((t) => t.id === targetTrackId);

    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedTrackId(null);
      return;
    }

    // Reorder tracks
    const newTracks = [...state.tracks];
    const [removed] = newTracks.splice(draggedIndex, 1);
    newTracks.splice(targetIndex, 0, removed);

    dispatch({ type: 'REORDER_TRACKS', payload: newTracks });
    setDraggedTrackId(null);
  };

  const getItemColor = (item: Item): string => {
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

  const handleDragEnd = () => {
    setDragPreview(null);
    setSnapPreview(null);
    setDragOffset(0);
    setDraggedItem(null);
  };

  const formatTime = (frame: number): string => {
    const totalSeconds = frame / state.fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const frames = frame % state.fps;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Timeline</h2>
        <div style={styles.controls}>
          <button
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.max(0.5, state.zoom - 0.5) })}
            style={styles.button}
          >
            -
          </button>
          <span style={styles.zoomLabel}>Zoom: {state.zoom.toFixed(1)}x</span>
          <button
            onClick={() => dispatch({ type: 'SET_ZOOM', payload: Math.min(3, state.zoom + 0.5) })}
            style={styles.button}
          >
            +
          </button>
          <button
            onClick={() => setSnapEnabled(!snapEnabled)}
            style={{
              ...styles.button,
              backgroundColor: snapEnabled ? '#0066ff' : '#3d3d3d',
            }}
            title={snapEnabled ? 'Snap enabled' : 'Snap disabled'}
          >
            🧲 {snapEnabled ? 'ON' : 'OFF'}
          </button>
          <span style={styles.timeLabel}>{formatTime(state.currentFrame)}</span>
        </div>
      </div>

      <div ref={timelineRef} style={styles.timeline} onClick={handleTimelineClick}>
        {/* Ruler */}
        <div style={styles.ruler}>
          <div style={{ ...styles.rulerLabel, width: 200 }}>Tracks</div>
          <div style={styles.rulerTicks}>
            {Array.from({ length: Math.ceil(state.durationInFrames / 30) }).map((_, i) => {
              const frame = i * 30;
              return (
                <div
                  key={i}
                  style={{
                    ...styles.rulerTick,
                    left: frame * pixelsPerFrame,
                  }}
                >
                  <div style={styles.rulerTickMark} />
                  <div style={styles.rulerTickLabel}>{formatTime(frame)}</div>
                </div>
              );
            })}
          </div>
        </div>


        {/* Tracks */}
        <Reorder.Group
          axis="y"
          values={state.tracks}
          onReorder={(newTracks) => dispatch({ type: 'REORDER_TRACKS', payload: newTracks })}
          style={styles.tracks}
        >
          {state.tracks.map((track) => (
            <Reorder.Item
              key={track.id}
              value={track}
              style={{
                ...styles.track,
                backgroundColor: state.selectedTrackId === track.id ? '#2a2a2a' : '#1e1e1e',
                listStyle: 'none',
              }}
              onClick={() => handleTrackClick(track.id)}
              onDragOver={(e) => handleItemDragOver(e, track.id)}
              onDrop={(e) => handleItemDrop(e, track.id)}
              onDragEnd={handleDragEnd}
            >
              <div style={styles.trackLabel}>
                <span style={styles.trackName}>{track.name}</span>
              </div>
              <div style={styles.trackContent}>
                {/* Playhead */}
                {state.currentFrame >= 0 && (
                  <div
                    style={{
                      ...styles.playhead,
                      left: state.currentFrame * pixelsPerFrame,
                    }}
                  />
                )}

                {/* Drag Preview - 跟随鼠标的完整预览 */}
                {dragPreview && dragPreview.trackId === track.id && (
                  <div
                    style={{
                      ...styles.item,
                      left: dragPreview.pixelX,
                      width: dragPreview.duration * pixelsPerFrame,
                      backgroundColor: getColorByType(dragPreview.type),
                      opacity: 1,
                      border: '1px solid rgba(0,0,0,0.2)',
                      pointerEvents: 'none',
                      backgroundImage: (dragPreview.type === 'video' ? dragPreview.thumbnail : dragPreview.src) ?
                        `url(${dragPreview.type === 'video' ? dragPreview.thumbnail : dragPreview.src})` : 'none',
                      backgroundSize: dragPreview.type === 'image' ? 'contain' : 'cover',
                      backgroundPosition: 'center',
                      backgroundRepeat: dragPreview.type === 'image' ? 'no-repeat' : 'repeat-x',
                    }}
                  >
                    <span style={{
                      ...styles.itemLabel,
                      backgroundColor: (dragPreview.thumbnail || dragPreview.src) ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                      padding: (dragPreview.thumbnail || dragPreview.src) ? '2px 6px' : '0',
                      borderRadius: (dragPreview.thumbnail || dragPreview.src) ? '3px' : '0',
                    }}>
                      {dragPreview.type}
                    </span>
                  </div>
                )}

                {/* Snap Preview - 吸附目标的半透明框 */}
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
                {track.items.map((item) => {
                  const hasPreview = (item.type === 'video' || item.type === 'image') && 'src' in item;
                  // 获取缩略图URL：对于video使用从asset中获取的thumbnail，对于image直接使用src
                  let thumbnailUrl: string | undefined;
                  let waveformUrl: string | undefined;
                  if (hasPreview) {
                    if (item.type === 'video') {
                      // 查找对应的asset来获取thumbnail和waveform
                      const asset = state.assets.find(a => a.src === item.src);
                      thumbnailUrl = asset?.thumbnail || item.src;
                      waveformUrl = asset?.waveform;
                      if (waveformUrl) {
                        console.log('Found waveform for video item:', item.id);
                      }
                    } else {
                      thumbnailUrl = item.src;
                    }
                  }

                  return (
                    <div
                      key={item.id}
                      style={{
                        position: 'absolute',
                        left: item.from * pixelsPerFrame,
                        width: item.durationInFrames * pixelsPerFrame,
                        top: '8px',
                        height: '44px',
                      }}
                    >
                      <div
                        draggable
                        onDragStart={(e) => handleItemDragStart(e, track.id, item)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleItemClick(e, item.id)}
                        style={{
                          ...styles.item,
                          left: 0,
                          top: 0,
                          width: '100%',
                          backgroundColor: getItemColor(item),
                          opacity: track.hidden ? 0.3 : 1,
                          border:
                            state.selectedItemId === item.id
                              ? '2px solid #ffffff'
                              : '1px solid rgba(0,0,0,0.2)',
                          backgroundImage: thumbnailUrl ? `url(${thumbnailUrl})` : 'none',
                          backgroundSize: item.type === 'image' ? 'contain' : 'cover',
                          backgroundPosition: 'center',
                          backgroundRepeat: item.type === 'image' ? 'no-repeat' : 'repeat-x',
                        }}
                      >
                        <span style={{
                          ...styles.itemLabel,
                          backgroundColor: hasPreview ? 'rgba(0, 0, 0, 0.7)' : 'transparent',
                          padding: hasPreview ? '2px 6px' : '0',
                          borderRadius: hasPreview ? '3px' : '0',
                        }}>
                          {item.type === 'text' ? item.text : item.type}
                        </span>
                      </div>
                      {/* Audio waveform overlay for videos with audio */}
                      {waveformUrl && (
                        <div
                          style={{
                            position: 'absolute',
                            left: 0,
                            bottom: 0,
                            width: '100%',
                            height: '20px',
                            backgroundImage: `url(${waveformUrl})`,
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            backgroundRepeat: 'repeat-x',
                            opacity: 0.8,
                            pointerEvents: 'none',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      </div>

      {/* Add Track Button */}
      <div style={styles.footer}>
        <button
          onClick={() => {
            const newTrack: Track = {
              id: `track-${Date.now()}`,
              name: `Track ${state.tracks.length + 1}`,
              items: [],
            };
            dispatch({ type: 'ADD_TRACK', payload: newTrack });
          }}
          style={styles.addButton}
        >
          + Add Track
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: '#1e1e1e',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3d3d3d',
  },
  title: {
    margin: 0,
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  button: {
    padding: '4px 12px',
    backgroundColor: '#3d3d3d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  zoomLabel: {
    fontSize: '14px',
    color: '#aaaaaa',
  },
  timeLabel: {
    fontSize: '14px',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  timeline: {
    flex: 1,
    overflow: 'auto',
    position: 'relative',
  },
  ruler: {
    display: 'flex',
    height: '40px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3d3d3d',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  rulerLabel: {
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    borderRight: '1px solid #3d3d3d',
  },
  rulerTicks: {
    flex: 1,
    position: 'relative',
  },
  rulerTick: {
    position: 'absolute',
    top: 0,
    height: '100%',
  },
  rulerTickMark: {
    width: '1px',
    height: '8px',
    backgroundColor: '#666666',
  },
  rulerTickLabel: {
    fontSize: '11px',
    color: '#aaaaaa',
    marginTop: '4px',
    fontFamily: 'monospace',
  },
  tracks: {
    position: 'relative',
  },
  track: {
    display: 'flex',
    height: '60px',
    borderBottom: '1px solid #3d3d3d',
    cursor: 'pointer',
  },
  trackLabel: {
    width: '200px',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '16px',
    borderRight: '1px solid #3d3d3d',
    cursor: 'grab',
    userSelect: 'none',
  },
  trackName: {
    fontSize: '14px',
    color: '#ffffff',
    fontWeight: 500,
  },
  trackContent: {
    flex: 1,
    position: 'relative',
  },
  playhead: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: '2px',
    backgroundColor: '#ff0000',
    zIndex: 5,
    pointerEvents: 'none',
  },
  item: {
    position: 'absolute',
    top: '8px',
    height: '44px',
    borderRadius: '4px',
    cursor: 'move',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: '8px',
    overflow: 'hidden',
  },
  itemLabel: {
    fontSize: '12px',
    color: '#ffffff',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  footer: {
    padding: '12px 16px',
    backgroundColor: '#2d2d2d',
    borderTop: '1px solid #3d3d3d',
  },
  addButton: {
    padding: '8px 16px',
    backgroundColor: '#0066ff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
};
