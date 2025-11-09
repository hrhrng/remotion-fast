# Remotion Fast

A powerful Remotion-based video editor component library built with React and TypeScript.

## 🚀 Features

- **Multi-track Timeline Editor** - Intuitive drag-and-drop timeline with zoom controls
- **Real-time Preview** - Live video preview using Remotion Player
- **Asset Management** - Upload and manage video, audio, and image assets
- **Rich Text Support** - Add and customize text overlays with full styling control
- **Multiple Item Types** - Support for text, solid colors, videos, images, and audio
- **Modular Architecture** - Three separate packages for maximum flexibility

## 📦 Packages

This monorepo contains three packages:

### `@remotion-fast/core`
Core state management, types, and utilities. Framework-agnostic logic for building video editors.

```bash
npm install @remotion-fast/core
```

### `@remotion-fast/ui`
React UI components for the video editor interface (Timeline, AssetPanel, PreviewCanvas, etc.).

```bash
npm install @remotion-fast/ui
```

### `@remotion-fast/remotion-components`
Remotion rendering components for video composition and export.

```bash
npm install @remotion-fast/remotion-components
```

## 🏗️ Getting Started

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd remotion-fast

# Install dependencies
npm install

# Build all packages
npm run build
```

### Run the Example

```bash
# Run the basic editor example
npm run dev
```

This will start the editor at http://localhost:3001

### Using in Your Project

```tsx
import React from 'react';
import { Editor, EditorProvider } from '@remotion-fast/ui';

function App() {
  return (
    <EditorProvider>
      <Editor />
    </EditorProvider>
  );
}
```

For Remotion rendering:

```tsx
import { Composition } from 'remotion';
import { VideoComposition } from '@remotion-fast/remotion-components';

export const RemotionRoot = () => {
  return (
    <Composition
      id="MyVideo"
      component={VideoComposition}
      durationInFrames={600}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ tracks: [...] }}
    />
  );
};
```

## 📚 Documentation

### Core Concepts

- **Tracks**: Layers in your video composition
- **Items**: Elements on tracks (text, video, audio, images, solids)
- **Assets**: Media files uploaded to the editor
- **State Management**: Centralized state using React Context + Reducer

### Project Structure

```
remotion-fast/
├── packages/
│   ├── core/                    # State management & types
│   ├── ui/                      # React UI components
│   └── remotion-components/     # Remotion rendering
└── examples/
    └── basic-editor/            # Example implementation
```

## 🛠️ Development

### Quick Commands (using Makefile)

```bash
# Start hot-reload dev server
make dev

# Restart dev server (kills and restarts)
make restart

# Stop all dev servers
make kill

# Build all packages
make build

# Run type check
make typecheck

# Verify (typecheck + build)
make verify

# Show all available commands
make help
```

### Using pnpm directly

```bash
# Start development server
pnpm run dev

# Build all packages
pnpm run build

# Type check all packages
pnpm run typecheck

# Clean all build artifacts
pnpm run clean
```

### Development Workflow

1. Start dev server: `make dev`
2. Edit code in `packages/*/src`
3. Changes auto-compile and hot-reload
4. Hard refresh browser if needed: `Cmd+Shift+R`
5. Before committing: `make verify`

**Troubleshooting**: If hot-reload isn't working, try `make restart`

See [DEVELOPMENT.md](./DEVELOPMENT.md) for detailed development guide.

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
