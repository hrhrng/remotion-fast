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
const ItemComponent: React.FC<{ item: Item; durationInFrames: number }> = ({ item, durationInFrames }) => {
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
    // Log once per item id for debugging startFrom
    const loggedRef = React.useRef(false);
    if (!loggedRef.current) {
      try {
        console.log('[Preview] Video render', {
          id: item.id,
          from: item.from,
          durationInFrames: item.durationInFrames,
          sourceStartInFrames: (item as any).sourceStartInFrames || 0,
        });
      } catch {}
      loggedRef.current = true;
    }
    const sourceStart = (item as any).sourceStartInFrames || 0;

    // Calculate audio volume with fade in/out
    const audioFadeIn = item.audioFadeIn || 0;
    const audioFadeOut = item.audioFadeOut || 0;

    let audioVolume = 1;

    // Fade in
    if (audioFadeIn > 0 && frame < audioFadeIn) {
      audioVolume = interpolate(frame, [0, audioFadeIn], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }

    // Fade out
    if (audioFadeOut > 0 && frame > durationInFrames - audioFadeOut) {
      audioVolume = interpolate(frame, [durationInFrames - audioFadeOut, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }

    return (
      <AbsoluteFill>
        <OffthreadVideo
          src={item.src}
          style={{ width: '100%', height: '100%' }}
          // posterFrame is supported at runtime but not yet in type definitions
          {...({ posterFrame: sourceStart } as any)}
          startFrom={sourceStart}
          volume={audioVolume}
        />
      </AbsoluteFill>
    );
  }

  if (item.type === 'audio') {
    const loggedRef = React.useRef(false);
    if (!loggedRef.current) {
      try {
        console.log('[Preview] Audio render', {
          id: item.id,
          from: item.from,
          durationInFrames: item.durationInFrames,
          sourceStartInFrames: (item as any).sourceStartInFrames || 0,
        });
      } catch {}
      loggedRef.current = true;
    }
    // Calculate audio volume with fade in/out
    const audioFadeIn = item.audioFadeIn || 0;
    const audioFadeOut = item.audioFadeOut || 0;
    const baseVolume = item.volume || 1;

    let volumeMultiplier = 1;

    // Fade in
    if (audioFadeIn > 0 && frame < audioFadeIn) {
      volumeMultiplier = interpolate(frame, [0, audioFadeIn], [0, 1], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }

    // Fade out
    if (audioFadeOut > 0 && frame > durationInFrames - audioFadeOut) {
      volumeMultiplier = interpolate(frame, [durationInFrames - audioFadeOut, durationInFrames], [1, 0], {
        extrapolateLeft: 'clamp',
        extrapolateRight: 'clamp',
      });
    }

    return <Audio src={item.src} startFrom={(item as any).sourceStartInFrames || 0} volume={baseVolume * volumeMultiplier} />;
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
const TrackComponent: React.FC<{ track: Track }> = ({ track }) => {
  if (track.hidden) {
    return null;
  }

  return (
    <AbsoluteFill>
      {track.items.map((item) => (
        <Sequence key={item.id} from={item.from} durationInFrames={item.durationInFrames}>
          <ItemComponent item={item} durationInFrames={item.durationInFrames} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

// Main composition component
export const VideoComposition: React.FC<{ tracks: Track[] }> = ({ tracks }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: 'white' }}>
      {tracks.map((track) => (
        <TrackComponent key={track.id} track={track} />
      ))}
    </AbsoluteFill>
  );
};
