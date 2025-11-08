import React from 'react';
import {
  AbsoluteFill,
  Sequence,
  OffthreadVideo,
  Audio,
  Img,
  useCurrentFrame,
  interpolate,
} from 'remotion';
import type { Track, Item } from '@remotion-fast/core';

// Helper function to apply canvas properties
const getCanvasStyle = (item: Item, frame: number, durationInFrames: number): React.CSSProperties => {
  const style: React.CSSProperties = {};

  // Apply position (default to center: 50%, 50%)
  const x = item.x ?? 50;
  const y = item.y ?? 50;
  const width = item.width ?? 100;
  const height = item.height ?? 100;

  // Apply transform
  const transforms: string[] = [];

  // Position: translate from center
  transforms.push(`translate(${x - 50}%, ${y - 50}%)`);

  // Rotation
  if (item.rotation) {
    transforms.push(`rotate(${item.rotation}deg)`);
  }

  style.transform = transforms.join(' ');
  style.width = `${width}%`;
  style.height = `${height}%`;
  style.left = '50%';
  style.top = '50%';
  style.position = 'absolute';

  // Apply opacity with fade in/out
  let opacity = item.opacity ?? 1;

  // Fade in
  if (item.fadeIn && frame < item.fadeIn) {
    const fadeInProgress = interpolate(frame, [0, item.fadeIn], [0, 1], {
      extrapolateRight: 'clamp',
    });
    opacity *= fadeInProgress;
  }

  // Fade out
  if (item.fadeOut && frame > durationInFrames - item.fadeOut) {
    const fadeOutProgress = interpolate(
      frame,
      [durationInFrames - item.fadeOut, durationInFrames],
      [1, 0],
      { extrapolateRight: 'clamp' }
    );
    opacity *= fadeOutProgress;
  }

  style.opacity = opacity;

  return style;
};

// Component to render individual items
const ItemComponent: React.FC<{ item: Item; durationInFrames: number; visibleFrom?: number; endFrame?: number; globalEndFrame?: number }> = ({ item, durationInFrames, visibleFrom, endFrame, globalEndFrame }) => {
  const frame = useCurrentFrame();
  const canvasStyle = item.type !== 'audio' ? getCanvasStyle(item, frame, durationInFrames) : {};

  if (item.type === 'solid') {
    return (
      <div style={canvasStyle}>
        <AbsoluteFill style={{ backgroundColor: item.color }} />
      </div>
    );
  }

  if (item.type === 'text') {
    return (
      <div style={canvasStyle}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <h1
            style={{
              color: item.color,
              fontSize: item.fontSize || 60,
              fontFamily: item.fontFamily || 'Arial',
              fontWeight: item.fontWeight || 'bold',
              textAlign: 'center',
              padding: '0 40px',
            }}
          >
            {item.text}
          </h1>
        </AbsoluteFill>
      </div>
    );
  }

  if (item.type === 'video') {
    const sourceStart = (item as any).sourceStartInFrames || 0;
    const isBeforeVisible = typeof visibleFrom === 'number' ? frame < visibleFrom : false;
    const isLastFrameOfItem = typeof endFrame === 'number' ? frame === endFrame : false;
    const shouldHideLastFrame = typeof globalEndFrame === 'number' && typeof endFrame === 'number'
      ? (endFrame !== globalEndFrame && isLastFrameOfItem)
      : false;
    const hidden = isBeforeVisible || shouldHideLastFrame;

    const videoStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
    };

    if (item.cornerRadius) {
      videoStyle.borderRadius = `${item.cornerRadius}px`;
    }

    return (
      <div style={canvasStyle}>
        <AbsoluteFill style={{ backgroundColor: 'black', overflow: 'hidden', borderRadius: item.cornerRadius ? `${item.cornerRadius}px` : undefined }}>
          <AbsoluteFill style={{ opacity: hidden ? 0 : 1 }}>
            <OffthreadVideo
              src={item.src}
              style={videoStyle}
              startFrom={sourceStart}
              pauseWhenBuffering={false}
              acceptableTimeShiftInSeconds={0.25}
              muted={hidden}
              volume={1}
            />
          </AbsoluteFill>
        </AbsoluteFill>
      </div>
    );
  }

  if (item.type === 'audio') {
    const sourceStart = (item as any).sourceStartInFrames || 0;
    const baseVolume = item.volume || 1;
    return <Audio src={item.src} startFrom={sourceStart} volume={baseVolume} />;
  }

  if (item.type === 'image') {
    const imageStyle: React.CSSProperties = {
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: 'contain',
    };

    if (item.cornerRadius) {
      imageStyle.borderRadius = `${item.cornerRadius}px`;
    }

    return (
      <div style={canvasStyle}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Img src={item.src} style={imageStyle} />
        </AbsoluteFill>
      </div>
    );
  }

  return null;
};

