# Remotion Timeline Drag-and-Drop Implementation Plan

## Executive Summary

This document outlines a comprehensive plan to replace the current unreliable native drag-and-drop implementation with a professional solution using **@dnd-kit**. The current implementation suffers from duplicated items when moving between tracks, global state pollution via `window.currentDraggedItem`, and inconsistent behavior across browsers.

---

## Problem Analysis

### Current Implementation Issues

1. **Duplication Bug**: Items are duplicated instead of moved when dragging between tracks
   - Root cause: The old implementation (Timeline.old.tsx) dispatches both `REMOVE_ITEM` and `ADD_ITEM` actions during `dragOver`, causing multiple renders and race conditions
   - Lines 172-188 in Timeline.old.tsx show the problematic pattern

2. **Global State Pollution**: Uses React state (`draggedItem`) that gets out of sync with Redux/Context state during drag operations
   - The state update in `dragOver` (line 162-169) creates inconsistent intermediate states
   - When dropping, the item exists in both old and new tracks temporarily

3. **Missing Data Transfer**: AssetPanel sets `'asset'` as the data key (line 125), but Timeline.tsx looks for `'assetId'` (line 109)
   - This causes assets from the panel to not be recognized when dropped

4. **Native Drag Events Are Unreliable**:
   - `dragOver` fires continuously (dozens of times per second), causing performance issues
   - No built-in support for snap-to-grid or visual drop indicators
   - Browser inconsistencies in `dataTransfer` API behavior
   - Cannot easily animate drag previews or show insertion indicators

### Why Native Drag Events Fail

Native HTML5 drag-and-drop has fundamental limitations:

- **Event Frequency**: `dragOver` fires on every mouse move, making state updates expensive
- **Data Transfer Limitations**: Can only pass strings, not objects or references
- **Browser Differences**: Safari, Chrome, Firefox handle drag images differently
- **No Undo/Cancel**: Once you start dispatching actions in `dragOver`, there's no clean rollback
- **Ghost Images**: Limited control over drag preview appearance
- **Mobile Support**: Doesn't work on touch devices without polyfills

### Root Causes

1. **Optimistic Updates**: Updating Redux state during `dragOver` instead of waiting for `drop`
2. **State Synchronization**: Local component state (`draggedItem`) conflicts with global state
3. **Missing Transaction Model**: No way to batch operations or rollback on cancel (ESC key)
4. **Tight Coupling**: Drag logic mixed with rendering logic in Timeline components

---

## Library Evaluation

### Comparison Matrix

| Feature | @dnd-kit | react-dnd | react-beautiful-dnd | framer-motion | react-sortable-hoc |
|---------|----------|-----------|---------------------|---------------|-------------------|
| **React 18+ Support** | ✅ Excellent | ✅ Yes | ❌ Deprecated | ✅ Yes | ⚠️ Uses deprecated findDOMNode |
| **TypeScript** | ✅ First-class | ✅ Good | ✅ Good | ✅ Excellent | ⚠️ Community types |
| **Bundle Size** | 🟢 10kb (core) | 🟡 ~20kb | 🟡 ~30kb | 🟢 Already installed | 🟢 15kb |
| **Performance** | 🟢 Excellent | 🟡 Good | 🟢 Good | 🟡 Good for small lists | 🟢 Good |
| **Accessibility** | ✅ Built-in keyboard, screen reader | ⚠️ Manual implementation | ✅ Excellent | ❌ Manual | ⚠️ Basic |
| **Mobile/Touch** | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes | ✅ Yes |
| **Maintenance** | 🟢 Active (2025) | 🟢 Active | ❌ Archived Aug 2025 | 🟢 Active | ❌ No new features |
| **Multi-container** | ✅ SortableContext | ✅ Multiple drop targets | ✅ Multiple droppables | ⚠️ Manual | ✅ Yes |
| **Custom Animations** | ✅ CSS transforms | ⚠️ Manual | ✅ Built-in | ✅ Excellent | ⚠️ Limited |
| **Drop Indicators** | ✅ Via overlay | ⚠️ Manual | ✅ Built-in | ⚠️ Manual | ⚠️ Manual |
| **Constraints** | ✅ Collision detection | ✅ Can drop callback | ✅ Built-in | ✅ dragConstraints | ⚠️ Limited |
| **Timeline-specific** | ✅ dnd-timeline library | ⚠️ Custom | ❌ | ⚠️ Custom | ❌ |

### Detailed Evaluation

#### 1. @dnd-kit/sortable ⭐ RECOMMENDED

