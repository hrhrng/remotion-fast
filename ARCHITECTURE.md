# Remotion-Fast Codebase Architecture

## Executive Summary

Remotion-Fast is a modular React-based video editor component library built on top of Remotion. It follows a monorepo structure with three main packages (core, ui, remotion-components) and uses a unified reducer-based state management pattern. The architecture emphasizes separation of concerns, with state management, UI components, and Remotion rendering components in separate packages.

---

## 1. Package Structure & Organization

### 1.1 Monorepo Layout

```
remotion-fast/
├── packages/
│   ├── core/                           # State management & types
│   ├── ui/                             # React UI components
│   ├── remotion-components/            # Remotion rendering components
├── examples/
│   └── basic-editor/                   # Vite-based example application
├── package.json                        # Monorepo root configuration
└── tsconfig.json                       # Shared TypeScript config
```

### 1.2 Workspace Configuration

Uses **pnpm workspaces** with the following packages declared in root `package.json`:
- `packages/*` - Three npm packages
- `examples/*` - Example applications

Each package is independently buildable with `tsup` (TypeScript bundler) and exports both CommonJS and ESM modules.

---

## 2. Core Package (`@remotion-fast/core`)

### 2.1 Purpose
Central state management, type definitions, and utility functions shared across all packages.

### 2.2 Core Types (`src/types/index.ts`)

#### Item Types (Timeline Elements)
```typescript
// Base structure for all timeline items
BaseItem = {
  id: string
  from: number              // Start frame
  durationInFrames: number
}

// Item variants
SolidItem    // Colored rectangles
TextItem     // Text with styling (color, fontSize, fontFamily, fontWeight)
VideoItem    // Video with optional audio/video fades
AudioItem    // Audio track with fade in/out
ImageItem    // Static images
```

#### Track Definition
```typescript
Track = {
  id: string
  name: string
  items: Item[]           // Timeline items in this track
  locked?: boolean
  hidden?: boolean
}
```

#### Asset (Media Library)
```typescript
Asset = {
  id: string
  name: string
  type: 'video' | 'audio' | 'image'
  src: string             // URL/blob
  duration?: number
  thumbnail?: string      // Video preview
  waveform?: number[]     // Audio visualization (0-1 normalized)
  createdAt: number
}
```

#### Editor State
```typescript
EditorState = {
  tracks: Track[]
  selectedItemId: string | null
  selectedTrackId: string | null
  currentFrame: number
  playing: boolean
  zoom: number            // Timeline zoom level
  assets: Asset[]
  compositionWidth: number    // 1920
  compositionHeight: number   // 1080
  fps: number                 // 30
  durationInFrames: number
}
```

### 2.3 State Management (`src/state/EditorContext.tsx`)

#### Reducer-Based Pattern
- Uses React's `useReducer` hook for centralized state
- Immutable state updates following Redux pattern
- Single context (`EditorContext`) wrapping the entire app

#### EditorAction Types
- **Track Operations**: ADD_TRACK, INSERT_TRACK, REMOVE_TRACK, UPDATE_TRACK, REORDER_TRACKS
- **Item Operations**: ADD_ITEM, REMOVE_ITEM, UPDATE_ITEM
- **Selection**: SELECT_ITEM, SELECT_TRACK
- **Playback**: SET_CURRENT_FRAME, SET_PLAYING
- **View**: SET_ZOOM
- **Assets**: ADD_ASSET, REMOVE_ASSET
- **Canvas**: SET_COMPOSITION_SIZE, SET_DURATION

#### Key Behaviors
- Auto-deletion of empty tracks when items are removed
- Frame clamping to valid range
- Deselection of items when they/their track is deleted

### 2.4 Exports

```typescript
// Main exports
export * from './types'
export { EditorProvider, useEditor } from './state/EditorContext'
export * from './utils/waveform'
```

### 2.5 Utilities

#### Waveform Generation (`src/utils/waveform.ts`)
- `generateWaveform(audioBuffer, samples)` - Extract and normalize audio peaks
- `loadAudioWaveform(url, samples)` - Fetch audio and generate waveform data
- Used for audio visualization in timeline items

---

## 3. UI Package (`@remotion-fast/ui`)

### 3.1 Purpose
Complete React UI implementation of the video editor interface.

### 3.2 Main Components Hierarchy

