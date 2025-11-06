# Remotion-Fast Architecture Documentation

Complete architectural documentation for the remotion-fast video editor library.

## Documents in This Suite

### 1. **ARCHITECTURE_SUMMARY.md** - START HERE
**Best for**: Getting oriented quickly, understanding the big picture
- What is Remotion-Fast?
- The three packages explained
- Core concepts (EditorState, Item Types, Actions)
- Component architecture overview
- Five essential data flows
- Technology stack and limitations

**Time to read**: 10-15 minutes

### 2. **ARCHITECTURE.md** - DEEP DIVE
**Best for**: Comprehensive understanding, implementation details
- Detailed package structure
- Complete type definitions
- State management patterns
- Component hierarchy and responsibilities
- Timeline utilities (formatter, snap calculator)
- Design system and styling
- Remotion integration details
- Full data flow examples
- Architecture patterns and decisions
- Extension points for future features

**Time to read**: 40-50 minutes

### 3. **ARCHITECTURE_QUICK_REFERENCE.md** - HANDY REFERENCE
**Best for**: Quick lookup while developing
- File structure with descriptions
- Type definition cheat sheet
- useEditor() hook usage patterns
- All 16 reducer actions in table format
- Component props reference
- Pixel/frame conversion formulas
- Snap calculation guide
- Keyboard shortcut mapping
- Drag & drop flow
- Global variables used
- Testing checklist
- Common bugs and solutions
- Performance tips
- Extension points with steps

**Time to read**: 5 minutes (lookup as needed)

## Reading Path by Role

### Product Manager / Non-Technical
1. Read: **ARCHITECTURE_SUMMARY.md** sections:
   - "What is Remotion-Fast?"
   - "The Three Packages"
   - "Key Features"
   - "Architecture Strengths"

### Frontend Developer (New to Codebase)
1. Read: **ARCHITECTURE_SUMMARY.md** (full)
2. Skim: **ARCHITECTURE.md** sections 1-3
3. Keep: **ARCHITECTURE_QUICK_REFERENCE.md** open while coding

### Full-Stack Developer (Building Features)
1. Read: **ARCHITECTURE_SUMMARY.md** (full)
2. Read: **ARCHITECTURE.md** (full)
3. Reference: **ARCHITECTURE_QUICK_REFERENCE.md** as needed
4. Study: Data flow examples in ARCHITECTURE.md section 9

### DevOps / Infrastructure
1. Read: **ARCHITECTURE_SUMMARY.md** section "Technology Stack"
2. Read: **ARCHITECTURE.md** section 8 "Configuration Files"
3. Reference: Build commands in each package.json

## Key Takeaways

### State Management
- Single `EditorState` object holds all data
- Changes via `dispatch(action)` - no direct mutations
- Reducer function handles all state transitions
- Context pattern provides `useEditor()` hook everywhere

### Package Organization
- **@remotion-fast/core**: State machine + types
- **@remotion-fast/ui**: React components + timeline
- **@remotion-fast/remotion-components**: Video rendering

### Data Flow
1. User interacts with UI
2. Component handler calls `dispatch(action)`
3. Reducer creates new state
4. Context notifies subscribers
5. Components re-render with new state
6. UI and preview update

### Component Hierarchy
- **Editor**: Root wrapper
- **AssetPanel**: Media upload and library
- **PreviewCanvas**: Remotion video player
- **PropertiesPanel**: Edit selected items
- **Timeline**: Complete timeline editor with sub-components

## Common Workflows

### To Add a New Feature
1. Define action type in `EditorAction` union
2. Add reducer case in `editorReducer` function
3. Add UI handler that calls `dispatch(action)`
4. Update affected components
5. Test state changes propagate correctly

### To Debug State Issues
1. Check the action being dispatched
2. Verify reducer case is handling it correctly
3. Confirm new state is immutable (no mutations)
4. Trace component re-renders

### To Understand a User Flow
1. Find the UI handler (onClick, onChange, etc.)
2. See what action it dispatches
3. Follow the reducer logic
4. See which components depend on that state

