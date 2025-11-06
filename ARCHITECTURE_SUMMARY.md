# Remotion-Fast Architecture Summary

## What is Remotion-Fast?

A modular, production-ready video editor library built with React and Remotion. It provides:

- **Complete UI** - Timeline, preview canvas, properties panel, asset library
- **State Management** - Centralized Redux-like reducer pattern
- **Rendering Engine** - Seamless Remotion integration
- **Developer-Friendly** - TypeScript, monorepo, clean separation of concerns

## Quick Start Understanding

### The Three Packages

1. **@remotion-fast/core** (State + Types)
   - Defines all TypeScript interfaces
   - Manages application state with reducer
   - Provides `useEditor()` hook
   - No UI dependencies

2. **@remotion-fast/ui** (User Interface)
   - React components for editing
   - Timeline with drag/drop
   - Properties panel
   - Asset library
   - Depends on core

3. **@remotion-fast/remotion-components** (Rendering)
   - Bridges editor state to Remotion
   - Renders video composition
   - Handles different item types
   - Depends on core

### Data Flow (Simplified)

```
User Action (click/drag/keyboard)
    ↓
Component Handler Function
    ↓
dispatch({ type: 'ACTION', payload: data })
    ↓
Reducer Function (editorReducer)
    ↓
New EditorState
    ↓
Context Update
    ↓
Component Re-renders
    ↓
UI and Preview Update
```

## Core Concepts

### EditorState - The Single Source of Truth

```typescript
{
  tracks: [                    // Timeline tracks
    { id, name, items: [...] }
  ],
  assets: [                    // Media library
    { id, name, type, src, thumbnail, waveform, ... }
  ],
  selectedItemId: "item-123"   // Which item is selected
  selectedTrackId: "track-456" // Which track is selected
  currentFrame: 100            // Playhead position
  playing: false               // Is video playing?
  zoom: 1.5                    // Timeline zoom level (0.25 to 4.0)
  compositionWidth: 1920       // Canvas size
  compositionHeight: 1080
  fps: 30                      // Frame rate
  durationInFrames: 1500       // Total video length
}
```

### Item Types - What Can Be Added to Timeline

| Type | What | Properties |
|------|------|-----------|
| **Solid** | Colored rectangle | color |
| **Text** | Text with formatting | text, color, fontSize, fontFamily, fontWeight |
| **Video** | Video with audio | src, volume, waveform, audioFadeIn/Out |
| **Audio** | Sound track only | src, volume, waveform, audioFadeIn/Out |
| **Image** | Static picture | src |

### Editor Actions - How to Change State

All state changes happen through actions:

```typescript
// Add a new track
dispatch({ type: 'ADD_TRACK', payload: track })

// Update an item
dispatch({
  type: 'UPDATE_ITEM',
  payload: {
    trackId: 'track-123',
    itemId: 'item-456',
    updates: { text: 'New text' }
  }
})

// Delete item (auto-removes empty tracks)
dispatch({ type: 'REMOVE_ITEM', payload: { trackId, itemId } })

// Move playhead
dispatch({ type: 'SET_CURRENT_FRAME', payload: 500 })
```

## Component Architecture

### Layout Structure

```
Editor (Root - wraps with EditorProvider)
│
├── Header (Logo + Export button)
│
└── Workspace (Main editing area)
    │
    ├── Left Sidebar
    │   └── AssetPanel (file upload, media library)
    │
    ├── Main Area (flex, split vertically)
    │   │
    │   ├── Top Row (flex, split horizontally)
    │   │   ├── PreviewCanvas (Remotion Player)
    │   │   └── PropertiesPanel (edit selected item)
    │   │
    │   └── Timeline (flexible height)
    │       ├── TimelineHeader (zoom, snap controls)
    │       ├── TimelineRuler (time markers)
    │       └── TimelineTracksContainer (scrollable tracks)
    │           └── TimelineTrack[] (each track)
    │               └── TimelineItem[] (each item)
    │
    └── Playhead Overlay (positioned absolutely)
```

### Component Responsibilities

| Component | Job |
|-----------|-----|
| **Editor** | Root wrapper, EditorProvider, layout shell |
| **AssetPanel** | Upload files, show media library, drag source |
| **PreviewCanvas** | Show Remotion player, sync playback |
| **PropertiesPanel** | Edit selected item or canvas properties |
| **Timeline** | Orchestrate all timeline sub-components |
| **TimelineHeader** | Zoom, snap toggle, time display |
| **TimelineRuler** | Time markers at adaptive intervals |
| **TimelineTracksContainer** | Scrollable track list, sync scrolling |
| **TimelineTrack** | Single track, label, items container |
| **TimelineItem** | Individual clip, drag/resize handles |
| **TimelinePlayhead** | Red line, draggable, shows position |

## Key Features

### Timeline Editing

- **Drag & Drop**: Drag assets from panel to timeline, creates items
- **Zoom**: 0.25x to 4.0x, adaptive ruler intervals
- **Snap**: Snap to grid (5 frames), item edges, playhead
- **Resize**: Drag item edges to adjust duration
- **Select**: Click item to select, shows in properties panel

### Property Editing

- **Text**: Edit content, color, size, font, weight
- **Solid**: Choose background color
- **Media**: View read-only source path
- **Canvas**: Width, height, duration, FPS
- **Audio**: Fade in/out curves, volume

### Media Management

- **Upload**: Drag files into asset panel
- **Thumbnail**: Auto-generated for videos
- **Waveform**: Auto-generated for audio
- **Quick Add**: Pre-made items (text, solid color)

