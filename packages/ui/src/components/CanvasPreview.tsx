import React, { useRef, useEffect, useMemo, useState } from "react";
import { Player, PlayerRef } from "@remotion/player";
import { useEditor } from "@remotion-fast/core";
import { VideoComposition } from "@remotion-fast/remotion-components";

// Time formatting utilities
const formatTime = (frame: number, fps: number) => {
  const totalSeconds = frame / fps;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const frameNumber = frame % fps;

  return {
    minutes: minutes.toString().padStart(2, "0"),
    seconds: seconds.toString().padStart(2, "0"),
    frames: frameNumber.toString().padStart(2, "0"),
  };
};

export const CanvasPreview: React.FC = () => {
  const { state, dispatch } = useEditor();
  const playerRef = useRef<PlayerRef>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Calculate duration from timeline (max end frame of all items)
  const timelineDuration = useMemo(() => {
    let maxEnd = 0;
    for (const track of state.tracks) {
      for (const item of track.items) {
        const end = item.from + item.durationInFrames;
        if (end > maxEnd) maxEnd = end;
      }
    }
    return maxEnd > 0 ? maxEnd : 300; // 300 frames = 10 seconds at 30fps as fallback
  }, [state.tracks]);

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
    if (lastDispatchedFrameRef.current === frame) return;

    const now = performance.now();
    const minIntervalMs = 40;
    if (now - lastDispatchTsRef.current < minIntervalMs && state.playing)
      return;

    lastDispatchTsRef.current = now;
    lastDispatchedFrameRef.current = frame;

    if (frame !== state.currentFrame) {
      isSyncingFromPlayer.current = true;
      dispatch({ type: "SET_CURRENT_FRAME", payload: frame });
      setTimeout(() => {
        isSyncingFromPlayer.current = false;
      }, 0);
    }
  };

  // Attach player event listeners
  useEffect(() => {
    const player = playerRef.current as any;
    if (!player) return;

    const onFrame = () => {
      const frame = player.getCurrentFrame();
      handleFrameUpdate(frame);
    };

    const onPlay = () => dispatch({ type: "SET_PLAYING", payload: true });
    const onPause = () => dispatch({ type: "SET_PLAYING", payload: false });

    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("play", onPlay);
    player.addEventListener("pause", onPause);

    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("play", onPlay);
      player.removeEventListener("pause", onPause);
    };
  }, [dispatch]);

  // Format current and total time
  const currentTime = formatTime(state.currentFrame, state.fps);
  const totalTime = formatTime(timelineDuration, state.fps);

  // Progress bar handlers
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = clickX / rect.width;
    const newFrame = Math.round(percentage * timelineDuration);
    dispatch({
      type: "SET_CURRENT_FRAME",
      payload: Math.max(0, Math.min(newFrame, timelineDuration)),
    });
  };

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    handleProgressClick(e);
  };

  const handleProgressMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleProgressClick(e);
    }
  };

  const handleProgressMouseUp = () => {
    setIsDragging(false);
  };

  // Global mouse up listener for progress bar
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      document.addEventListener("mouseup", handleGlobalMouseUp);
      return () => document.removeEventListener("mouseup", handleGlobalMouseUp);
    }
  }, [isDragging]);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Canvas Preview</h2>
      </div>

      {/* Canvas Area */}
      <div style={styles.canvasWrapper}>
        <div style={styles.canvas}>
          <Player
            ref={playerRef}
            component={VideoComposition}
            compositionWidth={state.compositionWidth}
            compositionHeight={state.compositionHeight}
            durationInFrames={timelineDuration}
            fps={state.fps}
            inputProps={inputProps}
            style={{

                   width: '100%',
                  height: '100%',
                  display: 'block',
                  borderRadius: '8px',
                  overflow: 'hidden',
            }}
            controls={false} // Disable default controls since we're building custom ones
            loop={false}
          />
        </div>
      </div>

      {/* Custom Controls */}
      <div style={styles.controlsWrapper}>
        <div style={styles.controls}>
          {/* Play/Pause Button */}
          <button
            onClick={() =>
              dispatch({ type: "SET_PLAYING", payload: !state.playing })
            }
            style={styles.playButton}
          >
            {state.playing ? (
              // Pause icon
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              // Play icon
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Time Display */}
          <div style={styles.timeDisplay}>
            <span style={styles.currentTime}>
              {currentTime.minutes}:{currentTime.seconds}:{currentTime.frames}
            </span>
            <span style={styles.timeSeparator}>/</span>
            <span style={styles.totalTime}>
              {totalTime.minutes}:{totalTime.seconds}:{totalTime.frames}
            </span>
          </div>

          {/* Progress Bar */}
          <div
            style={styles.progressContainer}
            onMouseDown={handleProgressMouseDown}
            onMouseMove={handleProgressMouseMove}
            onMouseUp={handleProgressMouseUp}
          >
            <div style={styles.progressTrack}>
              <div
                style={{
                  ...styles.progressFill,
                  width: `${(state.currentFrame / timelineDuration) * 100}%`,
                }}
              />
              <div
                style={{
                  ...styles.progressThumb,
                  left: `${(state.currentFrame / timelineDuration) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    backgroundColor: "#1e1e1e",
    borderRadius: "8px",
    overflow: "hidden",
  },
  header: {
    padding: "12px 16px",
    backgroundColor: "#2d2d2d",
    borderBottom: "1px solid #3d3d3d",
  },
  title: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#ffffff",
  },
  canvasWrapper: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    backgroundColor: "#2a2a2a",
    minWidth: 0,
    minHeight: 0,
  },
  canvas: {
    width: "100%",
    maxWidth: "800px",
    aspectRatio: "16 / 9",
    backgroundColor: "#000000",
    borderRadius: "8px",
    overflow: "hidden",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)",
    display: 'block',
    transformOrigin: 'top left',
  },
  controlsWrapper: {
    padding: "16px",
    backgroundColor: "#2d2d2d",
    borderTop: "1px solid #3d3d3d",
  },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    maxWidth: "800px",
    margin: "0 auto",
  },
  playButton: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#0066ff",
    border: "none",
    color: "white",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s ease",
    flexShrink: 0,
  },
  timeDisplay: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "14px",
    fontFamily: "monospace",
    color: "#ffffff",
    minWidth: "140px",
    flexShrink: 0,
  },
  currentTime: {
    color: "#ffffff",
    fontWeight: 600,
  },
  timeSeparator: {
    color: "#888888",
    margin: "0 4px",
  },
  totalTime: {
    color: "#aaaaaa",
  },
  progressContainer: {
    flex: 1,
    height: "40px",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
    padding: "0 8px",
  },
  progressTrack: {
    position: "relative",
    width: "100%",
    height: "4px",
    backgroundColor: "#444444",
    borderRadius: "2px",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0066ff",
    borderRadius: "2px",
    transition: "width 0.1s ease",
  },
  progressThumb: {
    position: "absolute",
    top: "50%",
    width: "16px",
    height: "16px",
    backgroundColor: "#0066ff",
    borderRadius: "50%",
    transform: "translate(-50%, -50%)",
    boxShadow: "0 2px 6px rgba(0, 0, 0, 0.3)",
    transition: "left 0.1s ease",
  },
};
