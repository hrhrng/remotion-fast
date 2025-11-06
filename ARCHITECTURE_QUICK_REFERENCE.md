# Architecture Quick Reference Guide

## File Structure

```
remotion-fast/
├── packages/
│   ├── core/                      # State + Types
│   │   └── src/
│   │       ├── types/index.ts           → Item, Track, Asset, EditorState, EditorAction
│   │       ├── state/EditorContext.tsx  → EditorProvider, useEditor(), editorReducer
│   │       ├── utils/waveform.ts        → generateWaveform(), loadAudioWaveform()
│   │       └── index.ts                 → Exports all types and hooks
│   │
│   ├── ui/                        # User Interface
│   │   └── src/
│   │       ├── components/
│   │       │   ├── Editor.tsx                    → Root with EditorProvider wrapper
│   │       │   ├── AssetPanel.tsx               → File upload + media library
│   │       │   ├── PreviewCanvas.tsx            → Remotion Player integration
│   │       │   ├── PropertiesPanel.tsx          → Property editor for items
│   │       │   ├── Timeline.tsx                 → Main timeline orchestrator
│   │       │   └── timeline/
│   │       │       ├── TimelineHeader.tsx       → Zoom/snap controls
│   │       │       ├── TimelineRuler.tsx        → Time markers
│   │       │       ├── TimelineTracksContainer.tsx → Scrollable tracks
│   │       │       ├── TimelineTrack.tsx        → Single track wrapper
│   │       │       ├── TimelineItem.tsx         → Individual clip/item
│   │       │       ├── TimelinePlayhead.tsx     → Red position indicator
│   │       │       ├── hooks/
│   │       │       │   └── useKeyboardShortcuts.ts → Keyboard handler
│   │       │       ├── utils/
│   │       │       │   ├── timeFormatter.ts     → Time/pixel conversion
│   │       │       │   └── snapCalculator.ts    → Snap logic
│   │       │       └── styles.ts                → Design tokens
│   │       ├── themes/
│   │       │   └── leica.ts                     → Theme definitions
│   │       └── index.ts                         → Component exports
│   │
│   └── remotion-components/       # Rendering
│       └── src/
│           ├── VideoComposition.tsx        → Main composition component
│           └── index.ts                    → Exports
│
├── examples/
│   └── basic-editor/
│       ├── src/
│       │   ├── main.tsx                    → Entry point
│       │   └── Root.tsx                    → Root setup (if exists)
│       └── index.html                      → HTML template
│
└── ARCHITECTURE.md                         → This detailed documentation

```

## Key Type Definitions

### Core Types Flow

```
EditorState
├── tracks: Track[]
│   └── Track
│       └── items: Item[]
│           ├── SolidItem { id, from, durationInFrames, color }
│           ├── TextItem { ..., text, color, fontSize, fontFamily, fontWeight }
│           ├── VideoItem { ..., src, volume, waveform, audioFadeIn, audioFadeOut }
│           ├── AudioItem { ..., src, volume, waveform, audioFadeIn, audioFadeOut }
│           └── ImageItem { ..., src }
├── assets: Asset[]
│   └── Asset { id, name, type, src, thumbnail?, waveform?, createdAt }
├── selectedItemId: string | null
├── selectedTrackId: string | null
├── currentFrame: number
├── playing: boolean
├── zoom: number
├── compositionWidth/Height: number
├── fps: number
└── durationInFrames: number
```

## State Management Cheat Sheet

### useEditor() Hook Usage

```typescript
// In any component wrapped by EditorProvider
const { state, dispatch } = useEditor();

// Access state
state.tracks           // Track[]
state.currentFrame     // number
state.selectedItemId   // string | null

// Dispatch actions
dispatch({ type: 'ADD_TRACK', payload: newTrack })
dispatch({ type: 'SET_CURRENT_FRAME', payload: 100 })
dispatch({ type: 'UPDATE_ITEM', payload: { trackId, itemId, updates } })
```

### Reducer Actions Quick Reference