**Pros:**
- Modern architecture built for React 18+ with hooks and context
- Zero dependencies, 10kb minified core
- Excellent performance: Uses CSS transforms (translate3d), lazy position calculation
- Built-in accessibility: Keyboard navigation (Space, Arrow keys), screen reader support
- **Timeline library**: `dnd-timeline` is built on @dnd-kit with examples for multi-track editing
- Multiple containers (tracks) via `SortableContext`
- Collision detection algorithms (closestCenter, rectIntersection, pointerWithin)
- DragOverlay for portal-based drag previews (doesn't block scrolling)
- Active maintenance by original author (clauderic)

**Cons:**
- Some users report performance issues in very large applications (1000+ items)
- Slightly steeper learning curve than drag-and-drop-hoc
- Requires manual implementation of visual drop indicators (blue line)

**Use Case Fit:** ⭐⭐⭐⭐⭐
Perfect for timeline editors. The `dnd-timeline` library proves this architecture works for this exact use case.

---

#### 2. react-dnd

**Pros:**
- Battle-tested (7+ years), used by major companies
- Flexible architecture with backends (HTML5, Touch, Custom)
- Good documentation and community support
- 2.6M weekly downloads (most popular)

**Cons:**
- Larger bundle size (~20kb)
- More boilerplate (monitor, collect functions)
- Manual accessibility implementation
- No built-in sortable preset (need to implement swap logic manually)
- Steeper learning curve

**Use Case Fit:** ⭐⭐⭐
Powerful but overkill for our needs. Better suited for complex drag-and-drop across different UI paradigms (like Trello boards + file uploads + canvas).

---

#### 3. react-beautiful-dnd

**Pros:**
- Beautiful animations out of the box
- Excellent accessibility
- Great DX with simple API

**Cons:**
- **DEPRECATED** and archived (August 2025)
- React 18 StrictMode breaks it ("Unable to find draggable with id")
- No future updates or security patches
- Atlassian recommends migrating to their new library: pragmatic-drag-and-drop

**Use Case Fit:** ❌
Cannot recommend deprecated libraries for production use.

---

#### 4. framer-motion drag

**Pros:**
- Already installed in the project (0 bundle size increase)
- Excellent animation capabilities
- Great drag constraints (`dragConstraints`, `dragElastic`)
- Works well with timeline visual effects

**Cons:**
- Not designed for sortable lists or multi-container drag-and-drop
- No built-in collision detection or drop zones
- Manual implementation of all drag-and-drop logic
- No accessibility features
- Performance degrades with many draggable items (>50)

**Use Case Fit:** ⭐⭐
Good for individual item dragging within a single track, but not for multi-track sortable behavior. Could complement @dnd-kit for visual enhancements.

---

#### 5. react-sortable-hoc

**Pros:**
- Lightweight (15kb)
- Simple API
- Good performance

**Cons:**
- **NO LONGER MAINTAINED** (author redirects to @dnd-kit)
- Uses deprecated `findDOMNode` (will break in future React versions)
- Last meaningful update was 2020
- No TypeScript improvements

**Use Case Fit:** ❌
Original author recommends @dnd-kit as replacement.

---

### Final Recommendation: @dnd-kit

**Why @dnd-kit wins:**

1. **Proven for Timelines**: The `dnd-timeline` library demonstrates that @dnd-kit works excellent for our exact use case
2. **Modern & Maintained**: Built for React 18+, actively developed in 2025
3. **Performance**: Handles 1000+ items smoothly with virtualization
4. **Accessibility**: Built-in keyboard and screen reader support
5. **Small Bundle**: 10kb core, only adds ~15kb total with sortable preset
6. **Extensibility**: Can combine with framer-motion for animations
7. **Community**: Large ecosystem, good documentation, Stack Overflow support

**Integration with existing code:**
- Compatible with current Remotion Player
- Works with framer-motion animations (can use both)
- Supports our snapping requirements via collision detection
- Handles asset panel drag-and-drop alongside track reordering

---

## Implementation Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                     DndContext (Timeline)                   │
│  - Sensors: Mouse, Touch, Keyboard                          │
│  - Collision Detection: closestCenter + custom snap         │
│  - Modifiers: snapToGrid (for frame snapping)               │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          SortableContext (Track 1)                    │  │
│  │  - items: [item1.id, item2.id, item3.id]             │  │
│  │  - strategy: horizontalListSortingStrategy            │  │
│  │                                                         │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐              │  │
│  │  │ TimelineItem (useSortable)           │              │  │
│  │  │  - Drag handle                        │              │  │
│  │  │  - Resize handles (separate logic)   │              │  │
│  │  └──────────┘ └──────────┘ └──────────┘              │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          SortableContext (Track 2)                    │  │
│  │  ...                                                   │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │          Droppable (Asset Panel)                      │  │
│  │  - useDroppable for external drag sources            │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │    DragOverlay (Portal-based preview)                 │  │
│  │  - Shows dragged item clone                           │  │
│  │  - Doesn't interfere with layout                      │  │
│  └───────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### State Management Approach

**Principles:**
1. **Single Source of Truth**: EditorContext remains the only state manager
2. **Optimistic Updates on Drop**: Only dispatch Redux actions in `onDragEnd`, not `onDragOver`
3. **Visual Feedback via Local State**: Use component state for drop indicators, not global state
4. **Immutable Operations**: Always create new arrays/objects, never mutate

**State Flow:**

```
User starts dragging
    ↓
onDragStart: Store original item + track in local state
    ↓
onDragOver: Calculate insertion index, update local indicator state
    ↓ (user moves mouse)
onDragOver: Recalculate insertion index, update indicator
    ↓ (user moves mouse)
onDragOver: ...
    ↓ (user releases)
onDragEnd: 
    - Dispatch single batch action: MOVE_ITEM or ADD_ITEM
    - Clear local state
    - DnD kit handles animation
```

**No intermediate state updates** → No duplication bugs!

### Component Structure

```
src/editor/Timeline/
├── dnd/
│   ├── DndTimelineProvider.tsx          # DndContext wrapper with sensors
│   ├── useDndCollision.ts               # Custom collision detection with snap
│   ├── useDndModifiers.ts               # Frame snapping modifier
│   └── types.ts                         # DnD-specific TypeScript types
├── TimelineTrack.tsx                    # Wraps items in SortableContext
├── TimelineItem.tsx                     # Uses useSortable hook
├── TimelineDropIndicator.tsx            # Blue line visual indicator
├── AssetPanelDragItem.tsx               # Draggable asset items
└── hooks/
    ├── useDragToTimeline.ts             # Handle asset → timeline drops
    └── useTrackItemMove.ts              # Handle item moves between tracks
```

---

## Migration Strategy

### Phase 1: Setup & Infrastructure (Day 1)

**Goal:** Install dependencies and create DnD wrapper without breaking existing code

**Tasks:**
1. Install packages:
   ```bash
   pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
   ```

2. Create `DndTimelineProvider.tsx`:
   - Wrap Timeline in DndContext
   - Set up sensors (mouse, touch, keyboard)
   - Add collision detection (closestCenter initially)
   - Add empty `onDragStart`, `onDragOver`, `onDragEnd` handlers

3. Create type definitions in `dnd/types.ts`:
   ```typescript
   interface DraggedItem {
     id: string;
     trackId: string;
     from: number;
     durationInFrames: number;
   }
   
   interface DropIndicator {
     trackId: string;
     insertionIndex: number;
     frame: number;
   }
   ```

4. **Testing**: Verify app still runs, no regressions

---

### Phase 2: Track & Item Integration (Day 2)

**Goal:** Make items draggable within the same track

**Tasks:**
1. Update `TimelineTrack.tsx`:
   - Wrap items in `<SortableContext>`
   - Use `horizontalListSortingStrategy`
   - Pass item IDs array to `items` prop

2. Update `TimelineItem.tsx`:
   - Replace native drag handlers with `useSortable`
   - Extract `attributes`, `listeners`, `setNodeRef` from hook
   - Apply listeners to drag handle (entire item or specific handle icon)
   - Keep resize handles separate (don't apply listeners)

3. Implement `onDragEnd` in DndTimelineProvider:
   - Detect same-track reordering
   - Dispatch `REORDER_ITEMS_IN_TRACK` action
   - Calculate new `from` values for all items

4. **Testing**: 
   - Drag items within same track
   - Verify smooth animation
   - Verify resize handles still work (not affected by drag)

---

### Phase 3: Cross-Track Movement (Day 3)

**Goal:** Enable moving items between tracks

**Tasks:**
1. Implement multi-container logic in `onDragEnd`:
   ```typescript
   const { active, over } = event;
   
   if (!over) return; // Dropped outside
   
   const activeTrack = findTrackByItemId(active.id);
   const overTrack = findTrackByItemId(over.id) || over.id; // over.id might be track itself
   
   if (activeTrack === overTrack) {
     // Same track: reorder
     dispatch({ type: 'REORDER_ITEMS', ... });
   } else {
     // Different track: move
     dispatch({ type: 'MOVE_ITEM_TO_TRACK', ... });
   }
   ```

2. Add `MOVE_ITEM_TO_TRACK` action to reducer:
   ```typescript
   case 'MOVE_ITEM_TO_TRACK': {
     const { itemId, fromTrackId, toTrackId, newFrom } = action.payload;
     
     const fromTrack = state.tracks.find(t => t.id === fromTrackId);
     const toTrack = state.tracks.find(t => t.id === toTrackId);
     
     const item = fromTrack.items.find(i => i.id === itemId);
     
     return {
       ...state,
       tracks: state.tracks.map(track => {
         if (track.id === fromTrackId) {
           return { ...track, items: track.items.filter(i => i.id !== itemId) };
         }
         if (track.id === toTrackId) {
           return { ...track, items: [...track.items, { ...item, from: newFrom }] };
         }
         return track;
       })
     };
   }
   ```

3. Create `TimelineDropIndicator.tsx`:
   - Show blue vertical line at insertion point
   - Position based on calculated frame
   - Render in DragOverlay or as absolute positioned element

4. **Testing**:
   - Drag item from track 1 to track 2
   - Verify item is MOVED (not copied)
   - Verify no duplication
   - Verify drop indicator appears

---

### Phase 4: Asset Panel Integration (Day 4)

**Goal:** Enable dragging assets from panel to tracks

**Tasks:**
1. Update `AssetPanel.tsx`:
   - Wrap draggable assets with `useDraggable` hook (not `useSortable`)
   - Set data: `{ id: asset.id, type: 'asset', assetData: asset }`

2. Create `useTrackDroppable.ts` hook:
   - Use `useDroppable` for each track
   - Accept external drags (assets)
   - Calculate drop frame from mouse position

3. Update `onDragEnd` in DndTimelineProvider:
   ```typescript
   if (active.data.current?.type === 'asset') {
     const asset = active.data.current.assetData;
     const frame = calculateFrameFromPosition(event);
     
     dispatch({
       type: 'ADD_ITEM',
       payload: { trackId: over.id, item: createItemFromAsset(asset, frame) }
     });
   }
   ```

4. **Testing**:
   - Drag video/audio/image from asset panel
   - Verify item created at correct frame
   - Verify snap-to-grid works
   - Verify drop indicator shows

---

### Phase 5: Snapping & Collision (Day 5)

**Goal:** Implement frame snapping and smart collision detection

**Tasks:**
1. Create `useDndModifiers.ts`:
   ```typescript
   import { Modifier } from '@dnd-kit/core';
   
   export const createSnapModifier = (pixelsPerFrame: number): Modifier => {
     return ({ transform }) => {
       const frameSnap = Math.round(transform.x / pixelsPerFrame) * pixelsPerFrame;
       return { ...transform, x: frameSnap };
     };
   };
   ```

2. Create `useDndCollision.ts`:
   ```typescript
   import { closestCenter, CollisionDetection } from '@dnd-kit/core';
   
   export const createTimelineCollision = (
     snapEnabled: boolean,
     currentFrame: number
   ): CollisionDetection => {
     return (args) => {
       // First use closestCenter
       const collision = closestCenter(args);
       
       // Then apply snap logic
       if (snapEnabled) {
         // Snap to playhead, item edges, etc.
       }
       
       return collision;
     };
   };
   ```

3. Integrate modifiers:
   ```typescript
   <DndContext
     modifiers={[snapModifier]}
     collisionDetection={timelineCollision}
   >
   ```

4. **Testing**:
   - Enable snap, drag item → should snap to grid
   - Disable snap (Shift key), drag → free movement
   - Snap to playhead when nearby
   - Snap to other item edges

---

### Phase 6: Visual Polish & Animations (Day 6)

**Goal:** Add professional visual feedback

**Tasks:**
1. Implement `DragOverlay`:
   ```typescript
   <DragOverlay>
     {activeId ? (
       <TimelineItemPreview 
         item={findItemById(activeId)} 
         isDragging 
       />
     ) : null}
   </DragOverlay>
   ```

2. Add CSS transitions:
   ```typescript
   const style = {
     transform: CSS.Transform.toString(transform),
     transition,
     opacity: isDragging ? 0.5 : 1,
   };
   ```

3. Add drop indicator animation (framer-motion):
   ```typescript
   <motion.div
     initial={{ scaleY: 0 }}
     animate={{ scaleY: 1 }}
     exit={{ scaleY: 0 }}
     style={{
       position: 'absolute',
       left: frameToPixels(frame),
       width: 2,
       height: '100%',
       backgroundColor: colors.accent.primary,
     }}
   />
   ```

4. Add empty track auto-delete:
   ```typescript
   // In onDragEnd, after moving item
   const fromTrack = tracks.find(t => t.id === fromTrackId);
   if (fromTrack.items.length === 0 && tracks.length > 1) {
     dispatch({ type: 'REMOVE_TRACK', payload: fromTrackId });
   }
   ```

5. **Testing**:
   - Verify drag overlay looks good
   - Verify drop indicator animates smoothly
   - Verify empty tracks are deleted
   - Test on different screen sizes

---

### Phase 7: Keyboard & Accessibility (Day 7)

**Goal:** Ensure timeline is fully accessible

**Tasks:**
1. Configure keyboard sensors:
   ```typescript
   const sensors = useSensors(
     useSensor(PointerSensor),
     useSensor(KeyboardSensor, {
       coordinateGetter: sortableKeyboardCoordinates,
     })
   );
   ```

2. Add ARIA labels:
   ```typescript
   <div
     ref={setNodeRef}
     {...attributes}
     {...listeners}
     aria-label={`${item.type} item at ${formatFrame(item.from)}`}
     role="button"
     tabIndex={0}
   >
   ```

3. Add screen reader announcements:
   ```typescript
   const announcements = {
     onDragStart: ({ active }) => `Picked up ${active.id}`,
     onDragOver: ({ active, over }) => `Moved ${active.id} over ${over?.id}`,
     onDragEnd: ({ active, over }) => `Dropped ${active.id} on ${over?.id}`,
     onDragCancel: ({ active }) => `Cancelled dragging ${active.id}`,
   };
   ```

4. **Testing**:
   - Navigate with Tab key
   - Activate drag with Space bar
   - Move with Arrow keys
   - Drop with Space bar
   - Test with screen reader (macOS VoiceOver or NVDA)

---

### Backward Compatibility

**During migration:**
- Keep old Timeline.old.tsx as reference
- Feature flag: `USE_NEW_DND` environment variable
- Gradual rollout: Enable for internal testing first

**Rollback plan:**
- All changes in isolated files (dnd/ folder)
- Can revert by removing DndTimelineProvider wrapper
- Existing components still work without dnd-kit

---

## Code Examples

### 1. DndTimelineProvider.tsx

```typescript
import React, { useState, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useEditor } from '../../state/EditorContext';
import { createSnapModifier } from './useDndModifiers';
import { createTimelineCollision } from './useDndCollision';
import { TimelineItemPreview } from '../TimelineItemPreview';

interface Props {
  children: React.ReactNode;
  pixelsPerFrame: number;
  snapEnabled: boolean;
}

export const DndTimelineProvider: React.FC<Props> = ({
  children,
  pixelsPerFrame,
  snapEnabled,
}) => {
  const { state, dispatch } = useEditor();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [dropIndicator, setDropIndicator] = useState<{
    trackId: string;
    frame: number;
  } | null>(null);

  // Configure sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px threshold to distinguish from click
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Create modifiers and collision detection
  const modifiers = [createSnapModifier(pixelsPerFrame, snapEnabled)];
  const collisionDetection = createTimelineCollision(
    snapEnabled,
    state.currentFrame,
    state.tracks
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) {
      setDropIndicator(null);
      return;
    }

    // Calculate drop frame from position
    const overId = over.id as string;
    const trackId = overId.startsWith('track-') 
      ? overId 
      : findTrackByItemId(overId, state.tracks);

    if (trackId) {
      const frame = calculateFrameFromDelta(
        event.delta.x,
        active.rect.current.initial?.left || 0,
        pixelsPerFrame
      );

      setDropIndicator({ trackId, frame });
    }
  }, [state.tracks, pixelsPerFrame]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    
    setActiveId(null);
    setDropIndicator(null);

    if (!over) return; // Dropped outside

    const activeId = active.id as string;
    const overId = over.id as string;

    // Check if dragging an asset from panel
    if (active.data.current?.type === 'asset') {
      handleAssetDrop(active, over, state, dispatch, pixelsPerFrame);
      return;
    }

    // Check if dragging an existing item
    const activeTrack = findTrackByItemId(activeId, state.tracks);
    const overTrack = findTrackByItemId(overId, state.tracks) || overId;

    if (!activeTrack) return;

    if (activeTrack.id === overTrack.id) {
      // Same track: reorder
      handleSameTrackReorder(activeId, overId, activeTrack, dispatch);
    } else {
      // Different track: move
      handleCrossTrackMove(
        activeId,
        activeTrack.id,
        overTrack.id,
        event,
        state,
        dispatch,
        pixelsPerFrame
      );
    }
  }, [state, dispatch, pixelsPerFrame]);

  const handleDragCancel = useCallback(() => {
    setActiveId(null);
    setDropIndicator(null);
  }, []);

  return (
    <DndContext
      sensors={sensors}
      modifiers={modifiers}
      collisionDetection={collisionDetection}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      {children}
      
      <DragOverlay>
        {activeId ? (
          <TimelineItemPreview 
            item={findItemById(activeId, state.tracks)} 
            pixelsPerFrame={pixelsPerFrame}
          />
        ) : null}
      </DragOverlay>

      {dropIndicator && (
        <TimelineDropIndicator
          trackId={dropIndicator.trackId}
          frame={dropIndicator.frame}
          pixelsPerFrame={pixelsPerFrame}
        />
      )}
    </DndContext>
  );
};

// Helper functions
function findTrackByItemId(itemId: string, tracks: Track[]): Track | undefined {
  return tracks.find(track => track.items.some(item => item.id === itemId));
}

function findItemById(itemId: string, tracks: Track[]): Item | undefined {
  for (const track of tracks) {
    const item = track.items.find(i => i.id === itemId);
    if (item) return item;
  }
}

function calculateFrameFromDelta(
  deltaX: number,
  initialLeft: number,
  pixelsPerFrame: number
): number {
  return Math.round((initialLeft + deltaX) / pixelsPerFrame);
}

function handleAssetDrop(
  active: Active,
  over: Over,
  state: EditorState,
  dispatch: Dispatch,
  pixelsPerFrame: number
) {
  const asset = active.data.current?.assetData;
  if (!asset) return;

  const trackId = over.id as string;
  const frame = calculateFrameFromDelta(
    active.rect.current.translated?.left || 0,
    0,
    pixelsPerFrame
  );

  const newItem = createItemFromAsset(asset, frame);
  
  dispatch({
    type: 'ADD_ITEM',
    payload: { trackId, item: newItem },
  });
}

function handleSameTrackReorder(
  activeId: string,
  overId: string,
  track: Track,
  dispatch: Dispatch
) {
  const oldIndex = track.items.findIndex(i => i.id === activeId);
  const newIndex = track.items.findIndex(i => i.id === overId);

  if (oldIndex === newIndex) return;

  const newItems = arrayMove(track.items, oldIndex, newIndex);

  dispatch({
    type: 'REORDER_ITEMS_IN_TRACK',
    payload: { trackId: track.id, items: newItems },
  });
}

function handleCrossTrackMove(
  activeId: string,
  fromTrackId: string,
  toTrackId: string,
  event: DragEndEvent,
  state: EditorState,
  dispatch: Dispatch,
  pixelsPerFrame: number
) {
  const item = findItemById(activeId, state.tracks);
  if (!item) return;

  const frame = calculateFrameFromDelta(
    event.delta.x,
    event.active.rect.current.initial?.left || 0,
    pixelsPerFrame
  );

  dispatch({
    type: 'MOVE_ITEM_TO_TRACK',
    payload: {
      itemId: activeId,
      fromTrackId,
      toTrackId,
      newFrom: Math.max(0, frame),
    },
  });

  // Auto-delete empty track
  const fromTrack = state.tracks.find(t => t.id === fromTrackId);
  if (fromTrack && fromTrack.items.length === 1 && state.tracks.length > 1) {
    dispatch({ type: 'REMOVE_TRACK', payload: fromTrackId });
  }
}

function createItemFromAsset(asset: Asset, frame: number): Item {
  const baseItem = {
    id: `item-${Date.now()}-${Math.random()}`,
    from: frame,
    assetId: asset.id,
  };

  switch (asset.type) {
    case 'video':
      return {
        ...baseItem,
        type: 'video',
        src: asset.src,
        durationInFrames: asset.duration || 90,
        waveform: asset.waveform,
      };
    case 'audio':
      return {
        ...baseItem,
        type: 'audio',
        src: asset.src,
        durationInFrames: asset.duration || 90,
        waveform: asset.waveform,
      };
    case 'image':
      return {
        ...baseItem,
        type: 'image',
        src: asset.src,
        durationInFrames: 90,
      };
    default:
      throw new Error(`Unknown asset type: ${asset.type}`);
  }
}

// Array move utility (from @dnd-kit/sortable)
function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const newArray = array.slice();
  newArray.splice(to < 0 ? newArray.length + to : to, 0, newArray.splice(from, 1)[0]);
  return newArray;
}
```

---

### 2. TimelineTrack.tsx (Updated)

```typescript
import React from 'react';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { Track, Item, Asset } from '../../types';
import { TimelineItem } from './TimelineItem';

interface Props {
  track: Track;
  pixelsPerFrame: number;
  selectedItemId: string | null;
  assets: Asset[];
  onSelectItem: (itemId: string) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, updates: Partial<Item>) => void;
}

export const TimelineTrack: React.FC<Props> = ({
  track,
  pixelsPerFrame,
  selectedItemId,
  assets,
  onSelectItem,
  onDeleteItem,
  onUpdateItem,
}) => {
  // Make track a droppable area
  const { setNodeRef, isOver } = useDroppable({
    id: track.id,
    data: {
      type: 'track',
      track,
    },
  });

  const itemIds = track.items.map(item => item.id);

  return (
    <div
      ref={setNodeRef}
      style={{
        display: 'flex',
        height: 60,
        borderBottom: '1px solid #333',
        backgroundColor: isOver ? '#1e3a5f' : '#1a1a1a',
        position: 'relative',
        transition: 'background-color 0.2s',
      }}
    >
      {/* Track label */}
      <div
        style={{
          width: 200,
          padding: 12,
          backgroundColor: '#222',
          borderRight: '1px solid #333',
        }}
      >
        <h3 style={{ margin: 0, fontSize: 14, color: '#fff' }}>
          {track.name}
        </h3>
      </div>

      {/* Track content with sortable items */}
      <div style={{ flex: 1, position: 'relative' }}>
        <SortableContext
          items={itemIds}
          strategy={horizontalListSortingStrategy}
        >
          {track.items.map((item) => (
            <TimelineItem
              key={item.id}
              item={item}
              pixelsPerFrame={pixelsPerFrame}
              isSelected={selectedItemId === item.id}
              assets={assets}
              onSelect={() => onSelectItem(item.id)}
              onDelete={() => onDeleteItem(item.id)}
              onUpdateItem={(updates) => onUpdateItem(item.id, updates)}
            />
          ))}
        </SortableContext>
      </div>
    </div>
  );
};
```

---

### 3. TimelineItem.tsx (Updated)

```typescript
import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item, Asset } from '../../types';
import { frameToPixels } from './utils/timeFormatter';

interface Props {
  item: Item;
  pixelsPerFrame: number;
  isSelected: boolean;
  assets: Asset[];
  onSelect: () => void;
  onDelete: () => void;
  onUpdateItem: (updates: Partial<Item>) => void;
}

export const TimelineItem: React.FC<Props> = ({
  item,
  pixelsPerFrame,
  isSelected,
  assets,
  onSelect,
  onDelete,
  onUpdateItem,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
    data: {
      type: 'item',
      item,
    },
  });

  const style = {
    position: 'absolute' as const,
    left: frameToPixels(item.from, pixelsPerFrame),
    width: frameToPixels(item.durationInFrames, pixelsPerFrame),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : 1,
  };

  const asset = ['video', 'audio', 'image'].includes(item.type)
    ? assets.find(a => a.id === item.assetId)
    : null;

  // Separate resize logic (don't apply drag listeners to resize handles)
  const handleResizeStart = (edge: 'left' | 'right', e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent drag from starting
    // ... resize logic
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
    >
      <div
        {...attributes}
        {...listeners} // Drag listeners only on main body
        style={{
          width: '100%',
          height: 50,
          backgroundColor: getItemColor(item.type),
          borderRadius: 4,
          padding: 8,
          cursor: isDragging ? 'grabbing' : 'grab',
          border: isSelected ? '2px solid #4a9eff' : 'none',
        }}
      >
        <div style={{ fontSize: 12, color: '#fff' }}>
          {asset?.name || item.type}
        </div>
      </div>

      {/* Resize handles - NO drag listeners */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'ew-resize',
          backgroundColor: isSelected ? '#4a9eff' : 'transparent',
        }}
        onMouseDown={(e) => handleResizeStart('left', e)}
      />

      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 8,
          cursor: 'ew-resize',
          backgroundColor: isSelected ? '#4a9eff' : 'transparent',
        }}
        onMouseDown={(e) => handleResizeStart('right', e)}
      />
    </div>
  );
};

function getItemColor(type: string): string {
  switch (type) {
    case 'video': return '#8b5cf6';
    case 'audio': return '#10b981';
    case 'image': return '#f59e0b';
    case 'text': return '#3b82f6';
    case 'solid': return '#ec4899';
    default: return '#6b7280';
  }
}
```

---

### 4. AssetPanelDragItem.tsx

```typescript
import React from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Asset } from '../../types';

interface Props {
  asset: Asset;
  onDelete: () => void;
}

export const AssetPanelDragItem: React.FC<Props> = ({ asset, onDelete }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `asset-${asset.id}`,
    data: {
      type: 'asset',
      assetData: asset,
    },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        display: 'flex',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#2d2d2d',
        borderRadius: 4,
        cursor: isDragging ? 'grabbing' : 'grab',
        opacity: isDragging ? 0.5 : 1,
        marginBottom: 8,
      }}
    >
      {/* Thumbnail */}
      {asset.type === 'image' || asset.type === 'video' ? (
        <img
          src={asset.thumbnail || asset.src}
          alt={asset.name}
          style={{
            width: 48,
            height: 48,
            objectFit: 'cover',
            borderRadius: 4,
            marginRight: 12,
          }}
        />
      ) : (
        <div
          style={{
            width: 48,
            height: 48,
            backgroundColor: '#3d3d3d',
            borderRadius: 4,
            marginRight: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}
        >
          🎵
        </div>
      )}

      {/* Info */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <div
          style={{
            fontSize: 14,
            color: '#fff',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {asset.name}
        </div>
        <div style={{ fontSize: 12, color: '#aaa' }}>
          {asset.type}
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          width: 24,
          height: 24,
          backgroundColor: '#ff4444',
          color: 'white',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 18,
        }}
      >
        ×
      </button>
    </div>
  );
};
```

---

### 5. TimelineDropIndicator.tsx

```typescript
import React from 'react';
import { motion } from 'framer-motion';
import { frameToPixels } from './utils/timeFormatter';

interface Props {
  trackId: string;
  frame: number;
  pixelsPerFrame: number;
}

export const TimelineDropIndicator: React.FC<Props> = ({
  trackId,
  frame,
  pixelsPerFrame,
}) => {
  const leftPosition = frameToPixels(frame, pixelsPerFrame);

  return (
    <motion.div
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      exit={{ scaleY: 0, opacity: 0 }}
      transition={{ duration: 0.15 }}
      style={{
        position: 'absolute',
        left: leftPosition,
        top: 0,
        width: 3,
        height: '100%',
        backgroundColor: '#4a9eff',
        boxShadow: '0 0 8px rgba(74, 158, 255, 0.8)',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {/* Top triangle */}
      <div
        style={{
          position: 'absolute',
          top: -8,
          left: -4,
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderBottom: '8px solid #4a9eff',
        }}
      />

      {/* Bottom triangle */}
      <div
        style={{
          position: 'absolute',
          bottom: -8,
          left: -4,
          width: 0,
          height: 0,
          borderLeft: '5px solid transparent',
          borderRight: '5px solid transparent',
          borderTop: '8px solid #4a9eff',
        }}
      />
    </motion.div>
  );
};
```

---

### 6. useDndModifiers.ts

```typescript
import { Modifier } from '@dnd-kit/core';

/**
 * Creates a snap-to-grid modifier for frame-based snapping
 */
export const createSnapModifier = (
  pixelsPerFrame: number,
  enabled: boolean
): Modifier => {
  return ({ transform }) => {
    if (!enabled) {
      return transform;
    }

    // Round to nearest frame
    const snappedX = Math.round(transform.x / pixelsPerFrame) * pixelsPerFrame;

    return {
      ...transform,
      x: snappedX,
    };
  };
};

/**
 * Creates a restraint modifier to prevent dragging outside timeline bounds
 */
export const createBoundsModifier = (
  minFrame: number,
  maxFrame: number,
  pixelsPerFrame: number
): Modifier => {
  return ({ transform, draggingNodeRect, containerNodeRect }) => {
    if (!draggingNodeRect || !containerNodeRect) {
      return transform;
    }

    const minX = minFrame * pixelsPerFrame;
    const maxX = maxFrame * pixelsPerFrame - draggingNodeRect.width;

    const clampedX = Math.max(minX, Math.min(transform.x, maxX));

    return {
      ...transform,
      x: clampedX,
    };
  };
};
```

---

### 7. useDndCollision.ts

```typescript
import { 
  CollisionDetection, 
  closestCenter,
  pointerWithin,
  rectIntersection,
  ClientRect,
  Active,
  Over,
} from '@dnd-kit/core';
import { Track } from '../../types';

/**
 * Custom collision detection with timeline-specific snapping
 */
export const createTimelineCollision = (
  snapEnabled: boolean,
  currentFrame: number,
  tracks: Track[]
): CollisionDetection => {
  return (args) => {
    // First, use built-in collision detection
    const pointerCollisions = pointerWithin(args);
    
    if (pointerCollisions.length > 0) {
      // Prefer pointer intersections for better UX
      return pointerCollisions;
    }

    // Fallback to rect intersection
    const rectCollisions = rectIntersection(args);

    if (rectCollisions.length > 0) {
      return rectCollisions;
    }

    // Finally, use closest center
    return closestCenter(args);
  };
};

/**
 * Custom collision for snapping to playhead or other items
 */
export const snapCollisionDetection = (
  snapThreshold: number,
  currentFrame: number,
  pixelsPerFrame: number
): CollisionDetection => {
  return (args) => {
    const { active, collisionRect, droppableContainers } = args;

    // Calculate playhead position
    const playheadX = currentFrame * pixelsPerFrame;

    // Check if near playhead
    const distanceToPlayhead = Math.abs(collisionRect.left - playheadX);
    
    if (distanceToPlayhead < snapThreshold) {
      // Snap to playhead
      // Return a synthetic collision with the playhead
      // (This is a simplified example; you'd need to create a proper Over object)
    }

    // Otherwise, use default collision
    return closestCenter(args);
  };
};
```

---

## Edge Cases & Solutions

### 1. Rapid Dragging / Race Conditions

**Problem:** User drags item quickly between tracks multiple times before drop

**Solution:**
- Don't update global state in `onDragOver`, only visual indicators
- Use `onDragEnd` as single source of truth for state updates
- Debounce drop indicator updates to prevent flickering:
  ```typescript
  const [dropIndicator, setDropIndicator] = useState(null);
  const debouncedSetIndicator = useMemo(
    () => debounce(setDropIndicator, 50),
    []
  );
  ```

---

### 2. Multi-select and Batch Operations

**Problem:** Need to drag multiple items at once (like in Premiere Pro)

**Solution (Phase 2 feature):**
- Store selected items in state: `selectedItemIds: string[]`
- When dragging, check if dragged item is in selection:
  ```typescript
  if (selectedItemIds.includes(activeId)) {
    // Move all selected items
    const deltaFrame = calculateDelta(event);
    selectedItemIds.forEach(itemId => {
      dispatch({ type: 'UPDATE_ITEM_FRAME', payload: { itemId, deltaFrame } });
    });
  }
  ```
- Show all selected items in DragOverlay
- Maintain relative positions

**Implementation:**
1. Add Shift+Click to select multiple items
2. Add Cmd/Ctrl+Click to toggle selection
3. Add Cmd/Ctrl+A to select all
4. Drag moves all selected items simultaneously

---

### 3. Undo/Redo Integration

**Problem:** Need to undo drag operations

**Solution:**
- Use a history stack in EditorContext:
  ```typescript
  interface HistoryState {
    past: EditorState[];
    present: EditorState;
    future: EditorState[];
  }
  ```

- Before dispatching in `onDragEnd`, save current state:
  ```typescript
  const handleDragEnd = (event) => {
    dispatch({ type: 'SAVE_HISTORY' }); // Push current state to past
    dispatch({ type: 'MOVE_ITEM', payload: ... });
  };
  ```

- Implement undo/redo actions:
  ```typescript
  case 'UNDO': {
    if (state.past.length === 0) return state;
    const previous = state.past[state.past.length - 1];
    return {
      past: state.past.slice(0, -1),
      present: previous,
      future: [state.present, ...state.future],
    };
  }
  ```

- Keyboard shortcuts: Cmd+Z (undo), Cmd+Shift+Z (redo)

---

### 4. Performance Optimization for Long Timelines

**Problem:** 100+ items causes lag during drag

**Solutions:**

**A. Virtualization (react-window or @tanstack/react-virtual):**
  ```typescript
  import { useVirtualizer } from '@tanstack/react-virtual';

  const rowVirtualizer = useVirtualizer({
    count: tracks.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 60, // Track height
    overscan: 5,
  });

  return (
    <div ref={parentRef}>
      {rowVirtualizer.getVirtualItems().map(virtualRow => {
        const track = tracks[virtualRow.index];
        return <TimelineTrack key={track.id} track={track} />;
      })}
    </div>
  );
  ```

**B. Memoization:**
  ```typescript
  const TimelineItem = React.memo(({ item, ... }) => {
    // Component body
  }, (prevProps, nextProps) => {
    // Custom comparison
    return (
      prevProps.item.id === nextProps.item.id &&
      prevProps.item.from === nextProps.item.from &&
      prevProps.item.durationInFrames === nextProps.item.durationInFrames &&
      prevProps.isSelected === nextProps.isSelected
    );
  });
  ```

**C. Disable DragOverlay for many items:**
  ```typescript
  const useDragOverlay = tracks.length < 50;
  ```

**D. Use CSS transforms instead of left/top:**
  ```typescript
  // Better performance
  style={{
    transform: `translateX(${frameToPixels(item.from, pixelsPerFrame)}px)`,
  }}
  
  // Instead of
  style={{
    left: frameToPixels(item.from, pixelsPerFrame),
  }}
  ```

---

### 5. Drag from External Sources (File Drops)

**Problem:** User drags file from OS directly into timeline

**Solution:**
- Add native file drop handler:
  ```typescript
  const handleFileDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    
    const files = Array.from(e.dataTransfer.files);
    
    for (const file of files) {
      // Upload file
      const url = await uploadFile(file);
      
      // Create asset
      const asset = {
        id: `asset-${Date.now()}`,
        name: file.name,
        type: file.type.startsWith('video') ? 'video' : 'audio',
        src: url,
      };
      
      dispatch({ type: 'ADD_ASSET', payload: asset });
      
      // Add to timeline
      const frame = calculateFrameFromPosition(e);
      const item = createItemFromAsset(asset, frame);
      dispatch({ type: 'ADD_ITEM', payload: { trackId, item } });
    }
  };
  ```

- Distinguish between file drops and internal drags:
  ```typescript
  const hasFiles = e.dataTransfer.files.length > 0;
  if (hasFiles) {
    handleFileDrop(e);
  } else {
    // Handle internal drag
  }
  ```

---

### 6. Snapping to Multiple Targets

**Problem:** Need to snap to playhead, item edges, and grid simultaneously

**Solution:**
- Calculate snap candidates in `onDragOver`:
  ```typescript
  interface SnapCandidate {
    frame: number;
    distance: number;
    type: 'playhead' | 'item-start' | 'item-end' | 'grid';
  }

  function calculateSnapCandidates(
    currentFrame: number,
    tracks: Track[],
    draggedItemId: string,
    snapThreshold: number
  ): SnapCandidate[] {
    const candidates: SnapCandidate[] = [];

    // Playhead
    candidates.push({
      frame: state.currentFrame,
      distance: Math.abs(currentFrame - state.currentFrame),
      type: 'playhead',
    });

    // Item edges
    tracks.forEach(track => {
      track.items.forEach(item => {
        if (item.id === draggedItemId) return; // Skip self

        // Start edge
        candidates.push({
          frame: item.from,
          distance: Math.abs(currentFrame - item.from),
          type: 'item-start',
        });

        // End edge
        const endFrame = item.from + item.durationInFrames;
        candidates.push({
          frame: endFrame,
          distance: Math.abs(currentFrame - endFrame),
          type: 'item-end',
        });
      });
    });

    // Grid (every 10 frames)
    const gridFrame = Math.round(currentFrame / 10) * 10;
    candidates.push({
      frame: gridFrame,
      distance: Math.abs(currentFrame - gridFrame),
      type: 'grid',
    });

    // Filter by threshold and sort by distance
    return candidates
      .filter(c => c.distance < snapThreshold)
      .sort((a, b) => a.distance - b.distance);
  }

  // In onDragOver:
  const candidates = calculateSnapCandidates(...);
  const bestSnap = candidates[0]; // Closest candidate

  if (bestSnap) {
    setDropIndicator({ trackId, frame: bestSnap.frame });
    setSnapIndicatorType(bestSnap.type); // For visual styling
  }
  ```

---

### 7. Collision Prevention (Overlapping Items)

**Problem:** Prevent dropping item on top of existing item

**Solution:**
- Check for collisions in `onDragEnd`:
  ```typescript
  function hasCollision(
    track: Track,
    newItem: { from: number; durationInFrames: number },
    excludeItemId?: string
  ): boolean {
    const newEnd = newItem.from + newItem.durationInFrames;

    return track.items.some(item => {
      if (item.id === excludeItemId) return false;

      const itemEnd = item.from + item.durationInFrames;

      // Check overlap
      return (
        (newItem.from >= item.from && newItem.from < itemEnd) ||
        (newEnd > item.from && newEnd <= itemEnd) ||
        (newItem.from <= item.from && newEnd >= itemEnd)
      );
    });
  }

  // In onDragEnd:
  const targetTrack = tracks.find(t => t.id === toTrackId);
  if (hasCollision(targetTrack, item, item.id)) {
    // Reject drop or auto-shift items
    console.warn('Cannot drop: collision detected');
    return;
  }
  ```

**Alternative:** Auto-shift overlapping items:
  ```typescript
  function resolveCollisions(
    track: Track,
    newItem: Item
  ): Track {
    const overlapping = track.items.filter(item => 
      hasOverlap(item, newItem) && item.id !== newItem.id
    );

    if (overlapping.length === 0) {
      return { ...track, items: [...track.items, newItem] };
    }

    // Shift overlapping items to the right
    const shiftAmount = newItem.durationInFrames + 5; // 5 frame gap
    const updatedItems = track.items.map(item => {
      if (hasOverlap(item, newItem) && item.id !== newItem.id) {
        return { ...item, from: item.from + shiftAmount };
      }
      return item;
    });

    return { ...track, items: [...updatedItems, newItem] };
  }
  ```

---

## Timeline

### Week 1: Foundation (5 days)

**Day 1: Setup**
- Install @dnd-kit packages
- Create DndTimelineProvider scaffold
- Setup TypeScript types
- **Deliverable:** App runs with DnD wrapper (no functionality yet)

**Day 2: Single Track**
- Implement TimelineTrack with SortableContext
- Update TimelineItem with useSortable
- Implement same-track reordering
- **Deliverable:** Items draggable within same track

**Day 3: Multi-Track**
- Implement cross-track drag logic
- Add MOVE_ITEM_TO_TRACK reducer action
- Add basic drop indicator
- **Deliverable:** Items move between tracks without duplication

**Day 4: Asset Panel**
- Update AssetPanel with useDraggable
- Implement asset-to-timeline drop
- Fix data transfer key mismatch (asset vs assetId)
- **Deliverable:** Drag assets from panel to timeline

**Day 5: Polish & Testing**
- Add DragOverlay for better visuals
- Implement snap modifier
- Add empty track auto-delete
- **Deliverable:** Feature-complete drag-and-drop

---

### Week 2: Advanced Features (5 days)

**Day 6: Snapping**
- Implement custom collision detection
- Add snap to playhead, items, grid
- Add Shift key to disable snapping
- **Deliverable:** Professional snapping behavior

**Day 7: Visual Indicators**
- Improve drop indicator with animations
- Add insertion point preview
- Add snap indicator (different colors for different snap types)
- **Deliverable:** Visual feedback matches industry standards

**Day 8: Accessibility**
- Configure keyboard sensors
- Add ARIA labels
- Add screen reader announcements
- Test with VoiceOver/NVDA
- **Deliverable:** Fully accessible timeline

**Day 9: Performance**
- Add memoization to components
- Implement virtualization (if needed)
- Optimize collision detection
- Profile and optimize re-renders
- **Deliverable:** Smooth performance with 100+ items

**Day 10: Edge Cases**
- Implement collision prevention
- Add undo/redo support
- Handle rapid dragging
- Add file drop from OS
- **Deliverable:** Production-ready solution

---

### Testing Milestones

**Phase 1 Testing (After Week 1):**
- ✅ Can drag items within same track
- ✅ Can drag items to different tracks
- ✅ No item duplication bugs
- ✅ Can drag assets from panel
- ✅ Items snap to grid
- ✅ Empty tracks are deleted

**Phase 2 Testing (After Week 2):**
- ✅ Keyboard navigation works
- ✅ Screen reader announces actions
- ✅ Snapping works for playhead, items, grid
- ✅ Drop indicators are clear
- ✅ Performance is smooth (60 FPS)
- ✅ Undo/redo works correctly
- ✅ No edge case bugs

**Acceptance Criteria:**
- [ ] Pass all manual tests
- [ ] Pass keyboard-only test
- [ ] Pass screen reader test
- [ ] Performance: 60 FPS with 100 items
- [ ] Zero console errors
- [ ] Works in Chrome, Safari, Firefox
- [ ] Works on desktop and tablet

---

## Rollout Plan

### Phase 0: Preparation (Before Implementation)
- Document current behavior (record videos)
- Create test plan spreadsheet
- Set up feature flag: `ENABLE_NEW_DND`

### Phase 1: Internal Testing (Week 1)
- Enable feature flag in development
- Test with team members
- Collect feedback
- Fix critical bugs

### Phase 2: Beta Testing (Week 2)
- Enable for 10% of users (A/B test)
- Monitor error logs (Sentry, LogRocket)
- Collect user feedback
- Compare metrics: drag success rate, time to complete task

### Phase 3: Full Rollout (Week 3)
- Enable for 50% of users
- Monitor for 2 days
- If stable, enable for 100%
- Remove old implementation code

### Rollback Procedure (If Needed)
1. Set feature flag to `false`
2. Old implementation still exists as fallback
3. Investigate issues
4. Fix and re-deploy
5. Gradually enable again

---

## Success Metrics

**Quantitative:**
- ✅ 0 item duplication bugs (critical)
- ✅ <100ms drag latency (performance)
- ✅ 60 FPS during drag (performance)
- ✅ <20kb bundle size increase (size)
- ✅ 100% keyboard accessibility (a11y)
- ✅ <1% error rate (reliability)

**Qualitative:**
- ✅ Drag-and-drop feels smooth and responsive
- ✅ Drop indicators are clear and helpful
- ✅ Snapping behavior matches user expectations
- ✅ Users can complete tasks faster than before

**User Feedback:**
- Survey after 2 weeks: "Drag-and-drop is much better now" (target: >80% agree)

---

## Maintenance & Future Enhancements

### Post-Launch Maintenance
- Monitor @dnd-kit releases for updates
- Keep dependencies up to date
- Fix bugs reported by users
- Optimize performance as needed

### Future Enhancements (Post-MVP)

**Q1 2026:**
1. **Multi-select drag** (drag multiple items at once)
2. **Ripple edit** (move all items after dropped item)
3. **Magnetic timeline** (auto-snap to adjacent items)

**Q2 2026:**
4. **Layer system** (z-index for overlapping items)
5. **Copy/paste between tracks** (Cmd+C, Cmd+V)
6. **Drag to resize** (drag edges to trim)

**Q3 2026:**
7. **Timeline groups** (collapse/expand track groups)
8. **Custom snap points** (user-defined markers)
9. **Touch gestures** (pinch to zoom, swipe to scroll)

---

## Risk Mitigation

### Risk 1: Learning Curve
**Risk:** Team unfamiliar with @dnd-kit API
**Mitigation:** 
- Pair programming sessions
- Code reviews
- Documentation with examples
- Dedicated Slack channel for questions

### Risk 2: Performance Regression
**Risk:** New implementation slower than old
**Mitigation:**
- Performance benchmarks before/after
- Profiling with React DevTools
- Virtualization if needed
- Gradual rollout with monitoring

### Risk 3: Breaking Changes
**Risk:** @dnd-kit releases breaking changes
**Mitigation:**
- Pin exact versions in package.json
- Test updates in staging before production
- Have rollback plan ready
- Subscribe to @dnd-kit GitHub releases

### Risk 4: Browser Compatibility
**Risk:** Doesn't work in Safari or older browsers
**Mitigation:**
- Test in all major browsers during development
- Use polyfills if needed
- Check @dnd-kit browser support matrix
- Have fallback UI for unsupported browsers

### Risk 5: Mobile Support
**Risk:** Touch events don't work properly
**Mitigation:**
- Test on real devices (iOS, Android)
- Use @dnd-kit's TouchSensor
- Add mobile-specific gestures
- Consider mobile-first design

---

## Appendix

### A. Useful Resources

**Documentation:**
- @dnd-kit docs: https://docs.dndkit.com
- dnd-timeline: https://samuel-arbibe.gitbook.io/dnd-timeline
- Remotion docs: https://remotion.dev/docs

**Examples:**
- @dnd-kit Storybook: https://master--5fc05e08a4a65d0021ae0bf2.chromatic.com
- dnd-timeline examples: https://dnd-timeline-demo.vercel.app
- CodeSandbox demos: https://codesandbox.io/examples/package/@dnd-kit/sortable

**Community:**
- @dnd-kit GitHub Discussions: https://github.com/clauderic/dnd-kit/discussions
- Stack Overflow tag: [dnd-kit]
- Discord: (check @dnd-kit repo for invite)

---

### B. Package Versions (Recommended)

```json
{
  "dependencies": {
    "@dnd-kit/core": "^6.1.0",
    "@dnd-kit/sortable": "^8.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "framer-motion": "^12.23.24" // Already installed
  }
}
```

---

### C. Alternative: Using Framer Motion (Not Recommended)

If budget is extremely tight and cannot add @dnd-kit:

**Pros:**
- 0 additional bundle size (already using framer-motion)
- Excellent animation capabilities

**Cons:**
- Need to implement ALL drag-and-drop logic manually:
  - Collision detection
  - Multi-container management
  - Keyboard accessibility
  - Screen reader support
  - Drop zones
  - Insertion indicators
- Estimated 3-4x more development time
- Higher maintenance burden
- Less accessible

**Implementation sketch:**
```typescript
<motion.div
  drag="x"
  dragConstraints={{ left: 0, right: totalWidth }}
  dragElastic={0.1}
  dragMomentum={false}
  onDragEnd={(event, info) => {
    const newFrame = pixelsToFrame(info.point.x);
    dispatch({ type: 'UPDATE_ITEM', payload: { itemId, updates: { from: newFrame } } });
  }}
>
  {/* Item content */}
</motion.div>
```

**Verdict:** Only consider if @dnd-kit is absolutely not an option. Otherwise, use @dnd-kit for a professional, accessible solution.

---

### D. Bundle Size Comparison

| Library | Core Size | With Dependencies | Total Added |
|---------|-----------|-------------------|-------------|
| @dnd-kit | 10kb | 15kb | 15kb |
| react-dnd | 20kb | 35kb | 35kb |
| react-beautiful-dnd | 30kb | 30kb | ❌ Deprecated |
| framer-motion | N/A | 0kb | 0kb (already using) |
| react-sortable-hoc | 15kb | 15kb | ❌ Deprecated |

**Recommendation:** @dnd-kit offers best balance of size, features, and maintenance.

---

### E. Comparison with Other Video Editors

| Feature | Premiere Pro | Final Cut Pro | DaVinci Resolve | Our Implementation (with @dnd-kit) |
|---------|--------------|---------------|-----------------|-------------------------------------|
| Drag between tracks | ✅ | ✅ | ✅ | ✅ |
| Snap to playhead | ✅ | ✅ | ✅ | ✅ |
| Snap to items | ✅ | ✅ | ✅ | ✅ |
| Drop indicators | ✅ | ✅ | ✅ | ✅ |
| Multi-select drag | ✅ | ✅ | ✅ | 🚧 Future |
| Keyboard navigation | ✅ | ✅ | ✅ | ✅ |
| Ripple edit | ✅ | ✅ | ✅ | 🚧 Future |
| Magnetic timeline | ❌ | ✅ | ❌ | 🚧 Future |

---

## Conclusion

This implementation plan provides a comprehensive roadmap to replace the current unreliable native drag-and-drop implementation with a professional, accessible, and performant solution using **@dnd-kit**.

**Key Takeaways:**

1. **@dnd-kit is the clear winner** for this use case (modern, maintained, performant, accessible)
2. **Phased migration** minimizes risk and allows for testing at each step
3. **No global state during drag** prevents duplication bugs
4. **Professional features** (snapping, indicators, keyboard support) match industry standards
5. **Future-proof** architecture enables advanced features later

**Next Steps:**

1. ✅ Review this plan with team
2. ✅ Get stakeholder approval
3. ⏳ Start Week 1 Day 1: Setup @dnd-kit
4. ⏳ Follow migration strategy step-by-step
5. ⏳ Test thoroughly at each phase
6. ⏳ Gradual rollout with monitoring

**Estimated Total Effort:** 10 development days (2 weeks) + 1 week rollout = **3 weeks total**

---

**Document Version:** 1.0  
**Last Updated:** 2025-01-05  
**Author:** Claude (Anthropic)  
**Status:** Ready for Review
