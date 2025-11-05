# Remotion Fast 组件库文档

## 📦 包概览

Remotion Fast 由三个独立的 npm 包组成，可以单独使用或组合使用。

---

## 1️⃣ @remotion-fast/core

**核心包** - 提供状态管理、类型定义和工具函数

### 📥 安装
```bash
npm install @remotion-fast/core
```

### 🎯 导出内容

#### 类型定义 (Types)

```typescript
// 基础 Item 类型
export type BaseItem = {
  id: string
  from: number              // 起始帧
  durationInFrames: number  // 持续帧数
}

// 纯色背景
export type SolidItem = BaseItem & {
  type: 'solid'
  color: string  // 十六进制颜色
}

// 文本元素
export type TextItem = BaseItem & {
  type: 'text'
  text: string
  color: string
  fontSize?: number
  fontFamily?: string
  fontWeight?: string
}

// 视频元素
export type VideoItem = BaseItem & {
  type: 'video'
  src: string
  waveform?: number[]        // 音频波形数据
  videoFadeIn?: number       // 视频淡入帧数
  videoFadeOut?: number      // 视频淡出帧数
  audioFadeIn?: number       // 音频淡入帧数
  audioFadeOut?: number      // 音频淡出帧数
}

// 音频元素
export type AudioItem = BaseItem & {
  type: 'audio'
  src: string
  volume?: number            // 音量 0-1
  waveform?: number[]
  audioFadeIn?: number
  audioFadeOut?: number
}

// 图片元素
export type ImageItem = BaseItem & {
  type: 'image'
  src: string
}

// 联合类型
export type Item = SolidItem | TextItem | VideoItem | AudioItem | ImageItem

// 轨道定义
export type Track = {
  id: string
  name: string
  items: Item[]
  locked?: boolean   // 是否锁定
  hidden?: boolean   // 是否隐藏
}

// 资源定义
export type Asset = {
  id: string
  name: string
  type: 'video' | 'audio' | 'image'
  src: string
  duration?: number
  thumbnail?: string
  waveform?: number[]
  createdAt: number
}

// 编辑器状态
export type EditorState = {
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

// Action 类型
export type EditorAction =
  | { type: 'ADD_TRACK'; payload: Track }
  | { type: 'REMOVE_TRACK'; payload: string }
  | { type: 'UPDATE_TRACK'; payload: { id: string; updates: Partial<Track> } }
  | { type: 'REORDER_TRACKS'; payload: Track[] }
  | { type: 'ADD_ITEM'; payload: { trackId: string; item: Item } }
  | { type: 'REMOVE_ITEM'; payload: { trackId: string; itemId: string } }
  | { type: 'UPDATE_ITEM'; payload: { trackId: string; itemId: string; updates: Partial<Item> } }
  | { type: 'SELECT_ITEM'; payload: string | null }
  | { type: 'SELECT_TRACK'; payload: string | null }
  | { type: 'SET_CURRENT_FRAME'; payload: number }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_ZOOM'; payload: number }
  | { type: 'ADD_ASSET'; payload: Asset }
  | { type: 'REMOVE_ASSET'; payload: string }
  | { type: 'SET_COMPOSITION_SIZE'; payload: { width: number; height: number } }
  | { type: 'SET_DURATION'; payload: number }
```

#### 状态管理 (State Management)

```typescript
// Provider 组件
export function EditorProvider({ children }: { children: ReactNode }): JSX.Element

// Hook
export function useEditor(): {
  state: EditorState
  dispatch: React.Dispatch<EditorAction>
}
```

#### 工具函数 (Utils)

```typescript
// 从 AudioBuffer 生成波形数据
export function generateWaveform(
  audioBuffer: AudioBuffer, 
  samples?: number  // 默认 100
): number[]

// 从音频 URL 加载并生成波形
export async function loadAudioWaveform(
  url: string, 
  samples?: number
): Promise<number[]>
```

### 📝 使用示例

```typescript
import { EditorProvider, useEditor } from '@remotion-fast/core'

function MyCustomEditor() {
  const { state, dispatch } = useEditor()
  
  // 添加新轨道
  const addTrack = () => {
    dispatch({
      type: 'ADD_TRACK',
      payload: {
        id: 'track-new',
        name: 'New Track',
        items: []
      }
    })
  }
  
  // 添加文本元素
  const addText = () => {
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        trackId: state.tracks[0].id,
        item: {
          id: 'text-1',
          type: 'text',
          text: 'Hello World',
          color: '#000000',
          from: 0,
          durationInFrames: 90
        }
      }
    })
  }
  
  return (
    <div>
      <button onClick={addTrack}>Add Track</button>
      <button onClick={addText}>Add Text</button>
    </div>
  )
}

function App() {
  return (
    <EditorProvider>
      <MyCustomEditor />
    </EditorProvider>
  )
}
```

---

## 2️⃣ @remotion-fast/remotion-components

**Remotion 渲染包** - 提供视频渲染组件