### To Optimize Performance
1. Memoize callbacks with useCallback
2. Use React.memo for expensive components
3. Consider virtualizing long lists
4. Check useKeyboardShortcuts is scoped properly

## Important Files

### Must Read
- `/packages/core/src/types/index.ts` - All type definitions
- `/packages/core/src/state/EditorContext.tsx` - State management
- `/packages/ui/src/components/Editor.tsx` - Layout
- `/packages/ui/src/components/Timeline.tsx` - Main logic

### Reference During Development
- `/packages/ui/src/components/timeline/styles.ts` - Design tokens
- `/packages/ui/src/components/timeline/utils/timeFormatter.ts` - Conversion functions
- `/packages/ui/src/components/timeline/utils/snapCalculator.ts` - Snap logic
- `/packages/remotion-components/src/VideoComposition.tsx` - Rendering

### Configuration
- `/packages/core/tsconfig.json` - TypeScript settings
- `/examples/basic-editor/vite.config.ts` - Dev server config

## Terminology

| Term | Meaning |
|------|---------|
| **Track** | A horizontal lane in the timeline containing items |
| **Item** | An element on a track (video, audio, text, solid, image) |
| **Asset** | A media file in the library (video, audio, image) |
| **EditorState** | Complete application state |
| **EditorAction** | Instructions to change state |
| **Reducer** | Function that applies actions to state |
| **Dispatch** | Function to trigger an action |
| **Context** | React API for sharing state globally |
| **Snap** | Magnetic alignment to grid or other items |
| **Playhead** | Red line showing current position |
| **Zoom** | Timeline scale level |
| **Frame** | Smallest unit of time (1/fps seconds) |

## Quick Links

- **Package Exports**: Each package's `src/index.ts`
- **State Actions**: `packages/core/src/types/index.ts` (EditorAction type)
- **Design Tokens**: `packages/ui/src/components/timeline/styles.ts`
- **Example App**: `examples/basic-editor/src/main.tsx`

## Helpful Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start dev server (example app)
pnpm dev

# Build specific package
pnpm --filter @remotion-fast/core build

# Watch specific package
pnpm --filter @remotion-fast/ui dev
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        BROWSER                          │
├─────────────────────────────────────────────────────────┤
│                   Editor (React App)                    │
│  ┌─────────────────────────────────────────────────────┐│
│  │            EditorProvider (State)                   ││
│  │  ┌──────────────────────────────────────────────┐   ││
│  │  │         EditorState + editorReducer          │   ││
│  │  │  (Single source of truth)                     │   ││
│  │  └──────────────────────────────────────────────┘   ││
│  │                      ▲                               ││
│  │  Dispatch Actions   │   Context Updates             ││
│  │                      ▼                               ││
│  │  ┌──────────────────────────────────────────────┐   ││
│  │  │         UI Components (React)                │   ││
│  │  │  • AssetPanel                                │   ││
│  │  │  • PreviewCanvas → Remotion Player           │   ││
│  │  │  • PropertiesPanel                           │   ││
│  │  │  • Timeline (+ 7 sub-components)             │   ││
│  │  └──────────────────────────────────────────────┘   ││
│  └─────────────────────────────────────────────────────┘│
│                                                         │
│  ┌─────────────────────────────────────────────────────┐│
│  │  VideoComposition (Remotion)                        ││
│  │  Receives: tracks (from EditorState)                ││
│  │  Renders: Video composition                         ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌──────────────────────┐
              │  MP4/WebM Video File │
              │  (via Remotion CLI)  │
              └──────────────────────┘
```

---

**How to use this documentation:**

1. **First time?** Start with ARCHITECTURE_SUMMARY.md
2. **Need details?** Go to ARCHITECTURE.md
3. **Coding?** Keep ARCHITECTURE_QUICK_REFERENCE.md open
4. **Questions?** Search this document for keywords

**Feedback**: These docs reflect the current codebase. Update them if the code changes significantly.

