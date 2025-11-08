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

// Component to render individual items
const ItemComponent: React.FC<{ item: Item; durationInFrames: number; visibleFrom?: number; endFrame?: number; globalEndFrame?: number }> = ({ item, durationInFrames, visibleFrom, endFrame, globalEndFrame }) => {
  const frame = useCurrentFrame();

  if (item.type === 'solid') {
    return <AbsoluteFill style={{ backgroundColor: item.color }} />;
  }

  if (item.type === 'text') {
    const opacity = interpolate(frame, [0, 10], [0, 1], {
      extrapolateRight: 'clamp',
    });

    return (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
          opacity,
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

    return (
      <AbsoluteFill style={{ backgroundColor: 'black' }}>
        <AbsoluteFill style={{ opacity: hidden ? 0 : 1 }}>
          <OffthreadVideo
            src={item.src}
            style={{ width: '100%', height: '100%' }}
            startFrom={sourceStart}
            pauseWhenBuffering={false}
            acceptableTimeShiftInSeconds={0.25}
            muted={hidden}
            volume={1}
          />
        </AbsoluteFill>
      </AbsoluteFill>
    );
  }

  if (item.type === 'audio') {
    const sourceStart = (item as any).sourceStartInFrames || 0;
    const baseVolume = item.volume || 1;
    return <Audio src={item.src} startFrom={sourceStart} volume={baseVolume} />;
  }

  if (item.type === 'image') {
    return (
      <AbsoluteFill
        style={{
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Img src={item.src} style={{ maxWidth: '100%', maxHeight: '100%' }} />
      </AbsoluteFill>
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
