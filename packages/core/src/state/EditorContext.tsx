import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { EditorState, EditorAction, Track, Item, Asset } from '../types';

// Initial state
const initialState: EditorState = {
  tracks: [],
  selectedItemId: null,
  selectedTrackId: null,
  currentFrame: 0,
  playing: false,
  zoom: 1,
  assets: [],
  compositionWidth: 1920,
  compositionHeight: 1080,
  fps: 30,
  durationInFrames: 1500, // 50 seconds at 30fps
};

// Reducer function
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'ADD_TRACK':
      return {
        ...state,
        tracks: [...state.tracks, action.payload],
      };

    case 'INSERT_TRACK': {
      console.log('INSERT_TRACK reducer called with:', action.payload);
      const newTracks = [...state.tracks];
      const { track, index } = action.payload;

      // Insert at specific index
      newTracks.splice(index, 0, track);

      console.log('New tracks after insertion:', newTracks);

      return {
        ...state,
        tracks: newTracks,
      };
    }

    case 'REMOVE_TRACK':
      return {
        ...state,
        tracks: state.tracks.filter((t) => t.id !== action.payload),
        selectedTrackId: state.selectedTrackId === action.payload ? null : state.selectedTrackId,
      };

    case 'UPDATE_TRACK':
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.id ? { ...t, ...action.payload.updates } : t
        ),
      };

    case 'REORDER_TRACKS':
      return {
        ...state,
        tracks: action.payload,
      };

    case 'ADD_ITEM':
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.trackId
            ? { ...t, items: [...t.items, action.payload.item] }
            : t
        ),
      };

    case 'REMOVE_ITEM': {
      // Remove the item first
      const tracksAfterRemoval = state.tracks.map((t) =>
        t.id === action.payload.trackId
          ? { ...t, items: t.items.filter((i) => i.id !== action.payload.itemId) }
          : t
      );

      // Auto-delete empty tracks
      const finalTracks = tracksAfterRemoval.filter((t) => t.items.length > 0);

      return {
        ...state,
        tracks: finalTracks,
        selectedItemId: state.selectedItemId === action.payload.itemId ? null : state.selectedItemId,
      };
    }

    case 'UPDATE_ITEM':
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.trackId
            ? {
                ...t,
                items: t.items.map((i) =>
                  i.id === action.payload.itemId ? ({ ...i, ...action.payload.updates } as Item) : i
                ),
              }
            : t
        ),
      };

    case 'SPLIT_ITEM': {
      const { trackId, itemId, splitFrame } = action.payload;

      return {
        ...state,
        tracks: state.tracks.map((t) => {
          if (t.id !== trackId) return t;

          const newItems = t.items.flatMap((item) => {
            if (item.id !== itemId) return [item];

            // Check if split frame is within item bounds
            const itemEnd = item.from + item.durationInFrames;
            if (splitFrame <= item.from || splitFrame >= itemEnd) {
              // Split frame is not within item bounds, keep original
              return [item];
            }

            // Calculate durations for split items
            const firstDuration = splitFrame - item.from;
            const secondDuration = itemEnd - splitFrame;

            // Determine in-source offset (for media items); default to 0
            const currentOffset =
              (item as any).sourceStartInFrames ? (item as any).sourceStartInFrames as number : 0;
            const offsetIncrement = firstDuration; // frames consumed by the first piece

            // Create first part (keeps original id)
            const firstItem: Item = {
              ...item,
              durationInFrames: firstDuration,
              // Preserve existing in-source offset for media
              ...(item.type === 'video' || item.type === 'audio'
                ? { sourceStartInFrames: currentOffset }
                : {}),
            };

            // Create second part (new id)
            const secondItem: Item = {
              ...item,
              id: `${item.id}-split-${Date.now()}`,
              from: splitFrame,
              durationInFrames: secondDuration,
              // Second piece starts later in the source
              ...(item.type === 'video' || item.type === 'audio'
                ? { sourceStartInFrames: currentOffset + offsetIncrement }
                : {}),
            };

            // Debug: log split details for verification
            try {
              console.log('[SPLIT_ITEM] split', {
                trackId,
                itemId: item.id,
                splitFrame,
                itemFrom: item.from,
                itemDuration: item.durationInFrames,
                first: {
                  id: firstItem.id,
                  from: (firstItem as any).from,
                  duration: firstItem.durationInFrames,
                  sourceStartInFrames: (firstItem as any).sourceStartInFrames || 0,
                },
                second: {
                  id: secondItem.id,
                  from: (secondItem as any).from,
                  duration: secondItem.durationInFrames,
                  sourceStartInFrames: (secondItem as any).sourceStartInFrames || 0,
                },
              });
            } catch {}

            return [firstItem, secondItem];
          });

          return { ...t, items: newItems };
        }),
      };
    }

    case 'SELECT_ITEM':
      return { ...state, selectedItemId: action.payload };

    case 'SELECT_TRACK':
      return { ...state, selectedTrackId: action.payload };

    case 'SET_CURRENT_FRAME':
      return { ...state, currentFrame: action.payload };

    case 'SET_PLAYING':
      return { ...state, playing: action.payload };

    case 'SET_ZOOM':
      return { ...state, zoom: action.payload };

    case 'ADD_ASSET':
      return {
        ...state,
        assets: [...state.assets, action.payload],
      };

    case 'REMOVE_ASSET':
      return {
        ...state,
        assets: state.assets.filter((a) => a.id !== action.payload),
      };

    case 'SET_COMPOSITION_SIZE':
      return {
        ...state,
        compositionWidth: action.payload.width,
        compositionHeight: action.payload.height,
      };

    case 'SET_DURATION':
      return { ...state, durationInFrames: action.payload };

    default:
      return state;
  }
}

// Context
type EditorContextType = {
  state: EditorState;
  dispatch: React.Dispatch<EditorAction>;
};

const EditorContext = createContext<EditorContextType | undefined>(undefined);

// Provider
export function EditorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(editorReducer, initialState);

  return (
    <EditorContext.Provider value={{ state, dispatch }}>
      {children}
    </EditorContext.Provider>
  );
}

// Hook
export function useEditor() {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within EditorProvider');
  }
  return context;
}
