import React from 'react';
import { useEditor } from '@remotion-fast/core';
import type { TextItem, SolidItem, VideoItem, AudioItem } from '@remotion-fast/core';


export const PropertiesPanel: React.FC = () => {
  const { state, dispatch } = useEditor();
  const [showExportModal, setShowExportModal] = React.useState(false);

  // Find selected item
  const selectedItem = state.selectedItemId
    ? state.tracks
        .flatMap((t) => t.items.map((i) => ({ trackId: t.id, item: i })))
        .find((x) => x.item.id === state.selectedItemId)
    : null;

  // Calculate split quality and recommendations (must be before early return)
  const selectedItemData = selectedItem?.item;
  const itemEnd = selectedItemData ? selectedItemData.from + selectedItemData.durationInFrames : 0;
  const canSplit = selectedItemData ? (state.currentFrame > selectedItemData.from && state.currentFrame < itemEnd) : false;

  

  

  // Format time helper
  const formatTime = (frames: number): string => {
    const totalSeconds = frames / state.fps;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const centiseconds = Math.floor(((totalSeconds % 1) * 100));
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  };

  // Canvas properties when no item is selected
  if (!selectedItem) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>Properties</h2>
        </div>
        <div style={styles.content}>
          {/* Canvas Section */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Canvas</h3>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>W</label>
                <input
                  type="number"
                  value={state.compositionWidth}
                  onChange={(e) => dispatch({
                    type: 'SET_COMPOSITION_SIZE',
                    payload: {
                      width: parseInt(e.target.value) || 1920,
                      height: state.compositionHeight,
                    },
                  })}
                  style={styles.input}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>H</label>
                <input
                  type="number"
                  value={state.compositionHeight}
                  onChange={(e) => dispatch({
                    type: 'SET_COMPOSITION_SIZE',
                    payload: {
                      width: state.compositionWidth,
                      height: parseInt(e.target.value) || 1080,
                    },
                  })}
                  style={styles.input}
                />
              </div>
              <button
                onClick={() => dispatch({
                  type: 'SET_COMPOSITION_SIZE',
                  payload: {
                    width: state.compositionHeight,
                    height: state.compositionWidth,
                  },
                })}
                style={styles.iconButton}
                title="Swap dimensions"
              >
                ⟲
              </button>
            </div>
          </div>

          {/* Duration Section */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Duration</h3>
            <div style={styles.durationDisplay}>
              {formatTime(state.durationInFrames)}
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Duration (frames)</label>
              <input
                type="number"
                value={state.durationInFrames}
                onChange={(e) => dispatch({
                  type: 'SET_DURATION',
                  payload: parseInt(e.target.value) || 600,
                })}
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Frame Rate (FPS)</label>
              <div style={styles.fpsDisplay}>{state.fps} fps</div>
            </div>
          </div>

          {/* Export Section */}
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Export</h3>
            <div style={styles.field}>
              <div style={styles.formatDisplay}>MP4 (H.264)</div>
            </div>
            <button
              onClick={() => setShowExportModal(true)}
              style={styles.renderButton}
            >
              Render video
            </button>
          </div>
        </div>

        {/* Export Modal */}
        {showExportModal && (
          <div style={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.modalTitle}>Export Video</h2>
              <p style={styles.modalText}>
                To render your video, use one of these methods:
              </p>

              <div style={styles.exportMethod}>
                <h3 style={styles.methodTitle}>Method 1: Command Line</h3>
                <div style={styles.commandContainer}>
                  <code style={styles.commandText}>
                    npx remotion render src/remotion/index.tsx VideoComposition out/video.mp4
                  </code>
                </div>
                <p style={styles.methodDesc}>
                  Run this in your terminal to render the video
                </p>
              </div>

              <div style={styles.exportMethod}>
                <h3 style={styles.methodTitle}>Method 2: Remotion Studio (Recommended)</h3>
                <div style={styles.commandContainer}>
                  <code style={styles.commandText}>npm run dev</code>
                </div>
                <p style={styles.methodDesc}>
                  Opens Remotion Studio at localhost:3002 with GUI render controls
                </p>
              </div>

              <button onClick={() => setShowExportModal(false)} style={styles.closeButton}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const { trackId, item } = selectedItem;

  const updateItem = (updates: Partial<typeof item>) => {
    dispatch({
      type: 'UPDATE_ITEM',
      payload: { trackId, itemId: item.id, updates },
    });
  };

  const deleteItem = () => {
    dispatch({
      type: 'REMOVE_ITEM',
      payload: { trackId, itemId: item.id },
    });
  };

  const splitItem = () => {
    if (!canSplit) return;

    dispatch({
      type: 'SPLIT_ITEM',
      payload: {
        trackId,
        itemId: item.id,
        splitFrame: state.currentFrame,
      },
    });
  };

  

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>Properties</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={splitItem}
            disabled={!canSplit}
            style={{
              ...styles.splitButton,
              opacity: canSplit ? 1 : 0.5,
              cursor: canSplit ? 'pointer' : 'not-allowed',
            }}
            title={
              canSplit
                ? `Split at frame ${state.currentFrame}`
                : 'Move playhead onto the selected item to split'
            }
          >
            Split
          </button>
          <button onClick={deleteItem} style={styles.deleteButton}>
            Delete
          </button>
        </div>
      </div>

      <div style={styles.content}>
        
        {/* Common Properties */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Timing</h3>
          <div style={styles.field}>
            <label style={styles.label}>Start Frame</label>
            <input
              type="number"
              value={item.from}
              onChange={(e) => updateItem({ from: parseInt(e.target.value) || 0 })}
              style={styles.input}
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Duration (frames)</label>
            <input
              type="number"
              value={item.durationInFrames}
              onChange={(e) =>
                updateItem({ durationInFrames: parseInt(e.target.value) || 1 })
              }
              style={styles.input}
            />
          </div>
        </div>

        {/* Text Item Properties */}
        {item.type === 'text' && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Text</h3>
            <div style={styles.field}>
              <label style={styles.label}>Content</label>
              <textarea
                value={(item as TextItem).text}
                onChange={(e) => updateItem({ text: e.target.value })}
                style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Color</label>
              <div style={styles.colorPicker}>
                <input
                  type="color"
                  value={(item as TextItem).color}
                  onChange={(e) => updateItem({ color: e.target.value })}
                  style={styles.colorInput}
                />
                <input
                  type="text"
                  value={(item as TextItem).color}
                  onChange={(e) => updateItem({ color: e.target.value })}
                  style={{ ...styles.input, flex: 1 }}
                />
              </div>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Font Size</label>
              <input
                type="number"
                value={(item as TextItem).fontSize || 60}
                onChange={(e) =>
                  updateItem({ fontSize: parseInt(e.target.value) || 60 })
                }
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Font Family</label>
              <select
                value={(item as TextItem).fontFamily || 'Arial'}
                onChange={(e) => updateItem({ fontFamily: e.target.value })}
                style={styles.input}
              >
                <option value="Arial">Arial</option>
                <option value="Helvetica">Helvetica</option>
                <option value="Times New Roman">Times New Roman</option>
                <option value="Georgia">Georgia</option>
                <option value="Courier New">Courier New</option>
                <option value="Verdana">Verdana</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Font Weight</label>
              <select
                value={(item as TextItem).fontWeight || 'bold'}
                onChange={(e) => updateItem({ fontWeight: e.target.value })}
                style={styles.input}
              >
                <option value="normal">Normal</option>
                <option value="bold">Bold</option>
                <option value="lighter">Lighter</option>
                <option value="bolder">Bolder</option>
              </select>
            </div>
          </div>
        )}

        {/* Solid Item Properties */}
        {item.type === 'solid' && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Color</h3>
            <div style={styles.field}>
              <label style={styles.label}>Background Color</label>
              <div style={styles.colorPicker}>
                <input
                  type="color"
                  value={(item as SolidItem).color}
                  onChange={(e) => updateItem({ color: e.target.value })}
                  style={styles.colorInput}
                />
                <input
                  type="text"
                  value={(item as SolidItem).color}
                  onChange={(e) => updateItem({ color: e.target.value })}
                  style={{ ...styles.input, flex: 1 }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Video/Image/Audio Properties */}
        {(item.type === 'video' || item.type === 'image' || item.type === 'audio') && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Source</h3>
            <div style={styles.field}>
              <label style={styles.label}>File Path</label>
              <input
                type="text"
                value={item.src}
                readOnly
                style={{ ...styles.input, backgroundColor: '#2d2d2d' }}
              />
            </div>
          </div>
        )}
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
  splitButton: {
    padding: '6px 12px',
    backgroundColor: '#0066ff',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  deleteButton: {
    padding: '6px 12px',
    backgroundColor: '#ff4444',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px',
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#666666',
    fontSize: '14px',
    padding: '32px 16px',
    textAlign: 'center',
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
  field: {
    marginBottom: '12px',
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#aaaaaa',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '8px',
    backgroundColor: '#3d3d3d',
    color: '#ffffff',
    border: '1px solid #4d4d4d',
    borderRadius: '4px',
    fontSize: '14px',
    fontFamily: 'inherit',
  },
  colorPicker: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  colorInput: {
    width: '48px',
    height: '36px',
    padding: '2px',
    backgroundColor: '#3d3d3d',
    border: '1px solid #4d4d4d',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  iconButton: {
    padding: '8px 12px',
    backgroundColor: '#3d3d3d',
    color: '#ffffff',
    border: '1px solid #4d4d4d',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '18px',
    lineHeight: '1',
    minWidth: '40px',
  },
  durationDisplay: {
    fontSize: '24px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '16px',
    fontFamily: 'monospace',
  },
  fpsDisplay: {
    padding: '8px',
    backgroundColor: '#2d2d2d',
    color: '#aaaaaa',
    borderRadius: '4px',
    fontSize: '14px',
  },
  formatDisplay: {
    padding: '12px',
    backgroundColor: '#2d2d2d',
    color: '#ffffff',
    borderRadius: '4px',
    fontSize: '14px',
    textAlign: 'center',
  },
  renderButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#0066ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: '8px',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: '#1e1e1e',
    borderRadius: '12px',
    padding: '32px',
    maxWidth: '600px',
    width: '90%',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
  },
  modalTitle: {
    margin: '0 0 16px 0',
    fontSize: '24px',
    fontWeight: 700,
    color: '#ffffff',
  },
  modalText: {
    margin: '0 0 24px 0',
    fontSize: '14px',
    color: '#aaaaaa',
    lineHeight: 1.6,
  },
  exportMethod: {
    marginBottom: '24px',
    padding: '16px',
    backgroundColor: '#2a2a2a',
    borderRadius: '8px',
  },
  methodTitle: {
    margin: '0 0 12px 0',
    fontSize: '16px',
    fontWeight: 600,
    color: '#ffffff',
  },
  commandContainer: {
    margin: '0 0 8px 0',
    padding: '12px',
    backgroundColor: '#0a0a0a',
    borderRadius: '4px',
    overflowX: 'auto',
  },
  commandText: {
    fontSize: '12px',
    color: '#00ff88',
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-all',
  },
  methodDesc: {
    margin: 0,
    fontSize: '13px',
    color: '#888888',
  },
  closeButton: {
    width: '100%',
    padding: '12px',
    backgroundColor: '#3a3a3a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  warningBox: {
    padding: '12px 16px',
    borderRadius: '8px',
    marginBottom: '16px',
  },
  warningTitle: {
    fontSize: '14px',
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: '6px',
  },
  warningMessage: {
    fontSize: '13px',
    color: '#ffffff',
    lineHeight: 1.5,
    marginBottom: '8px',
    opacity: 0.9,
  },
  warningButton: {
    padding: '6px 12px',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    color: '#ffffff',
    border: '1px solid rgba(255, 255, 255, 0.3)',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 500,
    marginTop: '4px',
  },
};
