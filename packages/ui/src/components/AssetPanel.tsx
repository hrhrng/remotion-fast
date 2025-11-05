import React, { useRef } from 'react';
import { useEditor } from '@remotion-fast/core';
import type { Asset, TextItem, ImageItem, VideoItem } from '@remotion-fast/core';
import { loadAudioWaveform } from '@remotion-fast/core';

export const AssetPanel: React.FC = () => {
  const { state, dispatch } = useEditor();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateVideoThumbnail = (videoUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.src = videoUrl;
      video.crossOrigin = 'anonymous';
      video.preload = 'metadata';

      video.addEventListener('loadedmetadata', async () => {
        try {
          const duration = video.duration;
          const frameInterval = 1; // 每1秒提取一帧
          const startTime = 0.1; // 从0.1秒开始
          const frameCount = Math.min(Math.floor((duration - startTime) / frameInterval) + 1, 20); // 最多20帧

          const frameWidth = video.videoWidth;
          const frameHeight = video.videoHeight;

          // 创建一个宽画布来容纳所有帧
          const canvas = document.createElement('canvas');
          canvas.width = frameWidth * frameCount;
          canvas.height = frameHeight;
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            resolve(videoUrl);
            return;
          }

          // 提取每一帧
          for (let i = 0; i < frameCount; i++) {
            const time = startTime + i * frameInterval;

            // 等待视频跳转到指定时间
            await new Promise<void>((resolveSeek) => {
              const seeked = () => {
                video.removeEventListener('seeked', seeked);
                resolveSeek();
              };
              video.addEventListener('seeked', seeked);
              video.currentTime = Math.min(time, duration - 0.1);
            });

            // 将当前帧绘制到画布上
            ctx.drawImage(video, i * frameWidth, 0, frameWidth, frameHeight);
          }

          // 将画布转换为blob
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(URL.createObjectURL(blob));
            } else {
              resolve(videoUrl);
            }
          }, 'image/jpeg', 0.75);
        } catch (err) {
          console.error('Error generating thumbnail:', err);
          resolve(videoUrl);
        }
      });

      video.addEventListener('error', () => {
        resolve(videoUrl); // fallback on error
      });
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      const url = URL.createObjectURL(file);
      const type = file.type.startsWith('video')
        ? 'video'
        : file.type.startsWith('audio')
          ? 'audio'
          : 'image';

      let thumbnail: string | undefined;
      let waveform: number[] | undefined;

      // Generate thumbnail for video
      if (type === 'video') {
        thumbnail = await generateVideoThumbnail(url);
      }

      // Generate waveform for audio and video
      if (type === 'audio' || type === 'video') {
        try {
          waveform = await loadAudioWaveform(url, 500); // Increased from 100 to 500 for finer granularity
        } catch (error) {
          console.error('Error generating waveform:', error);
        }
      }

      const asset: Asset = {
        id: `asset-${Date.now()}-${Math.random()}`,
        name: file.name,
        type: type as 'video' | 'audio' | 'image',
        src: url,
        thumbnail,
        waveform,
        createdAt: Date.now(),
      };

      dispatch({ type: 'ADD_ASSET', payload: asset });
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleAssetDragStart = (e: React.DragEvent, asset: Asset) => {
    e.dataTransfer.setData('asset', JSON.stringify(asset));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleAddTextToTrack = () => {
    const firstTrack = state.tracks[0];
    if (firstTrack) {
      const textItem: TextItem = {
        id: `text-${Date.now()}`,
        type: 'text',
        text: 'Double click to edit',
        color: '#000000',
        from: state.currentFrame,
        durationInFrames: 90, // 3 seconds at 30fps
        fontSize: 60,
      };

      dispatch({
        type: 'ADD_ITEM',
        payload: { trackId: firstTrack.id, item: textItem },
      });
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Assets</h2>
      </div>

      <div style={styles.content}>
        {/* Quick Add Section */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Quick Add</h3>
          <div style={styles.quickButtons}>
            <button onClick={handleAddTextToTrack} style={styles.quickButton}>
              + Text
            </button>
            <button
              onClick={() => {
                const firstTrack = state.tracks[0];
                if (firstTrack) {
                  dispatch({
                    type: 'ADD_ITEM',
                    payload: {
                      trackId: firstTrack.id,
                      item: {
                        id: `solid-${Date.now()}`,
                        type: 'solid',
                        color: '#' + Math.floor(Math.random() * 16777215).toString(16),
                        from: state.currentFrame,
                        durationInFrames: 60,
                      },
                    },
                  });
                }
              }}
              style={styles.quickButton}
            >
              + Color
            </button>
          </div>
        </div>

        {/* Upload Section */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Media Files</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*,audio/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            style={styles.uploadButton}
          >
            Upload Files
          </button>
        </div>

        {/* Assets List */}
        <div style={styles.assetsList}>
          {state.assets.length === 0 ? (
            <div style={styles.emptyState}>No assets uploaded yet</div>
          ) : (
            state.assets.map((asset) => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => handleAssetDragStart(e, asset)}
                style={styles.assetItem}
              >
                {asset.type === 'image' && (
                  <img
                    src={asset.src}
                    alt={asset.name}
                    style={styles.assetThumbnail}
                  />
                )}
                {asset.type === 'video' && (
                  <img
                    src={asset.thumbnail || asset.src}
                    alt={asset.name}
                    style={styles.assetThumbnail}
                  />
                )}
                {asset.type === 'audio' && (
                  <div style={styles.audioIcon}>🎵</div>
                )}
                <div style={styles.assetInfo}>
                  <div style={styles.assetName}>{asset.name}</div>
                  <div style={styles.assetType}>{asset.type}</div>
                </div>
                <button
                  onClick={() => dispatch({ type: 'REMOVE_ASSET', payload: asset.id })}
                  style={styles.deleteButton}
                >
                  ×
                </button>
              </div>
            ))
          )}
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
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    fontSize: '14px',
    fontWeight: 600,
    color: '#aaaaaa',
    textTransform: 'uppercase',
  },
  quickButtons: {
    display: 'flex',
    gap: '8px',
  },
  quickButton: {
    flex: 1,
    padding: '8px',
    backgroundColor: '#3d3d3d',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
  },
  uploadButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0066ff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  assetsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  emptyState: {
    textAlign: 'center',
    color: '#666666',
    fontSize: '14px',
    padding: '32px 16px',
  },
  assetItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px',
    backgroundColor: '#2d2d2d',
    borderRadius: '4px',
    cursor: 'move',
    gap: '12px',
  },
  assetThumbnail: {
    width: '48px',
    height: '48px',
    objectFit: 'cover',
    borderRadius: '4px',
    backgroundColor: '#3d3d3d',
  },
  audioIcon: {
    width: '48px',
    height: '48px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3d3d3d',
    borderRadius: '4px',
    fontSize: '24px',
  },
  assetInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  assetName: {
    fontSize: '14px',
    color: '#ffffff',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  assetType: {
    fontSize: '12px',
    color: '#aaaaaa',
    textTransform: 'capitalize',
  },
  deleteButton: {
    width: '24px',
    height: '24px',
    backgroundColor: '#ff4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: '1',
  },
};