// Component to render a single track
const TrackComponent: React.FC<{ track: Track; globalEndFrame: number }> = ({ track, globalEndFrame }) => {
  if (track.hidden) {
    return null;
  }

  // 合并同源且时间/偏移连续的媒体分段（仅渲染层副本，不改state）
  const mergeContiguousMediaItems = (items: Item[]): Item[] => {
    const sorted = [...items].sort((a, b) => a.from - b.from);
    const result: Item[] = [];

    for (const itm of sorted) {
      const last = result[result.length - 1];
      const isMedia = itm.type === 'video' || itm.type === 'audio';
      const lastIsMedia = last && (last.type === 'video' || last.type === 'audio');

      if (
        last && isMedia && lastIsMedia && ('src' in itm) && ('src' in last) && (itm as any).src === (last as any).src
      ) {
        const lastEnd = last.from + last.durationInFrames;
        const isContiguous = itm.from === lastEnd;
        const lastOffset = (last as any).sourceStartInFrames || 0;
        const currOffset = (itm as any).sourceStartInFrames || 0;
        const offsetContinuous = currOffset === lastOffset + last.durationInFrames;

        if (isContiguous && offsetContinuous) {
          // 合并：延长上一段的时长（使用副本）
          const extended = { ...last, durationInFrames: last.durationInFrames + itm.durationInFrames } as Item;
          result[result.length - 1] = extended;
          continue;
        }
      }

      result.push({ ...itm } as Item);
    }

    return result;
  };

  const playbackItems = mergeContiguousMediaItems(track.items);

  const PREMOUNT_FRAMES = 45; // ~1.5秒@30fps，提前挂载以减少边界卡顿

  return (
    <AbsoluteFill>
      {playbackItems.map((item, idx) => {
        const prev = idx > 0 ? playbackItems[idx - 1] : undefined;
        const isPrevContiguous = prev && (prev.type === item.type) && ('src' in prev) && ('src' in item)
          && (prev as any).src === (item as any).src
          && (prev.from + prev.durationInFrames === item.from)
          && (((prev as any).sourceStartInFrames || 0) + prev.durationInFrames === ((item as any).sourceStartInFrames || 0));

        const seqFrom = isPrevContiguous ? Math.max(0, item.from - 1) : item.from;
        const visibleFrom = item.from;
        const endFrame = item.from + item.durationInFrames - 1;

        return (
          <Sequence key={item.id} from={seqFrom} durationInFrames={item.durationInFrames} premountFor={PREMOUNT_FRAMES}>
            <ItemComponent item={item} durationInFrames={item.durationInFrames} visibleFrom={visibleFrom} endFrame={endFrame} globalEndFrame={globalEndFrame} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

// Main composition component
export const VideoComposition: React.FC<{ tracks: Track[] }> = ({ tracks }) => {
  // 计算全局最后一帧（与上面的 TrackComponent 用到的 globalEndFrame 保持一致）
  const globalEndFrame = React.useMemo(() => {
    let maxEnd = 0;
    for (const t of tracks) {
      for (const itm of t.items) {
        const end = itm.from + itm.durationInFrames - 1;
        if (end > maxEnd) maxEnd = end;
      }
    }
    return maxEnd;
  }, [tracks]);

  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
      {tracks.map((track) => (
        <TrackComponent key={track.id} track={track} globalEndFrame={globalEndFrame} />
      ))}
    </AbsoluteFill>
  );
};
