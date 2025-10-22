# Remotion Video Editor

A feature-rich video editor built with Remotion, inspired by the Remotion Editor Starter (but fully open source!).

## Features

- **Timeline Editor**: Multi-track timeline with drag-and-drop support
- **Visual Preview**: Real-time video preview using Remotion Player
- **Asset Management**: Upload and manage video, audio, and image assets
- **Text Editor**: Add and customize text overlays with full control
- **Properties Panel**: Edit item properties including timing, colors, fonts, and more
- **Multiple Item Types**: Support for text, solid colors, videos, images, and audio
- **Zoom Control**: Timeline zoom for precise editing
- **Playback Controls**: Play, pause, and scrub through your video

## Getting Started

### Installation

```bash
npm install
```

### Development

Run the Remotion Studio:

```bash
npm run dev
```

This will open the Remotion Studio where you can preview and edit your video compositions.

### Building Videos

Render a video:

```bash
npm run build <composition-id>
```

## Project Structure

```
src/
├── types/              # TypeScript type definitions
├── state/              # State management (Context + Reducer)
├── editor/             # Editor UI components
│   ├── PreviewCanvas.tsx
│   ├── Timeline.tsx
│   ├── AssetPanel.tsx
│   └── PropertiesPanel.tsx
├── remotion/           # Remotion video components
│   └── VideoComposition.tsx
├── Editor.tsx          # Main editor layout
├── Root.tsx            # Remotion root configuration
└── index.tsx           # Entry point
```

## How It Works

### Architecture

1. **State Management**: Uses React Context + useReducer for centralized state
2. **Remotion Player**: Renders the video preview in real-time
3. **Timeline**: Visual representation of tracks and items
4. **Drag & Drop**: Move items between tracks and adjust timing

### Adding Content

1. **Text**: Click "+ Text" in the Assets panel
2. **Colors**: Click "+ Color" to add solid color backgrounds
3. **Media**: Upload images, videos, or audio files
4. **Edit**: Select items to edit properties in the Properties panel

### Timeline Controls

- **Zoom**: Use +/- buttons to zoom in/out
- **Playhead**: Click timeline to jump to a specific frame
- **Drag Items**: Drag items to reposition them on the timeline
- **Tracks**: Add multiple tracks for layering content

## Technologies

- **Remotion**: Programmatic video creation framework
- **React**: UI framework
- **TypeScript**: Type safety
- **@remotion/player**: Video preview component

## License

MIT License - Free to use and modify
