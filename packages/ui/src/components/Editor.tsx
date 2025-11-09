import React from 'react';
import { EditorProvider } from '@remotion-fast/core';
import { CanvasPreview } from './CanvasPreview';
import { Timeline } from './Timeline';
import { AssetPanel } from './AssetPanel';
import { PropertiesPanel } from './PropertiesPanel';

export const Editor: React.FC = () => {
  const [showExportModal, setShowExportModal] = React.useState(false);

  return (
    <EditorProvider>
      <style>{`
        /* Custom scrollbar styles - dark theme, no space taken */
        ::-webkit-scrollbar {
          width: 6px;
          height: 6px;
          background: transparent;
        }

        ::-webkit-scrollbar-track {
          background: transparent;
        }

        ::-webkit-scrollbar-thumb {
          background: transparent;
          border-radius: 3px;
        }

        ::-webkit-scrollbar-corner {
          background: transparent;
        }

        /* Show scrollbar on hover (except timeline container) */
        *:not([data-timeline-container]):hover::-webkit-scrollbar-thumb {
          background: rgba(61, 61, 61, 0.6);
        }

        *:not([data-timeline-container]):hover::-webkit-scrollbar-thumb:hover {
          background: rgba(77, 77, 77, 0.8);
        }

        /* Firefox scrollbar */
        *:not([data-timeline-container]) {
          scrollbar-width: thin;
          scrollbar-color: transparent transparent;
        }

        *:not([data-timeline-container]):hover {
          scrollbar-color: rgba(61, 61, 61, 0.6) transparent;
        }
      `}</style>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.logo}>Remotion Fast</h1>
          <div style={styles.headerActions}>
            <button
              onClick={() => setShowExportModal(true)}
              style={styles.exportButton}
            >
              Export Video
            </button>
            <span style={styles.badge}>Open Source</span>
          </div>
        </header>

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


        <div style={styles.workspace}>
          {/* Left Sidebar - Assets */}
          <aside style={styles.leftSidebar}>
            <AssetPanel />
          </aside>

          {/* Main Content Area */}
          <main style={styles.main}>
            {/* Top Row - Preview and Properties */}
            <div style={styles.topRow}>
              <div style={styles.preview}>
                <CanvasPreview />
              </div>
              <aside style={styles.rightSidebar}>
                <PropertiesPanel />
              </aside>
            </div>

            {/* Timeline Area - Full Width */}
            <div style={styles.timeline}>
              <Timeline />
            </div>
          </main>
        </div>
      </div>
    </EditorProvider>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100vw',
    height: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#0a0a0a',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  header: {
    height: '60px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    backgroundColor: '#1a1a1a',
    borderBottom: '1px solid #2a2a2a',
  },
  logo: {
    margin: 0,
    fontSize: '20px',
    fontWeight: 700,
    color: '#ffffff',
    background: 'linear-gradient(135deg, #0066ff 0%, #00ccff 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  headerActions: {
    display: 'flex',
    gap: '12px',
    alignItems: 'center',
  },
  badge: {
    padding: '6px 12px',
    backgroundColor: '#2a2a2a',
    color: '#aaaaaa',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 600,
  },
  exportButton: {
    padding: '8px 16px',
    backgroundColor: '#0066ff',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
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
    overflowY: 'hidden',
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
    transition: 'background-color 0.2s',
  },
  workspace: {
    flex: 1,
    display: 'flex',
    gap: '12px',
    padding: '12px',
    overflow: 'hidden',
  },
  leftSidebar: {
    width: '280px',
    flexShrink: 0,
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    minWidth: 0,
  },
  topRow: {
    flex: 1,
    display: 'flex',
    gap: '12px',
    minHeight: 0,
  },
  preview: {
    flex: 1,
    minHeight: 0,
  },
  timeline: {
    height: '300px',
    flexShrink: 0,
  },
  rightSidebar: {
    width: '320px',
    flexShrink: 0,
  },
};