### 📥 安装
```bash
npm install @remotion-fast/remotion-components @remotion-fast/core remotion
```

### 🎯 导出组件

#### VideoComposition

主视频组合组件，将 tracks 数据渲染为 Remotion 视频。

```typescript
export const VideoComposition: React.FC<{ tracks: Track[] }>
```

**Props:**
- `tracks`: Track[] - 轨道数组

**内部组件:**
- `ItemComponent` - 渲染单个 Item
- `TrackComponent` - 渲染单个 Track

**支持的特性:**
- ✅ 所有 Item 类型（text, video, audio, image, solid）
- ✅ 自动淡入淡出动画
- ✅ 音频/视频同步
- ✅ 多轨道叠加
- ✅ 时间序列控制

### 📝 使用示例

```typescript
import { Composition } from 'remotion'
import { VideoComposition } from '@remotion-fast/remotion-components'

export const RemotionRoot = () => {
  const tracks = [
    {
      id: 'track-1',
      name: 'Track 1',
      items: [
        {
          id: 'text-1',
          type: 'text',
          text: 'Hello Remotion Fast!',
          color: '#ffffff',
          from: 0,
          durationInFrames: 90,
          fontSize: 80
        }
      ]
    }
  ]
  
  return (
    <Composition
      id="MyVideo"
      component={VideoComposition}
      durationInFrames={300}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ tracks }}
    />
  )
}
```

---

## 3️⃣ @remotion-fast/ui

**UI 组件包** - 提供完整的编辑器界面组件

### 📥 安装
```bash
npm install @remotion-fast/ui @remotion-fast/core @remotion-fast/remotion-components
npm install @remotion/player framer-motion remotion react react-dom
```

### 🎯 导出组件

#### 1. Editor (主编辑器)

完整的视频编辑器界面，开箱即用。

```typescript
export const Editor: React.FC
```

**特性:**
- 三栏布局（Assets + Preview/Timeline + Properties）
- 自动集成所有子组件
- 内置状态管理（EditorProvider）
- 导出模态框

**使用:**
```typescript
import { Editor } from '@remotion-fast/ui'

function App() {
  return <Editor />
}
```

---

#### 2. Timeline (时间线)

多轨道时间线编辑器组件。

```typescript
export const Timeline: React.FC
```

**功能:**
- ✅ 拖拽调整元素位置
- ✅ 拖拽调整元素长度
- ✅ 缩放控制 (+/- 按钮)
- ✅ 时间标尺显示
- ✅ 波形可视化（音频/视频）
- ✅ 淡入淡出效果可视化
- ✅ 淡入淡出手柄拖拽调整
- ✅ 轨道拖拽重排序
- ✅ 添加新轨道
- ✅ 当前帧指示器

**支持的元素类型:**
- Text - 文字显示
- Solid - 纯色背景
- Video - 视频缩略图 + 波形
- Audio - 波形显示
- Image - 图片缩略图

**键盘交互:**
- 点击时间线设置当前帧
- 拖拽元素移动
- 拖拽边缘调整长度
- 拖拽淡入淡出手柄调整效果

---

#### 3. AssetPanel (资源面板)

媒体资源管理面板。

```typescript
export const AssetPanel: React.FC
```

**功能:**
- 📝 快速添加文本
- 🎨 快速添加随机颜色
- 📁 文件上传（image/video/audio）
- 🖼️ 自动生成视频缩略图
- 📊 自动生成音频波形
- 🔍 资源预览
- 🗑️ 删除资源
- 拖拽资源到时间线

**支持的文件类型:**
- 图片: jpg, png, gif, webp
- 视频: mp4, webm, mov
- 音频: mp3, wav, ogg

**拖拽交互:**
- 拖拽资源到轨道自动创建元素
- 自动设置在当前帧位置
- 保留缩略图和波形数据

---

#### 4. PreviewCanvas (预览画布)

实时视频预览组件。

```typescript
export const PreviewCanvas: React.FC
```

**功能:**
- ▶️ 播放/暂停控制
- ⏮️⏭️ 上一帧/下一帧
- 📊 帧计数器显示
- 🔄 循环播放
- 📐 自动适应尺寸
- 实时渲染

**使用 Remotion Player:**
- 完整的 Remotion 渲染能力
- 所有效果实时预览
- 音视频同步

---

#### 5. PropertiesPanel (属性面板)

动态属性编辑面板。

```typescript
export const PropertiesPanel: React.FC
```

**功能:**
- 根据选中元素动态显示属性
- 实时更新预览
- 支持所有 Item 类型

**Text Item 属性:**
- 文本内容
- 颜色选择器
- 字体大小
- 字体名称
- 字体粗细

**Video/Audio Item 属性:**
- 视频淡入时长
- 视频淡出时长
- 音频淡入时长
- 音频淡出时长

**所有 Item 通用属性:**
- 起始帧位置
- 持续帧数

---

### 🎨 单独使用组件

你可以只使用需要的组件，自定义布局：

