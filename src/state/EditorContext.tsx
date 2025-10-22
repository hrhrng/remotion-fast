import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import type { EditorState, EditorAction, Track, Item, Asset } from '../types';

// Initial state
const initialState: EditorState = {
  tracks: [
    { id: 'track-1', name: 'Track 1', items: [] },
    { id: 'track-2', name: 'Track 2', items: [] },
  ],
  selectedItemId: null,
  selectedTrackId: null,
  currentFrame: 0,
  playing: false,
  zoom: 1,
  assets: [],
  compositionWidth: 1920,
  compositionHeight: 1080,
  fps: 30,
  durationInFrames: 600, // 20 seconds at 30fps
};

// Reducer function
function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'ADD_TRACK':
      return {
        ...state,
        tracks: [...state.tracks, action.payload],
      };

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

    case 'REMOVE_ITEM':
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.trackId
            ? { ...t, items: t.items.filter((i) => i.id !== action.payload.itemId) }
            : t
        ),
        selectedItemId: state.selectedItemId === action.payload.itemId ? null : state.selectedItemId,
      };

    case 'UPDATE_ITEM':
      return {
        ...state,
        tracks: state.tracks.map((t) =>
          t.id === action.payload.trackId
            ? {
                ...t,
                items: t.items.map((i) =>
                  i.id === action.payload.itemId ? { ...i, ...action.payload.updates } : i
                ),
              }
            : t
        ),
      };

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
