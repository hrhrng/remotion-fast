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
import type { Track, Item } from '../types';

// Component to render individual items
const ItemComponent: React.FC<{ item: Item }> = ({ item }) => {
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
    return (
      <AbsoluteFill>
        <OffthreadVideo src={item.src} style={{ width: '100%', height: '100%' }} />
      </AbsoluteFill>
    );
  }

  if (item.type === 'audio') {
    return <Audio src={item.src} volume={item.volume || 1} />;
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
          <ItemComponent item={item} />
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