| Action | Payload | Effect |
|--------|---------|--------|
| ADD_TRACK | track | Append track |
| INSERT_TRACK | { track, index } | Insert at position |
| REMOVE_TRACK | trackId | Delete track |
| UPDATE_TRACK | { id, updates } | Modify track |
| REORDER_TRACKS | Track[] | Replace all tracks |
| ADD_ITEM | { trackId, item } | Add to track |
| REMOVE_ITEM | { trackId, itemId } | Delete from track |
| UPDATE_ITEM | { trackId, itemId, updates } | Modify item |
| SELECT_ITEM | itemId \| null | Select/deselect |
| SELECT_TRACK | trackId \| null | Select/deselect |
| SET_CURRENT_FRAME | number | Move playhead |
| SET_PLAYING | boolean | Play/pause |
| SET_ZOOM | number | Change zoom level |
| ADD_ASSET | asset | Upload media |
| REMOVE_ASSET | assetId | Delete from library |
| SET_COMPOSITION_SIZE | { width, height } | Change canvas |
| SET_DURATION | number | Set video length |

## Component Props Reference

### Timeline.tsx Props
```typescript
{
  state,           // EditorState from useEditor()
  dispatch,        // Dispatch from useEditor()
  tracks,          // state.tracks
  selectedItemId,  // state.selectedItemId
  currentFrame,    // state.currentFrame
  zoom,            // state.zoom
  // ... handlers for various events
}
```

### TimelineItem.tsx Props
```typescript
{
  item: Item
  trackId: string
  pixelsPerFrame: number
  isSelected: boolean
  assets: Asset[]
  onSelect: () => void
  onDelete: () => void
  onUpdate: (itemId, updates) => void
}
```

### PreviewCanvas.tsx Props
None directly - uses useEditor() internally

```typescript
// Internally uses:
{
  component: VideoComposition
  inputProps: { tracks: state.tracks }
  compositionWidth: state.compositionWidth
  compositionHeight: state.compositionHeight
  durationInFrames: state.durationInFrames
  fps: state.fps
}
```

## Timeline Pixel/Frame Conversion

```typescript
import { getPixelsPerFrame, frameToPixels, pixelsToFrame } from './timeline/utils/timeFormatter'

// Calculate pixels per frame based on zoom
pixelsPerFrame = getPixelsPerFrame(zoom)  // 2 * zoom

// Convert frame number to pixel position
pixelX = frameToPixels(frame, pixelsPerFrame)

// Convert pixel position to frame number
frame = pixelsToFrame(pixelX, pixelsPerFrame)

// Example: zoom=1.0 means 2 pixels per frame
//   frame 100 → 200 pixels
//   pixel 300 → frame 150
```

## Snap Calculation

```typescript
import { calculateSnap } from './timeline/utils/snapCalculator'

const result = calculateSnap(
  frame,              // Current frame position
  tracks,             // All tracks
  currentItemId,      // Item being moved (exclude from snap targets)
  playheadFrame,      // Playhead position
  snapEnabled,        // Boolean toggle
  threshold           // Pixels/frames to snap within
)

// Returns
{
  snappedFrame: number      // Adjusted frame position
  target: SnapTarget | null // What it snapped to
  didSnap: boolean          // Was snap applied
}
```

## Keyboard Shortcuts

```
Space           → Play/Pause
Delete          → Delete selected item
Cmd/Ctrl+Z      → Undo (handler ready)
Cmd/Ctrl+Shift+Z → Redo (handler ready)
Cmd/Ctrl+C      → Copy (handler ready)
Cmd/Ctrl+V      → Paste (handler ready)
Cmd/Ctrl+D      → Duplicate (handler ready)
Arrow Left      → -1 frame (Shift: -10)
Arrow Right     → +1 frame (Shift: +10)
Cmd/Ctrl+=/+    → Zoom in
Cmd/Ctrl+-      → Zoom out
```

## Drag & Drop Flow

### Asset to Timeline

