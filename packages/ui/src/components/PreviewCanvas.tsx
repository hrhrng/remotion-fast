import React, { useRef, useEffect, useMemo } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { VideoComposition } from '@remotion-fast/remotion-components';
import { useEditor } from '@remotion-fast/core';

export const PreviewCanvas: React.FC = () => {
  const { state, dispatch } = useEditor();
  const playerRef = useRef<PlayerRef>(null);

  // Prepare input props for the Player
  const inputProps = useMemo(() => {
    return {
      tracks: state.tracks,
    };
  }, [state.tracks]);

  // Track whether we're syncing from player to avoid feedback loops
  const isSyncingFromPlayer = useRef(false);
  const lastDispatchTsRef = useRef(0);
  const lastDispatchedFrameRef = useRef<number | null>(null);

  // Sync player frame with editor state (timeline → preview)
  useEffect(() => {
    if (playerRef.current && !state.playing && !isSyncingFromPlayer.current) {
      playerRef.current.seekTo(state.currentFrame);
    }
  }, [state.currentFrame, state.playing]);

  // Update playing state
  useEffect(() => {
    if (playerRef.current) {
      if (state.playing) {
        playerRef.current.play();
      } else {
        playerRef.current.pause();
      }
    }
  }, [state.playing]);

  // Throttled sync from preview → timeline to avoid re-rendering the entire UI every frame
  const handleFrameUpdate = (frame: number) => {
    // Skip if same as last dispatched to avoid redundant work
    if (lastDispatchedFrameRef.current === frame) return;

    const now = performance.now();
    // Throttle to ~25Hz while playing to keep UI smooth
    const minIntervalMs = 40;
    if (now - lastDispatchTsRef.current < minIntervalMs && state.playing) return;

    lastDispatchTsRef.current = now;
    lastDispatchedFrameRef.current = frame;

    if (frame !== state.currentFrame) {
      isSyncingFromPlayer.current = true;
      dispatch({ type: 'SET_CURRENT_FRAME', payload: frame });
      // Allow the seek effect to observe the flag in the same tick
      setTimeout(() => {
        isSyncingFromPlayer.current = false;
      }, 0);
    }
  };

  // Attach player event listeners (frameupdate/play/pause)
  useEffect(() => {
    const player = playerRef.current as any;
    if (!player) return;

    const onFrame = () => {
      const frame = player.getCurrentFrame();
      handleFrameUpdate(frame);
    };

    const onPlay = () => dispatch({ type: 'SET_PLAYING', payload: true });
    const onPause = () => dispatch({ type: 'SET_PLAYING', payload: false });

    player.addEventListener('frameupdate', onFrame);
    player.addEventListener('play', onPlay);
    player.addEventListener('pause', onPause);

    return () => {
      player.removeEventListener('frameupdate', onFrame);
      player.removeEventListener('play', onPlay);
      player.removeEventListener('pause', onPause);
    };
  }, [dispatch]);

  console.log('🎥 PreviewCanvas state:', {
    compositionWidth: state.compositionWidth,
    compositionHeight: state.compositionHeight,
    durationInFrames: state.durationInFrames,
    fps: state.fps,
    currentFrame: state.currentFrame,
    trackCount: state.tracks.length,
    tracks: state.tracks,
    inputProps
  });

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Preview</h2>
        <div style={styles.controls}>
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
      <div style={styles.playerWrapper}>
        <Player
          ref={playerRef}
          component={VideoComposition}
          compositionWidth={state.compositionWidth}
          compositionHeight={state.compositionHeight}
          durationInFrames={state.durationInFrames}
          fps={state.fps}
          inputProps={inputProps}
          style={{
            width: '100%',
            maxHeight: '100%',
            aspectRatio: `${state.compositionWidth} / ${state.compositionHeight}`,
          }}
          controls
          loop
        />
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
  playerWrapper: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '20px',
    overflow: 'auto',
  },
};
