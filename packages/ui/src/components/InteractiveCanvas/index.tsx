import React, { useMemo, useRef, useState, useEffect } from 'react';
import Moveable, { OnDrag, OnResize, OnRotate, OnScale } from 'react-moveable';
import { useEditor } from '@remotion-fast/core';
import type { Item, VideoItem as VideoItemType } from '@remotion-fast/core';

export const InteractiveCanvas: React.FC = () => {
  const { state, dispatch } = useEditor();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);

  // Get items visible at current frame
  const visibleItems = useMemo(() => {
    const items: Array<{ trackId: string; item: Item }> = [];

    for (const track of state.tracks) {
      if (track.hidden) continue;

      for (const item of track.items) {
        const itemEnd = item.from + item.durationInFrames;
        if (state.currentFrame >= item.from && state.currentFrame < itemEnd) {
          items.push({ trackId: track.id, item });
        }
      }
    }

    return items;
  }, [state.tracks, state.currentFrame]);

  // Sync selected element with selected item
  useEffect(() => {
    if (state.selectedItemId && canvasRef.current) {
      const element = canvasRef.current.querySelector(`[data-item-id="${state.selectedItemId}"]`) as HTMLElement;
      setSelectedElement(element);
    } else {
      setSelectedElement(null);
    }
  }, [state.selectedItemId]);

  // Playback loop with smoother frame updates
  useEffect(() => {
    if (!state.playing) return;

    let animationFrameId: number;
    const startTime = performance.now();
    const startFrame = state.currentFrame;
    const frameTime = 1000 / state.fps; // Time per frame in milliseconds

    const loop = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const expectedFrame = startFrame + Math.floor(elapsed / frameTime);
      const targetFrame = Math.min(expectedFrame, state.durationInFrames - 1);

      // Only update if we've moved to a new frame
      if (targetFrame !== state.currentFrame) {
        dispatch({
          type: 'SET_CURRENT_FRAME',
          payload: targetFrame,
        });
      }

      // Stop if we've reached the end
      if (targetFrame >= state.durationInFrames - 1) {
        dispatch({ type: 'SET_PLAYING', payload: false });
        return;
      }

      // Continue loop if still playing
      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [state.playing, state.fps, state.durationInFrames, dispatch]);

  const handleItemClick = (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    dispatch({ type: 'SELECT_ITEM', payload: itemId });
  };

  const handleCanvasClick = () => {
    dispatch({ type: 'SELECT_ITEM', payload: null });
  };

  const updateItemProperties = (trackId: string, itemId: string, updates: Partial<Item>) => {
    dispatch({
      type: 'UPDATE_ITEM',
      payload: { trackId, itemId, updates },
    });
  };

  const handleDrag = (trackId: string, itemId: string) => (e: OnDrag) => {
    const { left, top } = e;
    // Convert pixel position back to percentage
    const xPercent = ((left + e.width / 2) / state.compositionWidth) * 100;
    const yPercent = ((top + e.height / 2) / state.compositionHeight) * 100;

    updateItemProperties(trackId, itemId, {
      x: xPercent,
      y: yPercent,
    });
  };

  const handleResize = (trackId: string, itemId: string, item: Item) => (e: OnResize) => {
    const { width, height, drag } = e;

    // Convert pixel size to percentage
    const widthPercent = (width / state.compositionWidth) * 100;
    const heightPercent = (height / state.compositionHeight) * 100;

    // Update position if element moved during resize
    const xPercent = ((drag.left + width / 2) / state.compositionWidth) * 100;
    const yPercent = ((drag.top + height / 2) / state.compositionHeight) * 100;

    updateItemProperties(trackId, itemId, {
      x: xPercent,
      y: yPercent,
      width: widthPercent,
      height: heightPercent,
    });
  };

  const handleRotate = (trackId: string, itemId: string) => (e: OnRotate) => {
    const { rotate } = e;
    updateItemProperties(trackId, itemId, {
      rotation: rotate,
    });
  };

  const handleScale = (trackId: string, itemId: string) => (e: OnScale) => {
    const { scale, drag } = e;
    const item = visibleItems.find(v => v.item.id === itemId)?.item;
    if (!item) return;

    const currentWidth = item.width ?? 100;
    const currentHeight = item.height ?? 100;

    const newWidth = currentWidth * scale[0];
    const newHeight = currentHeight * scale[1];

    updateItemProperties(trackId, itemId, {
      width: newWidth,
      height: newHeight,
    });
  };

  // Render item content based on type
  const renderItemContent = (item: Item) => {
    if (item.type === 'text') {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: item.color,
          fontSize: item.fontSize || 60,
          fontFamily: item.fontFamily || 'Arial',
          fontWeight: item.fontWeight || 'bold',
          textAlign: 'center',
          padding: '0 40px',
          wordBreak: 'break-word',
          pointerEvents: 'none',
        }}>
          {item.text}
        </div>
      );
    }

    if (item.type === 'solid') {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: item.color,
          pointerEvents: 'none',
        }} />
      );
    }

    if (item.type === 'image') {
      return (
        <img
          src={item.src}
          alt="Canvas item"
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            borderRadius: item.cornerRadius ? `${item.cornerRadius}px` : undefined,
            pointerEvents: 'none',
          }}
        />
      );
    }

    if (item.type === 'video') {
      return <VideoItem item={item as VideoItemType} currentFrame={state.currentFrame} fps={state.fps} playing={state.playing} />;
    }

    if (item.type === 'sticker') {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#666',
          fontSize: '18px',
          borderRadius: item.cornerRadius ? `${item.cornerRadius}px` : undefined,
          pointerEvents: 'none',
        }}>
          🎨 {item.src.split('/').pop()}
        </div>
      );
    }

    return null;
  };

  // Video item component with ref for currentTime
  const VideoItem: React.FC<{ item: VideoItemType; currentFrame: number; fps: number; playing: boolean }> = ({ item, currentFrame, fps, playing }) => {
    const videoRef = useRef<HTMLVideoElement>(null);

    // Update video currentTime when frame changes
    useEffect(() => {
      if (videoRef.current) {
        const frameOffset = currentFrame - item.from;
        const videoTime = frameOffset / fps;
        videoRef.current.currentTime = Math.max(0, videoTime);
      }
    }, [currentFrame, item.from, fps]);

    // Control video playback based on playing state
    useEffect(() => {
      if (!videoRef.current) return;

      if (playing) {
        videoRef.current.play().catch(() => {
          // Ignore play errors
        });
      } else {
        videoRef.current.pause();
      }
    }, [playing]);

    return (
      <video
        ref={videoRef}
        src={item.src}
        muted
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: item.cornerRadius ? `${item.cornerRadius}px` : undefined,
          pointerEvents: 'none',
        }}
      />
    );
  };

  // Zoom control
  const [zoom, setZoom] = React.useState(0.5);
  const [initialZoom, setInitialZoom] = React.useState(0.5);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Calculate initial zoom to fit canvas in container
  React.useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const updateZoom = () => {
      const containerWidth = wrapper.clientWidth - 40; // Subtract padding (20px * 2)
      const containerHeight = wrapper.clientHeight - 40;

      const scaleX = containerWidth / state.compositionWidth;
      const scaleY = containerHeight / state.compositionHeight;

      // Use the smaller scale to ensure canvas fits in both dimensions
      const fitZoom = Math.min(scaleX, scaleY, 1); // Cap at 100%

      setInitialZoom(fitZoom);
      setZoom(fitZoom);
    };

    // Calculate on mount and when window resizes
    updateZoom();
    window.addEventListener('resize', updateZoom);

    return () => window.removeEventListener('resize', updateZoom);
  }, [state.compositionWidth, state.compositionHeight]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.1, 2)); // Max 200%
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.1, 0.1)); // Min 10%
  };

  const handleResetZoom = () => {
    setZoom(initialZoom); // Reset to fit zoom
  };

  // Trackpad/mouse wheel zoom
  React.useEffect(() => {
    const wrapper = canvasWrapperRef.current;
    if (!wrapper) return;

    const handleWheel = (e: WheelEvent) => {
      // Check if Ctrl/Cmd key is pressed (standard zoom gesture)
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();

        const delta = -e.deltaY * 0.001; // Adjust sensitivity
        setZoom(prev => Math.max(0.1, Math.min(2, prev + delta)));
      }
    };

    wrapper.addEventListener('wheel', handleWheel, { passive: false });
    return () => wrapper.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Canvas</h2>
        <div style={styles.controls}>
          <div style={styles.zoomControls}>
            <button onClick={handleZoomOut} style={styles.zoomButton}>−</button>
            <span style={styles.zoomDisplay}>{Math.round(zoom * 100)}%</span>
            <button onClick={handleZoomIn} style={styles.zoomButton}>+</button>
            <button onClick={handleResetZoom} style={styles.resetButton}>Reset</button>
          </div>
          <button
            onClick={() => dispatch({ type: 'SET_PLAYING', payload: !state.playing })}
            style={styles.button}
          >
            {state.playing ? 'Pause' : 'Play'}
          </button>
          <span style={styles.frameCounter}>
            Frame: {state.currentFrame} / {state.durationInFrames}
          </span>
        </div>
      </div>

      <div ref={canvasWrapperRef} style={styles.canvasWrapper} onClick={handleCanvasClick}>
        <div
          ref={canvasRef}
          style={{
            position: 'relative',
            width: `${state.compositionWidth}px`,
            height: `${state.compositionHeight}px`,
            backgroundColor: '#000',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            overflow: 'hidden',
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            flexShrink: 0,
          }}
        >
          {/* Render visible items */}
          {visibleItems.map(({ trackId, item }) => {
            const x = item.x ?? 50;
            const y = item.y ?? 50;
            const width = item.width ?? 100;
            const height = item.height ?? 100;
            const rotation = item.rotation ?? 0;
            const opacity = item.opacity ?? 1;

            // Convert percentage to pixels
            const pixelX = (x / 100) * state.compositionWidth - ((width / 100) * state.compositionWidth) / 2;
            const pixelY = (y / 100) * state.compositionHeight - ((height / 100) * state.compositionHeight) / 2;
            const pixelWidth = (width / 100) * state.compositionWidth;
            const pixelHeight = (height / 100) * state.compositionHeight;

            return (
              <div
                key={item.id}
                data-item-id={item.id}
                onClick={(e) => handleItemClick(e, item.id)}
                style={{
                  position: 'absolute',
                  left: `${pixelX}px`,
                  top: `${pixelY}px`,
                  width: `${pixelWidth}px`,
                  height: `${pixelHeight}px`,
                  transform: `rotate(${rotation}deg)`,
                  opacity,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
              >
                {renderItemContent(item)}
              </div>
            );
          })}

          {/* Moveable component for selected item - render outside of items */}
          {selectedElement && (() => {
            const selected = visibleItems.find(v => v.item.id === state.selectedItemId);
            if (!selected) return null;

            return (
              <Moveable
                target={selectedElement}
                draggable={true}
                resizable={true}
                rotatable={true}
                keepRatio={selected.item.lockAspectRatio || false}
                origin={false}
                throttleDrag={0}
                throttleResize={0}
                throttleRotate={0}
                onDrag={handleDrag(selected.trackId, selected.item.id)}
                onResize={handleResize(selected.trackId, selected.item.id, selected.item)}
                onRotate={handleRotate(selected.trackId, selected.item.id)}
              />
            );
          })()}
        </div>
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
    padding: '6px 16px',
    backgroundColor: '#0066ff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  frameCounter: {
    fontSize: '14px',
    color: '#aaaaaa',
  },
  zoomControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 8px',
    backgroundColor: '#1a1a1a',
    borderRadius: '4px',
  },
  zoomButton: {
    width: '28px',
    height: '28px',
    padding: 0,
    backgroundColor: '#3a3a3a',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDisplay: {
    fontSize: '13px',
    color: '#ffffff',
    minWidth: '45px',
    textAlign: 'center',
  },
  resetButton: {
    padding: '4px 10px',
    backgroundColor: '#3a3a3a',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  canvasWrapper: {
    flex: 1,
    padding: '20px',
    overflow: 'hidden',
    backgroundColor: '#2a2a2a',
    minWidth: 0,
    minHeight: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};
