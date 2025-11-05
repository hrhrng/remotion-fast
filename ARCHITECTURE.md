# Remotion Fast 架构说明

## 🎯 项目概述

**Remotion Fast** 是一个强大的基于 Remotion 的视频编辑器组件库，采用 monorepo 架构，提供模块化、可扩展的视频编辑解决方案。

## 📦 包结构

```
remotion-fast/
├── packages/
│   ├── core/                           # 核心包
│   │   ├── src/
│   │   │   ├── types/                  # TypeScript 类型定义
│   │   │   │   └── index.ts            # Track, Item, Asset 等核心类型
│   │   │   ├── state/                  # 状态管理
│   │   │   │   └── EditorContext.tsx   # React Context + useReducer
│   │   │   ├── utils/                  # 工具函数
│   │   │   │   └── waveform.ts         # 音频波形生成
│   │   │   └── index.ts                # 主导出文件
│   │   └── package.json
│   │
│   ├── remotion-components/            # Remotion 渲染组件
│   │   ├── src/
│   │   │   ├── VideoComposition.tsx    # 主视频组合组件
│   │   │   └── index.ts
│   │   └── package.json
│   │
│   └── ui/                             # UI 组件
│       ├── src/
│       │   ├── components/
│       │   │   ├── Editor.tsx          # 主编辑器布局
│       │   │   ├── Timeline.tsx        # 时间线组件
│       │   │   ├── AssetPanel.tsx      # 资源面板
│       │   │   ├── PreviewCanvas.tsx   # 预览画布
│       │   │   └── PropertiesPanel.tsx # 属性面板
│       │   └── index.ts
│       └── package.json
│
└── examples/
    └── basic-editor/                   # 基础编辑器示例
        ├── src/
        │   ├── main.tsx                # 应用入口
        │   └── Root.tsx                # Remotion 根组件
        ├── index.html
        ├── vite.config.ts
        └── package.json
```

## 🏗️ 核心架构

### 1. @remotion-fast/core 核心包

**职责**：提供类型定义、状态管理和工具函数

**导出内容**：
```typescript
// 类型
export type Track, Item, Asset, EditorState, EditorAction

// 状态管理
export { EditorProvider, useEditor }

// 工具函数
export { generateWaveform, loadAudioWaveform }
```

**核心类型**：

```typescript
// Item 类型系统
type Item = SolidItem | TextItem | VideoItem | AudioItem | ImageItem

// Track 定义
type Track = {
  id: string
  name: string
  items: Item[]
  locked?: boolean
  hidden?: boolean
}

// 编辑器状态
type EditorState = {
  tracks: Track[]
  selectedItemId: string | null
  selectedTrackId: string | null
  currentFrame: number
  playing: boolean
  zoom: number
  assets: Asset[]
  compositionWidth: number
  compositionHeight: number
  fps: number
  durationInFrames: number
}
```

**状态管理**：
- 使用 React Context + useReducer 模式
- 支持 15+ 种 Action 类型
- 完全类型安全的状态更新

### 2. @remotion-fast/remotion-components 渲染组件

**职责**：提供 Remotion 视频渲染组件

**主要组件**：
- `VideoComposition`: 主视频组合组件
- `ItemComponent`: 单个 Item 渲染器
- `TrackComponent`: 单个 Track 渲染器

**特性**：
- 支持所有 Item 类型渲染
- 内置淡入淡出动画
- 完整的 Remotion API 支持

### 3. @remotion-fast/ui UI 组件包

**职责**：提供可视化编辑器界面

**核心组件**：

#### Editor
主编辑器布局，三栏设计：
- 左侧：AssetPanel (280px)
- 中间：PreviewCanvas + Timeline (弹性)
- 右侧：PropertiesPanel (320px)

#### Timeline
多轨道时间线编辑器：
- 拖拽调整 Item 位置和长度
- 缩放控制（zoom）
- 波形可视化
- 淡入淡出效果控制
- 轨道重排序（Framer Motion）

#### AssetPanel
资源管理面板：
- 文件上传（图片、视频、音频）
- 快速添加文本/颜色
- 缩略图预览
- 拖拽添加到时间线

#### PreviewCanvas
实时视频预览：
- 使用 @remotion/player
- 播放控制
- 帧计数器

#### PropertiesPanel
属性编辑面板：
- 动态属性编辑器
- 支持所有 Item 类型
- 实时更新预览

## 🔄 数据流

```
用户操作
   ↓
UI 组件（dispatch action）
   ↓
EditorContext（reducer 处理）
   ↓
State 更新
   ↓
UI 重新渲染 + Remotion Player 更新
```

## 🚀 使用方式

### 基础使用

```tsx
import { Editor } from '@remotion-fast/ui'

function App() {
  return <Editor />
}
```

### 自定义 UI

```tsx
import { EditorProvider, useEditor } from '@remotion-fast/core'
import { Timeline, PreviewCanvas } from '@remotion-fast/ui'

function CustomEditor() {
  return (
    <EditorProvider>
      <div className="my-layout">
        <PreviewCanvas />
        <Timeline />
      </div>
    </EditorProvider>
  )
}
```

### Remotion 渲染

```tsx
import { Composition } from 'remotion'
import { VideoComposition } from '@remotion-fast/remotion-components'

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
  )
}
```

## 🛠️ 开发工作流

### 安装依赖
```bash
pnpm install
```

### 构建所有包
```bash
pnpm build
```

### 运行示例
```bash
npm run dev
# 访问 http://localhost:3001
```

### 包开发模式
```bash
cd packages/core && pnpm dev    # 监听 core 包变化
cd packages/ui && pnpm dev      # 监听 UI 包变化
```

## 📊 技术栈

- **框架**: React 19 + TypeScript
- **构建工具**: Vite (dev) + tsup (lib)
- **包管理**: pnpm workspaces
- **视频引擎**: Remotion 4.0
- **动画**: Framer Motion 12
- **状态管理**: React Context + useReducer
- **样式**: CSS-in-JS (内联样式)

## 🎨 设计原则

1. **模块化**: 三个独立包，各司其职
2. **类型安全**: 100% TypeScript 覆盖
3. **可扩展**: 支持自定义 Item 类型和 UI
4. **性能优化**: 虚拟化、防抖、节流
5. **开发体验**: 完整类型提示、清晰 API

## 🔮 未来计划

- [ ] 插件系统
- [ ] 转场效果库
- [ ] 模板系统
- [ ] 音频可视化增强
- [ ] 协作编辑
- [ ] 主题系统
- [ ] 快捷键支持
- [ ] 撤销/重做
- [ ] 导出预设
- [ ] 单元测试覆盖

## 📄 许可证

MIT License