```
AssetPanel (dragstart)
  → currentDraggedAsset = asset (global)
  → dataTransfer.setData('assetId', id)
  
Timeline (dragover)
  → e.preventDefault()
  → e.dataTransfer.dropEffect = 'copy'
  
Track/Timeline (drop)
  → e.dataTransfer.getData('assetId')
  → pixelsToFrame(x) → frame position
  → calculateSnap() → snapped position
  → dispatch(ADD_ITEM, { trackId, item })
```

### Global Variables Used

```typescript
// AssetPanel.tsx
export let currentDraggedAsset = null

// TimelineTracksContainer.tsx
let globalDragData = {
  assetId?: string
  quickAdd?: string
  quickAddType?: 'text' | 'solid'
  asset?: string
}

// TimelineItem.tsx
window.currentDraggedItem = { item, trackId } | null
```

## Rendering (Remotion Integration)

### VideoComposition → ItemComponent Tree

```
VideoComposition { tracks }
  ├─ AbsoluteFill (white bg)
  └─ TrackComponent[] 
      └─ Sequence(from, durationInFrames)
          └─ ItemComponent
              ├─ SolidItem → <AbsoluteFill bgcolor/>
              ├─ TextItem → <h1>text</h1> with fade
              ├─ VideoItem → <OffthreadVideo/> with volume fade
              ├─ AudioItem → <Audio/> with volume fade
              └─ ImageItem → <Img/>
```

## Testing Checklist

### State Management
- [ ] EditorProvider wraps components
- [ ] useEditor() returns { state, dispatch }
- [ ] Reducer creates new state objects (immutable)
- [ ] Actions dispatch correctly

### UI Components
- [ ] AssetPanel displays uploaded files
- [ ] PreviewCanvas shows Remotion player
- [ ] PropertiesPanel edits selected items
- [ ] Timeline shows tracks with items

### Timeline
- [ ] Zoom in/out works
- [ ] Snap toggles on/off
- [ ] Playhead draggable
- [ ] Items draggable within tracks
- [ ] Assets draggable to timeline

### Drag & Drop
- [ ] Asset drag creates timeline item
- [ ] Snap positions correctly
- [ ] Multiple items layer properly
- [ ] Quick add (text/color) works

### Keyboard
- [ ] Space plays/pauses
- [ ] Delete removes item
- [ ] Arrow keys navigate frames
- [ ] Cmd+Zoom works

## Common Bugs & Solutions

### Drag Data Not Transferring
- **Issue**: dataTransfer is empty in drop handler
- **Solution**: Use global variables (currentDraggedAsset, globalDragData)

### Timeline Items Not Updating
- **Issue**: Changes don't reflect in preview
- **Solution**: Ensure dispatch calls with correct trackId and itemId

### Snap Not Working
- **Issue**: Items don't snap to grid
- **Solution**: Check snapEnabled state, threshold, and calculateSnap logic

### Waveform Not Generating
- **Issue**: Audio items show no waveform
- **Solution**: Ensure loadAudioWaveform completes, check audio file format

### Zoom Performance Degradation
- **Issue**: Timeline slows with many items at high zoom
- **Solution**: Implement virtualization or timeline windowing

## Performance Tips

1. **Memoize callbacks**: Use useCallback for handlers to prevent re-renders
2. **Memoize components**: Use React.memo for TimelineItem
3. **Virtualize tracks**: Render only visible tracks for large projects
4. **Lazy load thumbnails**: Generate on-demand, not upfront
5. **Debounce zoom**: Batch zoom updates to reduce re-renders
6. **Simplify styles**: Use design tokens, avoid inline styles

## Extension Points

### Adding New Item Type
1. Add to Item union: `type: 'newType'`
2. Add to type definition
3. Handle in ItemComponent (Remotion)
4. Add properties to PropertiesPanel
5. Handle in TimelineItem visualization

### Adding New Action
1. Define action type in EditorAction
2. Add case to editorReducer
3. Call dispatch in component
4. Test with current state

### Adding Keyboard Shortcut
1. Add to KeyboardShortcutHandlers interface
2. Add handler in Timeline.tsx useKeyboardShortcuts call
3. Implement action in handler