```
Editor (wrapper with EditorProvider)
├── Header (title + export button)
├── Workspace
│   ├── LeftSidebar
│   │   └── AssetPanel
│   │       ├── Quick Add (Text, Color)
│   │       ├── File Upload
│   │       └── Asset List
│   ├── Main
│   │   ├── TopRow
│   │   │   ├── PreviewCanvas
│   │   │   │   └── Remotion Player
│   │   │   └── PropertiesPanel
│   │   │       ├── Canvas Properties
│   │   │       ├── Item Properties (when selected)
│   │   │       └── Export Settings
│   │   └── Timeline (flexible height container)
│   │       └── Timeline Component
```

### 3.3 Key Components

#### Editor.tsx (Root)
- Wraps everything with `EditorProvider`
- Manages modal state (export instructions)
- Defines overall layout and styling
- Dimensions: 100vw × 100vh dark theme

#### PreviewCanvas.tsx
- Integrates Remotion's `<Player>` component
- Receives track data as input props
- Syncs frame position with editor state
- Play/pause controls
- Frame counter display

#### AssetPanel.tsx
- **File Upload**: Accepts video, audio, image files
- **Thumbnail Generation**: Creates multi-frame previews for videos
- **Waveform Generation**: Analyzes audio for visualization
- **Drag & Drop**: Implements `dragstart` with dataTransfer
- **Quick Add**: Buttons for Text and Color without uploading

Key Features:
- Global `currentDraggedAsset` variable for cross-module access
- Drag effect set to 'copy'
- Asset deletion with visual confirmation

#### PropertiesPanel.tsx
- **Canvas Mode** (no item selected):
  - Width/Height inputs
  - Swap dimensions button
  - Duration and FPS display
  - Export instructions modal
  
- **Item Mode** (when item selected):
  - Common: Start Frame, Duration
  - Text: Content textarea, color picker, font size/family/weight
  - Solid: Background color picker
  - Media: Read-only source path

#### Timeline.tsx (Main Timeline Orchestrator)
Large component managing:
- **State Integration**: Connects to useEditor() hook
- **Zoom Control**: ±0.25 increments (min: 0.25, max: 4.0)
- **Seek Control**: Frame position updates
- **Track Operations**: Add/remove/select tracks
- **Item Operations**: Add/select/update/delete items
- **Drag & Drop**:
  - From AssetPanel to timeline (auto-creates tracks if needed)
  - From AssetPanel to specific track
  - Snap-to-grid support
  - Quick-add items (text, solid)
- **Keyboard Shortcuts**: Delete, Play/Pause, Arrow keys, Zoom

Sub-components:
- `TimelineHeader` - Zoom controls, snap toggle, time display
- `TimelineRuler` - Time markers with adaptive intervals
- `TimelineTracksContainer` - Scrollable track list
- `TimelineItem` - Individual clips with resize/edit handles
- `TimelineTrack` - Track wrapper with label and item container
- `TimelinePlayhead` - Red line showing current position

### 3.4 Timeline Component Tree

```
Timeline
├── TimelineHeader
│   ├── Time display
│   ├── Zoom buttons (in/out)
│   └── Snap toggle
├── Ruler Section
│   ├── Track label placeholder
│   └── TimelineRuler (adaptive interval ticks)
├── TimelineTracksContainer
│   ├── Labels Panel (track names, fixed width)
│   └── Viewport (scrollable)
│       └── TimelineTrack[] (for each track)
│           └── TimelineItem[] (for each item)
│               ├── Visual representation (thumbnail/waveform)
│               ├── Fade controls
│               └── Resize handles
└── Playhead Overlay (absolute positioned)
```

### 3.5 Timeline Utilities

#### timeFormatter.ts
- `formatTime(frame, fps)` → "MM:SS:FF"
- `framesToSeconds(frame, fps)` → number
- `secondsToFrames(seconds, fps)` → number
- `pixelsToFrame(pixels, pixelsPerFrame)` → number
- `frameToPixels(frame, pixelsPerFrame)` → number
- `getPixelsPerFrame(zoom)` → 2 * zoom
- `getRulerInterval(zoom)` → Major tick interval (adaptive)
- `getSubInterval(mainInterval)` → Minor tick interval

#### snapCalculator.ts
Snap targets:
- Track start (frame 0)
- Playhead position
- Other items' edges (start/end)
- Grid intervals (every 5 frames)