### Playback Control

- **Play/Pause**: Space bar or button
- **Seek**: Click ruler or drag playhead
- **Frame Navigation**: Arrow keys (±1 frame, Shift for ±10)
- **Sync**: Preview syncs with timeline position

## Important Design Patterns

### 1. Global Variables for Drag Data

Why? React's `dataTransfer` API doesn't serialize well.

```typescript
// AssetPanel.tsx
export let currentDraggedAsset = null  // Available globally

// TimelineTracksContainer.tsx
let globalDragData = {}               // Stores drag state
```

### 2. Immutable State Updates

All reducer actions create new objects:

```typescript
// Good - creates new array
tracks: state.tracks.map(t =>
  t.id === id ? { ...t, ...updates } : t
)

// Bad - directly mutates
state.tracks[0].name = "New"  // ❌ Never do this
```

### 3. Single Provider Pattern

One `EditorProvider` at root wraps entire app:

```typescript
<Editor>  // Internally has EditorProvider
  {/* All children can useEditor() */}
</Editor>
```

### 4. Frame-Based Timing

Everything uses frame numbers (not milliseconds):

```typescript
item.from = 100              // Starts at frame 100
item.durationInFrames = 90   // Lasts 90 frames
// At 30fps = 3 seconds total
```

## The Five Essential Flows

### Flow 1: Adding a Video

```
1. User uploads file → AssetPanel.handleFileUpload()
2. Generate thumbnail and waveform
3. dispatch({ type: 'ADD_ASSET', payload: asset })
4. State updates, asset appears in panel
5. User drags to timeline
6. dispatch({ type: 'ADD_ITEM', payload: { trackId, item } })
7. Item appears, preview updates
```

### Flow 2: Editing Item Properties

```
1. User clicks item → handleSelectItem(itemId)
2. dispatch({ type: 'SELECT_ITEM', payload: itemId })
3. PropertiesPanel shows options
4. User changes text → onChange handler
5. dispatch({ type: 'UPDATE_ITEM', payload: { trackId, itemId, updates } })
6. Preview updates immediately
```

### Flow 3: Playing Video

```
1. User presses Space → useKeyboardShortcuts handler
2. dispatch({ type: 'SET_PLAYING', payload: true })
3. Player component detects playing=true
4. Player.play() called
5. Player updates currentFrame each render cycle
6. dispatch({ type: 'SET_CURRENT_FRAME', payload: frame })
7. Playhead moves, preview shows frame
```

### Flow 4: Adjusting Zoom

```
1. User clicks Zoom In button
2. dispatch({ type: 'SET_ZOOM', payload: 1.25 })
3. pixelsPerFrame recalculated
4. All timeline items redraw
5. Ruler updates with new intervals
6. Playhead repositions
```

### Flow 5: Deleting Item

```
1. User presses Delete → useKeyboardShortcuts handler
2. Find track containing selectedItemId
3. dispatch({ type: 'REMOVE_ITEM', payload: { trackId, itemId } })
4. Reducer removes item from track
5. Reducer auto-deletes empty track
6. dispatch({ type: 'SELECT_ITEM', payload: null })
7. PropertiesPanel clears
```

## File Size & Performance

```
Core Package:        ~5KB (types + reducer)
UI Package:          ~100KB (components)
Remotion Components: ~3KB
Total:              ~108KB (before React deps)

Timeline items scale: O(tracks × items)
Render performance: Good up to ~1000 items
Zoom range: 0.25x (shows ~2000 frames) to 4.0x (shows ~300 frames)
```

## Technology Stack

- **React 19** - UI framework
- **TypeScript 5.9** - Type safety
- **Remotion 4** - Video rendering
- **Framer Motion 12** - Animations
- **pnpm** - Package manager
- **tsup** - Build tool
- **Vite 7** - Dev server

## What's Missing

Things not yet implemented but have placeholders:

- **Undo/Redo** - Handlers exist, history not stored
- **Copy/Paste** - Handlers exist, clipboard not used
- **Duplicate** - Handler exists
- **Effects** - No effect system
- **Transitions** - No transition support
- **Track reordering** - Can't drag tracks yet
- **Multiple selection** - Can only select one item

## Architecture Strengths

1. **Modular** - Three independent packages
2. **Predictable** - Redux-like state management
3. **Testable** - Pure reducer function
4. **Type-Safe** - Full TypeScript coverage
5. **Extensible** - Clear extension points
6. **Scalable** - Works with large projects

## Architecture Limitations

1. **Single instance** - Global variables for drag data
2. **All state in memory** - No persistence layer
3. **No undo/redo** - Would need history stack
4. **Frame-based only** - Not flexible time formats
5. **No rendering API** - Can't export without Remotion CLI

## Getting Started with the Code

### To Understand State:
1. Read: `/packages/core/src/types/index.ts` (1 file, 100 lines)
2. Read: `/packages/core/src/state/EditorContext.tsx` (1 file, 150 lines)

### To Understand UI:
1. Read: `/packages/ui/src/components/Editor.tsx` (layout)
2. Read: `/packages/ui/src/components/Timeline.tsx` (logic)
3. Read: `/packages/ui/src/components/timeline/styles.ts` (design system)

### To Add a Feature:
1. Define action in `EditorAction` type
2. Add reducer case in `editorReducer`
3. Add component handler that dispatches
4. Update PropertiesPanel if needed

---

**Created**: November 2024
**Last Updated**: As documented
**Status**: Production-ready
