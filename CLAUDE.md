# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Remotion Fast is a monorepo containing a video editor component library built with React, TypeScript, and Remotion. It provides a timeline-based video editor with drag-and-drop functionality, real-time preview, and multi-track support.

## Essential Commands

```bash
# Install dependencies (use npm, not pnpm - there are active npm processes)
npm install

# Build all packages (required before running)
npm run build

# Start development server (runs example editor)
npm run dev                              # Starts at http://localhost:3001

# Package-specific development
npm run dev --workspace=packages/core    # Watch core package
npm run dev --workspace=packages/ui      # Watch UI package

# Run Remotion Studio for video rendering
cd examples/basic-editor && npm run remotion

# Clean build artifacts
npm run clean
```

## Architecture Overview

### Package Structure
The monorepo has three core packages that must be understood as a system:

1. **@remotion-fast/core** - State management and types
   - Single `EditorState` object with tracks, items, assets
   - Reducer pattern with 16 action types
   - Frame-based timing (all times in frames, not seconds)

2. **@remotion-fast/ui** - React UI components
   - Timeline with 11 sub-components for drag-and-drop editing
   - Uses global variables for drag data (React limitation workaround)
   - Keyboard shortcuts via useKeyboardShortcuts hook

3. **@remotion-fast/remotion-components** - Rendering engine
   - Converts editor state to Remotion compositions
   - Handles video playback and export

### Critical Design Patterns

#### State Management Flow
```
User Action → Dispatch Action → Reducer → New State → Context Update → Component Re-render
```
All state changes go through `useEditor()` hook which provides `state` and `dispatch`.

#### Timeline Coordinate System
- X-axis: Time in frames (convert via `frameToPixel()` / `pixelToFrame()`)
- Y-axis: Track index (80px height per track)
- Snap points at 15-frame intervals

#### Global Variables (Important!)
The codebase uses global variables in `packages/ui/src/components/Timeline/index.tsx`:
```typescript
window.__remotion_dragData    // Current drag item data
window.__remotion_dragOffset  // Mouse offset for dragging
```
This is intentional - React's dataTransfer API only supports strings, not objects.

### Key Type Definitions

```typescript
// Core item types - everything on timeline is one of these
type ItemType = 'text' | 'solid' | 'video' | 'image' | 'audio'

// Track contains multiple items
interface Track {
  id: string
  items: Item[]
  locked?: boolean
}

// Item positioned on timeline
interface Item {
  id: string
  type: ItemType
  start: number      // Frame number
  duration: number   // Frame count
  // ... type-specific properties
}
```

### Component Hierarchy

```
Editor
├── AssetPanel (upload media)
├── PreviewCanvas (video preview)
├── PropertiesPanel (edit selected item)
└── Timeline
    ├── TimelineHeader (time ruler)
    ├── TimelinePlayhead (current position)
    └── TimelineTracks
        └── TimelineTrack (per track)
            └── TimelineItem (draggable items)
```

## Working with the Timeline

The Timeline is the most complex component. Key files:

- `packages/ui/src/components/Timeline/index.tsx` - Main orchestrator
- `packages/ui/src/components/Timeline/TimelineItem.tsx` - Draggable items
- `packages/ui/src/components/Timeline/utils/snapCalculator.ts` - Snap logic
- `packages/ui/src/components/Timeline/utils/timeFormatter.ts` - Time display

When modifying drag-and-drop:
1. Check global variables in Timeline/index.tsx
2. Update handleDragStart/handleDrop handlers
3. Test snap points alignment
4. Verify frame calculations

## Common Tasks

### Add New Item Type
1. Add type to `ItemType` in `packages/core/src/types.ts`
2. Add case in reducer (`packages/core/src/state/reducer.ts`)
3. Create UI component in `packages/ui/src/components/Timeline/TimelineItem.tsx`
4. Add rendering in `packages/remotion-components/src/ItemComponent.tsx`

### Modify Timeline Behavior
1. Timeline constants in `packages/ui/src/components/Timeline/styles.ts`
2. Snap logic in `utils/snapCalculator.ts`
3. Mouse interactions in Timeline component event handlers

### Change Video Export Settings
1. Composition settings in `examples/basic-editor/src/remotion/index.tsx`
2. Player config in `packages/ui/src/components/PreviewCanvas.tsx`

## Known Limitations

- No undo/redo system
- No effects or transitions
- No audio waveform visualization
- No collaborative editing
- Global variables for drag data (React limitation)

## Testing Approach

Currently no test suite. When adding:
1. Test reducer actions in isolation
2. Test frame/pixel conversion utilities
3. Test drag-and-drop with mock global variables
4. Integration test with example editor

## Performance Considerations

- Timeline renders many items - use React.memo
- Frame calculations happen frequently - cache when possible
- Video preview is resource-intensive - throttle updates
- Large file uploads need progress indication