Functions:
- `calculateSnap(frame, tracks, currentItemId, playheadFrame, enabled, threshold)`
- `calculateResizeSnap()` - Edge snapping during resize
- `getAllSnapTargets()` - For drawing guide lines
- `checkItemsOverlap(item1, item2)` - Collision detection
- `findAvailablePosition()` - Place item avoiding overlaps

#### useKeyboardShortcuts.ts
Keyboard mappings:
| Key | Action |
|-----|--------|
| Delete/Backspace | Delete selected item |
| Cmd/Ctrl+C | Copy |
| Cmd/Ctrl+V | Paste |
| Cmd/Ctrl+D | Duplicate |
| Cmd/Ctrl+Z | Undo |
| Cmd/Ctrl+Shift+Z | Redo |
| Space | Play/Pause |
| Arrow Left | Previous frame (Shift: -10) |
| Arrow Right | Next frame (Shift: +10) |
| Cmd/Ctrl+= / + | Zoom in |
| Cmd/Ctrl+- | Zoom out |

### 3.6 Design System (styles.ts)

Comprehensive color and spacing tokens:

```typescript
colors = {
  bg: { primary, secondary, elevated, hover, selected },
  accent: { primary, success, warning, danger },
  item: { video, audio, image, text, solid },
  text: { primary, secondary, tertiary, disabled },
  border: { default, active, hover },
  guide: { snap, insert }
}

timeline = {
  trackHeight: 72px
  trackLabelWidth: 140px
  rulerHeight: 40px
  headerHeight: 44px
  playheadWidth: 2px
  snapThreshold: 5 frames
  snapGridInterval: 5 frames
  zoomMin: 0.25
  zoomMax: 4.0
}

typography = {
  fontFamily: { sans, mono }
  fontSize: { xs: 11, sm: 12, md: 13, lg: 14, xl: 16 }
  fontWeight: { normal: 400, medium: 500, semibold: 600, bold: 700 }
}
```

---

## 4. Remotion Components Package (`@remotion-fast/remotion-components`)

### 4.1 Purpose
Bridges editor state to Remotion's rendering engine. Defines what gets rendered.

### 4.2 VideoComposition.tsx

#### Component Hierarchy
```
VideoComposition
└── AbsoluteFill (white background)
    └── TrackComponent[] (for each track)
        └── AbsoluteFill
            └── Sequence[] (for each item)
                └── ItemComponent
```

#### ItemComponent Rendering
Handles each timeline item type:

**SolidItem**: `<AbsoluteFill style={{ backgroundColor: item.color }}/>`

**TextItem**: 
- Centered text with fade-in animation (first 10 frames)
- Respects fontSize, fontFamily, fontWeight, color

**VideoItem**:
- Uses `<OffthreadVideo>` (faster rendering)
- Audio volume with fade in/out curves
- Uses `interpolate()` for smooth transitions

**AudioItem**:
- Pure audio track with `<Audio>`
- Volume mixing with fade curves
- No visual component

**ImageItem**:
- Centered image display
- Uses `<Img>` component

#### Audio Fade Handling
Both VideoItem and AudioItem support:
- `audioFadeIn` frames - Ramps from 0 to 1
- `audioFadeOut` frames - Ramps from 1 to 0
- Uses Remotion's `interpolate()` with clamp extrapolation

#### Key Props
```typescript
VideoComposition accepts:
{
  tracks: Track[]  // From editor state
}
```

---

## 5. State Management Flow

### 5.1 Data Flow Diagram

```
User Interaction
    ↓
UI Component Handler
    ↓
dispatch(EditorAction)
    ↓
editorReducer(state, action)
    ↓
New EditorState (immutable)
    ↓
Component Re-render via Context
    ↓
Prop Update to Child Components
    ↓
Remotion Player / Timeline Re-render
```

### 5.2 Example: Dragging Asset to Timeline

1. **User drags asset from AssetPanel**
   - `onDragStart` stores asset in `currentDraggedAsset` global
   - Sets dataTransfer with: assetId, quickAdd flag, type

2. **Drag over timeline**
   - `handleDragOver` sets cursor effect

3. **Drop on track**
   - `handleDrop` callback fires
   - Calculates drop frame position using `pixelsToFrame()`
   - Applies snap via `calculateSnap()`
   - Calls `dispatch({ type: 'ADD_ITEM', payload: { trackId, item } })`