```typescript
import { EditorProvider } from '@remotion-fast/core'
import { Timeline, PreviewCanvas, AssetPanel } from '@remotion-fast/ui'

function CustomEditor() {
  return (
    <EditorProvider>
      <div style={{ display: 'flex', height: '100vh' }}>
        {/* 左侧 */}
        <div style={{ width: 300 }}>
          <AssetPanel />
        </div>
        
        {/* 中间 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1 }}>
            <PreviewCanvas />
          </div>
          <div style={{ height: 300 }}>
            <Timeline />
          </div>
        </div>
      </div>
    </EditorProvider>
  )
}
```

---

## 🎬 完整使用示例

### 示例 1: 基础编辑器

```typescript
import { Editor } from '@remotion-fast/ui'

function App() {
  return <Editor />
}
```

### 示例 2: 自定义初始状态

```typescript
import { EditorProvider, useEditor } from '@remotion-fast/core'
import { Editor } from '@remotion-fast/ui'

const initialTracks = [
  {
    id: 'track-1',
    name: 'Main Track',
    items: [
      {
        id: 'intro',
        type: 'text',
        text: 'Welcome!',
        color: '#0066ff',
        from: 0,
        durationInFrames: 60,
        fontSize: 100
      }
    ]
  }
]

function App() {
  return (
    <EditorProvider>
      <Editor />
    </EditorProvider>
  )
}
```

### 示例 3: 程序化控制

```typescript
import { EditorProvider, useEditor } from '@remotion-fast/core'
import { Timeline, PreviewCanvas } from '@remotion-fast/ui'

function EditorControls() {
  const { state, dispatch } = useEditor()
  
  const exportJSON = () => {
    console.log(JSON.stringify(state.tracks, null, 2))
  }
  
  const loadFromJSON = (jsonString: string) => {
    const tracks = JSON.parse(jsonString)
    // 重新设置所有轨道
    dispatch({ type: 'REORDER_TRACKS', payload: tracks })
  }
  
  return (
    <div>
      <button onClick={exportJSON}>导出 JSON</button>
      <button onClick={() => dispatch({ type: 'SET_PLAYING', payload: !state.playing })}>
        {state.playing ? '暂停' : '播放'}
      </button>
    </div>
  )
}

function App() {
  return (
    <EditorProvider>
      <EditorControls />
      <PreviewCanvas />
      <Timeline />
    </EditorProvider>
  )
}
```

---

## 📊 数据流图

```
用户交互
   ↓
UI 组件 (Timeline/AssetPanel/PropertiesPanel)
   ↓
dispatch(action)
   ↓
EditorContext Reducer
   ↓
State 更新
   ↓
┌─────────────────┬────────────────────┐
│                 │                    │
UI 组件重新渲染   PreviewCanvas 更新   VideoComposition 渲染
```

---

## 🎯 核心概念

### Track (轨道)
- 视频编辑的层级概念
- 每个 Track 包含多个 Items
- 可拖拽重排序
- 支持锁定和隐藏

### Item (元素)
- 时间线上的基本单位
- 5 种类型：text, video, audio, image, solid
- 每个 Item 有起始帧和持续帧数
- 支持淡入淡出效果

### Asset (资源)
- 上传的媒体文件
- 自动生成缩略图和波形
- 可拖拽到时间线创建 Item

### Frame (帧)
- 视频的最小时间单位
- 默认 30 fps
- 所有时间都以帧为单位

---

## 🚀 高级功能

### 1. 自定义 Item 类型

```typescript
// 扩展 Item 类型
type CustomItem = BaseItem & {
  type: 'custom'
  customProp: string
}

type ExtendedItem = Item | CustomItem
```

### 2. 自定义渲染器

```typescript
import { ItemComponent } from '@remotion-fast/remotion-components'

// 自定义渲染逻辑
const CustomItemRenderer = ({ item }) => {
  if (item.type === 'custom') {
    return <div>{item.customProp}</div>
  }
  return <ItemComponent item={item} />
}
```

### 3. 波形生成

```typescript
import { loadAudioWaveform } from '@remotion-fast/core'

const audioUrl = '/path/to/audio.mp3'
const waveform = await loadAudioWaveform(audioUrl, 100)
// waveform: number[] 0-1 归一化的波形数据
```

---

## 📦 包依赖关系

```
@remotion-fast/ui
  ↓ depends on
@remotion-fast/core
@remotion-fast/remotion-components
  ↓ depends on
@remotion-fast/core
```

**Peer Dependencies:**
- react >= 18.0.0
- react-dom >= 18.0.0
- remotion ^4.0.0
- @remotion/player ^4.0.0
- framer-motion ^12.0.0

---

## 🎨 样式定制

目前使用内联样式，未来将支持：
- [ ] CSS-in-JS
- [ ] Tailwind CSS
- [ ] 主题系统
- [ ] 自定义颜色方案

---

## 📄 许可证

MIT License - 自由使用和修改
