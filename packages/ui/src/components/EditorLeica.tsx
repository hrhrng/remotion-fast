import React from 'react';
import { EditorProvider } from '@remotion-fast/core';
import { PreviewCanvas } from './PreviewCanvas';
import { Timeline } from './Timeline';
import { AssetPanel } from './AssetPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { leicaTheme } from '../themes/leica';

export const EditorLeica: React.FC = () => {
  const [showExportModal, setShowExportModal] = React.useState(false);

  const styles = createLeicaStyles(leicaTheme);

  return (
    <EditorProvider>
      <div style={styles.container}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.logoArea}>
            <div style={styles.logoSquare}>
              <span style={styles.logoText}>RF</span>
            </div>
            <h1 style={styles.title}>REMOTION FAST</h1>
          </div>
          
          <div style={styles.headerActions}>
            <button
              onClick={() => setShowExportModal(true)}
              style={styles.exportButton}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = leicaTheme.colors.leicaRedHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = leicaTheme.colors.leicaRed;
              }}
            >
              EXPORT
            </button>
          </div>
        </header>

        {/* Export Modal */}
        {showExportModal && (
          <div style={styles.modalOverlay} onClick={() => setShowExportModal(false)}>
            <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <h2 style={styles.modalTitle}>Export Video</h2>
                <button 
                  style={styles.closeButton}
                  onClick={() => setShowExportModal(false)}
                >
                  ✕
                </button>
              </div>

              <div style={styles.modalContent}>
                <div style={styles.exportMethod}>
                  <div style={styles.methodNumber}>01</div>
                  <div>
                    <h3 style={styles.methodTitle}>Command Line</h3>
                    <div style={styles.commandContainer}>
                      <code style={styles.commandText}>
                        npx remotion render src/remotion/index.tsx VideoComposition out/video.mp4
                      </code>
                    </div>
                    <p style={styles.methodDesc}>
                      Run this in your terminal to render the video
                    </p>
                  </div>
                </div>

                <div style={styles.exportMethod}>
                  <div style={styles.methodNumber}>02</div>
                  <div>
                    <h3 style={styles.methodTitle}>Remotion Studio</h3>
                    <div style={styles.commandContainer}>
                      <code style={styles.commandText}>npm run dev</code>
                    </div>
                    <p style={styles.methodDesc}>
                      Opens Remotion Studio at localhost:3002 with GUI render controls
                    </p>
                  </div>
                </div>
              </div>
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
            {/* Preview Area */}
            <div style={styles.preview}>
              <PreviewCanvas />
            </div>

            {/* Timeline Area */}
            <div style={styles.timeline}>
              <Timeline />
            </div>
          </main>

          {/* Right Sidebar - Properties */}
          <aside style={styles.rightSidebar}>
            <PropertiesPanel />
          </aside>
        </div>
      </div>
    </EditorProvider>
  );
};

function createLeicaStyles(theme: typeof leicaTheme): Record<string, React.CSSProperties> {
  return {
    container: {
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: theme.colors.white,
      fontFamily: theme.fonts.primary,
    },
    header: {
      height: '64px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 32px',
      backgroundColor: theme.colors.white,
      borderBottom: `1px solid ${theme.colors.border}`,
      boxShadow: theme.shadows.sm,
    },
    logoArea: {
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
    },
    logoSquare: {
      width: '36px',
      height: '36px',
      backgroundColor: theme.colors.leicaRed,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: theme.radius.sm,
    },
    logoText: {
      color: theme.colors.white,
      fontSize: '14px',
      fontWeight: 700,
      letterSpacing: '0.5px',
    },
    title: {
      margin: 0,
      fontSize: '16px',
      fontWeight: 600,
      color: theme.colors.textPrimary,
      letterSpacing: '1.5px',
    },
    headerActions: {
      display: 'flex',
      gap: '12px',
      alignItems: 'center',
    },
    exportButton: {
      padding: '10px 24px',
      backgroundColor: theme.colors.leicaRed,
      color: theme.colors.white,
      border: 'none',
      borderRadius: theme.radius.sm,
      fontSize: '12px',
      fontWeight: 600,
      letterSpacing: '1px',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: theme.shadows.sm,
    },
    modalOverlay: {
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.15)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      backdropFilter: 'blur(4px)',
    },
    modal: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.radius.md,
      padding: 0,
      maxWidth: '640px',
      width: '90%',
      boxShadow: theme.shadows.xl,
      border: `1px solid ${theme.colors.border}`,
    },
    modalHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '24px 32px',
      borderBottom: `1px solid ${theme.colors.border}`,
    },
    modalTitle: {
      margin: 0,
      fontSize: '20px',
      fontWeight: 600,
      color: theme.colors.textPrimary,
      letterSpacing: '0.5px',
    },
    closeButton: {
      background: 'none',
      border: 'none',
      fontSize: '20px',
      color: theme.colors.textSecondary,
      cursor: 'pointer',
      padding: '4px 8px',
      transition: 'color 0.2s',
    },
    modalContent: {
      padding: '32px',
    },
    exportMethod: {
      display: 'flex',
      gap: '20px',
      marginBottom: '32px',
      paddingBottom: '32px',
      borderBottom: `1px solid ${theme.colors.divider}`,
    },
    methodNumber: {
      width: '48px',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.lightGray,
      color: theme.colors.leicaRed,
      fontSize: '16px',
      fontWeight: 700,
      borderRadius: '50%',
      flexShrink: 0,
    },
    methodTitle: {
      margin: '0 0 12px 0',
      fontSize: '16px',
      fontWeight: 600,
      color: theme.colors.textPrimary,
      letterSpacing: '0.3px',
    },
    commandContainer: {
      margin: '0 0 12px 0',
      padding: '12px 16px',
      backgroundColor: theme.colors.lightGray,
      borderRadius: theme.radius.sm,
      border: `1px solid ${theme.colors.border}`,
    },
    commandText: {
      fontSize: '12px',
      color: theme.colors.textPrimary,
      fontFamily: theme.fonts.mono,
      wordBreak: 'break-all',
    },
    methodDesc: {
      margin: 0,
      fontSize: '13px',
      color: theme.colors.textSecondary,
      lineHeight: 1.6,
    },
    workspace: {
      flex: 1,
      display: 'flex',
      gap: '1px',
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    leftSidebar: {
      width: '280px',
      flexShrink: 0,
      backgroundColor: theme.colors.white,
    },
    main: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '1px',
      minWidth: 0,
      backgroundColor: theme.colors.border,
    },
    preview: {
      flex: 1,
      minHeight: 0,
      backgroundColor: theme.colors.white,
    },
    timeline: {
      height: '300px',
      flexShrink: 0,
      backgroundColor: theme.colors.white,
    },
    rightSidebar: {
      width: '320px',
      flexShrink: 0,
      backgroundColor: theme.colors.white,
    },
  };
}