4. **Reducer processes ADD_ITEM**
   - Finds track by ID
   - Appends item to track's items array
   - Returns new state

5. **Components re-render**
   - Timeline updates with new item
   - Properties panel becomes available
   - Preview shows new item

### 5.3 Selection State Management

- `selectedItemId` - Currently active timeline item
- `selectedTrackId` - Currently active track
- Mutual exclusivity: Selecting item deselects track
- Properties panel switches context based on selection

---

## 6. Important Architectural Patterns

### 6.1 Global Variables for Cross-Module Communication

```typescript
// AssetPanel.tsx
export let currentDraggedAsset: any = null;  // Accessed by TimelineTracksContainer

// TimelineItem.tsx
declare global {
  interface Window {
    currentDraggedItem: { item: Item; trackId: string } | null;
  }
}

// TimelineTracksContainer.tsx
let globalDragData: { assetId?, quickAdd?, quickAddType?, asset? } = {};
```

**Why**: DataTransfer API limitations in React event system. These variables work around serialization issues.

### 6.2 Immutable State Updates

Every reducer action creates new objects/arrays:

```typescript
// Good
tracks: state.tracks.map(t => 
  t.id === id ? { ...t, ...updates } : t
)

// NOT direct mutation
state.tracks[0].name = "New Name"  // ❌
```

### 6.3 Context-Based Dependency Injection

```typescript
const { state, dispatch } = useEditor();  // Available everywhere
```

Single provider at root level ensures consistency.

### 6.4 Separation of Concerns

| Layer | Responsibility |
|-------|-----------------|
| **core** | State, types, utils |
| **ui** | User interface, interaction |
| **remotion-components** | Rendering logic, Remotion integration |
| **example** | Integration and usage demo |

---

## 7. Integration Points

### 7.1 Core ↔ UI
```typescript
// UI imports from core
import { EditorProvider, useEditor } from '@remotion-fast/core'
import type { Item, Track, Asset } from '@remotion-fast/core'

// UI wraps components with EditorProvider
<EditorProvider>
  <Editor />
</EditorProvider>
```

### 7.2 UI ↔ Remotion Components
```typescript
// PreviewCanvas imports VideoComposition
import { VideoComposition } from '@remotion-fast/remotion-components'

// Passes editor state to Player
<Player
  component={VideoComposition}
  inputProps={{ tracks: state.tracks }}
  ...
/>
```

### 7.3 Asset Loading Pipeline
1. **File Input** → AssetPanel accepts files
2. **Processing**:
   - Images: Direct usage
   - Videos: Generate thumbnail + waveform
   - Audio: Generate waveform only
3. **State Update**: `dispatch({ type: 'ADD_ASSET', payload: asset })`
4. **Usage**: Drag to timeline, creates items referencing asset.src

---

## 8. Configuration Files

### 8.1 TypeScript Config (tsconfig.json)
- Shared base config in root
- Each package extends with package-specific settings
- Target: ES2020
- Module: ESNext

### 8.2 Build Configuration

**Core, UI, Remotion-Components** use `tsup`:
```bash
tsup src/index.ts --format cjs,esm --dts
```
Outputs:
- `dist/index.js` (CommonJS)
- `dist/index.mjs` (ES Modules)
- `dist/index.d.ts` (TypeScript definitions)

**Example** uses Vite:
```bash
vite  # Dev server with HMR
vite build  # Production bundle
```

### 8.3 Package.json Export Map
```json
"exports": {
  ".": {
    "types": "./dist/index.d.ts",
    "import": "./dist/index.mjs",
    "require": "./dist/index.js"
  }
}
```

---

## 9. Data Flow Examples

### 9.1 Adding a Video

```
1. User clicks "Upload Files"
   → fileInputRef.click()
   
2. File selected
   → handleFileUpload() reads file
   
3. Process file
   → Blob → URL.createObjectURL()
   → Generate thumbnail (multi-frame canvas)
   → Generate waveform (FFT analysis)
   
4. Create Asset object
   Asset {
     id: "asset-{timestamp}-{random}",
     name: "video.mp4",
     type: "video",
     src: "blob:...",
     thumbnail: "blob:...",
     waveform: [0.1, 0.3, 0.8, ...],
     createdAt: timestamp
   }
   
5. Dispatch action
   → dispatch({ type: 'ADD_ASSET', payload: asset })
   
6. State updates
   → state.assets.push(asset)
   
7. Component re-renders
   → Asset appears in AssetPanel list
```

