import React, { useRef, useEffect, useMemo } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { VideoComposition } from '../remotion/VideoComposition';
import { useEditor } from '../state/EditorContext';

export const PreviewCanvas: React.FC = () => {
  const { state, dispatch } = useEditor();
  const playerRef = useRef<PlayerRef>(null);

  // Prepare input props for the Player
  const inputProps = useMemo(() => {
    return {
      tracks: state.tracks,
    };
  }, [state.tracks]);

  // Sync player frame with editor state
  useEffect(() => {
    if (playerRef.current && !state.playing) {
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

  const handleFrameUpdate = (frame: number) => {
    dispatch({ type: 'SET_CURRENT_FRAME', payload: frame });
  };

  const handlePlayingChange = (playing: boolean) => {
    dispatch({ type: 'SET_PLAYING', payload: playing });
  };

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
          onPause={() => handlePlayingChange(false)}
          onPlay={() => handlePlayingChange(true)}
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