### 9.2 Creating Timeline Item

```
1. User drags asset from panel to track
   → onDragStart sets currentDraggedAsset + dataTransfer
   → handleDrop on track fires
   
2. Calculate position
   → x = e.clientX - rect.left
   → frame = pixelsToFrame(x, pixelsPerFrame)
   → snappedFrame = calculateSnap(...)
   
3. Create Item
   Item {
     id: "item-{timestamp}",
     type: "video",
     from: snappedFrame,
     durationInFrames: 90,
     src: asset.src,
     waveform: asset.waveform,
   }
   
4. Dispatch ADD_ITEM
   → dispatch({
       type: 'ADD_ITEM',
       payload: { trackId, item }
     })
   
5. State updates
   → tracks.find(t => t.id === trackId)
   → t.items.push(item)
   
6. UI updates
   → Timeline shows new item
   → Player displays video
   → Properties panel available for editing
```

### 9.3 Text Editing

```
1. Click text item in timeline
   → handleSelectItem(itemId)
   → dispatch({ type: 'SELECT_ITEM', payload: itemId })
   
2. Properties panel shows text properties
   
3. User edits text content
   → onChange updates value
   → dispatch({
       type: 'UPDATE_ITEM',
       payload: {
         trackId,
         itemId,
         updates: { text: newValue }
       }
     })
   
4. State updates
   → tracks[n].items[m].text = newValue
   
5. Preview updates immediately
   → Player re-renders with new text
```

---

## 10. Key Design Decisions

### 10.1 Monorepo with Workspace
**Pro**: Clear separation, independent versioning, reusability
**Con**: More complex tooling, workspace linking needed

### 10.2 Reducer Pattern for State
**Pro**: Predictable, testable, time-travel debugging capable
**Con**: Immutability boilerplate, all state in one tree

### 10.3 Global Variables for Drag Data
**Pro**: Bypasses React event serialization limits
**Con**: Not scalable, potential race conditions with multiple instances

### 10.4 Frame-Based Timeline
**Pro**: Aligned with video production, FPS-agnostic
**Con**: Floating point precision issues with some zoom levels

### 10.5 Absolute Positioning Layout
**Pro**: Precise control, overlays (playhead), performance
**Con**: Manual scroll synchronization, browser compatibility

---

## 11. Future Extension Points

### 11.1 Undo/Redo
- Implement action history stack in core
- Add `UNDO` and `REDO` actions
- Timeline component has handlers ready

### 11.2 Clipboard Operations
- Copy item with `JSON.stringify`
- Paste with offset to avoid overlap
- Duplicate creates near-identical item

### 11.3 Effects/Transitions
- Extend Item type with effects array
- ItemComponent checks effects before rendering
- Properties panel adds effect editor

### 11.4 Multi-track Audio
- Merge audio from multiple tracks
- Mix volume levels
- Support audio-only tracks

### 11.5 Trim/Split Operations
- Implement in TimelineItem context menu
- Split: create two items from one
- Trim: reduce durationInFrames

---

## 12. Technology Stack

| Layer | Technology |
|-------|-----------|
| **State** | React 19 + useReducer |
| **UI** | React 19 + TypeScript |
| **Animation** | Framer Motion 12 |
| **Rendering** | Remotion 4 |
| **Build** | tsup + Vite 7 |
| **Package Manager** | pnpm |
| **Type Safety** | TypeScript 5.9 |

---

## 13. Module Dependencies

```
core
├── No dependencies (except React peer)

ui
├── Depends: @remotion-fast/core, @remotion-fast/remotion-components
├── Peer: react, react-dom, remotion, @remotion/player, framer-motion

remotion-components
├── Depends: @remotion-fast/core
├── Peer: react, remotion

basic-editor
├── Depends: All three packages above
├── Build: Vite, Dev: Hot Reload
```

---

## Summary

The remotion-fast architecture is a well-organized, modular system that:
- Separates concerns cleanly across three packages
- Uses React Context + Reducer for predictable state management
- Provides comprehensive UI for video editing with timeline, preview, and properties
- Integrates seamlessly with Remotion for rendering
- Leverages modern tooling (TypeScript, pnpm, Vite, tsup)

The design is extensible and ready for additional features like undo/redo, effects, and advanced editing operations.
