# Canvas 图层选中逻辑重新设计

## 核心思路

Canvas 按图层（track）管理，点击或拖动时直接选中鼠标位置最上层的元素。

## 关键改动

### 1. 改进的碰撞检测（支持旋转）

```typescript
// packages/ui/src/components/canvas/hitTest.ts

import type { Item, Track } from '@remotion-fast/core';

/**
 * 测试点击点是否在元素内（支持旋转）
 */
export function testItemHit(
  clickX: number,
  clickY: number,
  item: Item,
  compositionWidth: number,
  compositionHeight: number
): boolean {
  const props = item.properties;
  if (!props) return false;

  const itemX = props.x ?? 0;
  const itemY = props.y ?? 0;
  const itemWidth = (props.width ?? 1) * compositionWidth;
  const itemHeight = (props.height ?? 1) * compositionHeight;
  const rotation = (props.rotation ?? 0) * (Math.PI / 180);

  // 将点击坐标转换到元素的本地坐标系（反向旋转）
  const dx = clickX - itemX;
  const dy = clickY - itemY;
  
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  // 检查是否在矩形范围内
  const halfWidth = itemWidth / 2;
  const halfHeight = itemHeight / 2;

  return (
    localX >= -halfWidth &&
    localX <= halfWidth &&
    localY >= -halfHeight &&
    localY <= halfHeight
  );
}

/**
 * 查找点击位置最上层的元素
 * 返回: { itemId, trackId } 或 null
 */
export function findTopItemAtPoint(
  x: number,
  y: number,
  tracks: Track[],
  currentFrame: number,
  compositionWidth: number,
  compositionHeight: number
): { itemId: string; trackId: string } | null {
  // 从后往前遍历 tracks（后面的 track 在上层）
  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i];
    
    // 从后往前遍历该 track 的 items（后面的 item 在上层）
    for (let j = track.items.length - 1; j >= 0; j--) {
      const item = track.items[j];
      
      // 检查元素是否在当前帧可见
      const isVisible = 
        currentFrame >= item.from &&
        currentFrame < item.from + item.durationInFrames;
      
      if (!isVisible) continue;
      
      // 执行碰撞检测
      if (testItemHit(x, y, item, compositionWidth, compositionHeight)) {
        return { itemId: item.id, trackId: track.id };
      }
    }
  }
  
  return null;
}
```

### 2. 简化 InteractiveCanvas 的选中逻辑

```typescript
// packages/ui/src/components/InteractiveCanvas.tsx

import { findTopItemAtPoint } from './canvas/hitTest';

// ... 现有代码 ...

// 统一的指针按下处理（同时处理选中和拖动）
const handlePointerDown = useCallback(
  (e: React.MouseEvent) => {
    // 如果点击的是控制手柄，交给手柄处理
    if ((e.target as HTMLElement).closest('.control-handle')) {
      return;
    }

    const { x, y } = screenToComposition(e.clientX, e.clientY);
    
    // 查找点击位置最上层的元素
    const target = findTopItemAtPoint(
      x,
      y,
      tracks,
      currentFrame,
      compositionWidth,
      compositionHeight
    );

    if (target) {
      // 找到元素：选中并准备拖动
      if (selectedItemId !== target.itemId) {
        onSelectItem?.(target.itemId);
      }
      
      // 查找完整的 item 数据准备拖动
      const itemData = tracks
        .flatMap((t) => t.items.map((i) => ({ trackId: t.id, item: i })))
        .find((x) => x.item.id === target.itemId);
      
      if (itemData) {
        e.preventDefault();
        e.stopPropagation();
        
        setDragState({
          mode: 'move',
          startX: x,
          startY: y,
          startProperties: {
            x: itemData.item.properties?.x ?? 0,
            y: itemData.item.properties?.y ?? 0,
            width: itemData.item.properties?.width ?? 1,
            height: itemData.item.properties?.height ?? 1,
            rotation: itemData.item.properties?.rotation ?? 0,
            opacity: itemData.item.properties?.opacity ?? 1,
          },
          item: itemData.item,
          trackId: itemData.trackId,
        });
      }
    } else {
      // 没找到元素：取消选中
      onSelectItem?.(null);
    }
  },
  [
    tracks,
    currentFrame,
    compositionWidth,
    compositionHeight,
    selectedItemId,
    onSelectItem,
    screenToComposition,
  ]
);

// 替换原来的 handleCanvasClick 和独立的 handleMouseDown
// <div onClick={handleCanvasClick}> 改为:
// <div onMouseDown={handlePointerDown}>
```

### 3. 控制手柄的处理

控制手柄需要特殊类名来避免触发选中逻辑：

```typescript
// 在 SVG 控制手柄元素上添加 className
<svg className="canvas-controls">
  {/* 边框 */}
  <rect className="control-handle" ... />
  
  {/* 拖拽区域 */}
  <rect 
    className="control-handle"
    onMouseDown={(e) => {
      e.stopPropagation();
      handleMouseDown(e as any, 'move');
    }}
    ...
  />
  
  {/* 缩放手柄 */}
  <circle 
    className="control-handle"
    onMouseDown={(e) => {
      e.stopPropagation();
      handleMouseDown(e as any, `scale-${pos}` as DragMode);
    }}
    ...
  />
  
  {/* 旋转手柄 */}
  <circle 
    className="control-handle"
    onMouseDown={(e) => {
      e.stopPropagation();
      handleMouseDown(e as any, 'rotate');
    }}
    ...
  />
</svg>
```

### 4. 完整的事件流

```
用户点击画布
    ↓
handlePointerDown 触发
    ↓
将屏幕坐标转换为 composition 坐标
    ↓
findTopItemAtPoint 查找最上层元素
    ↓
    ├─ 找到元素
    │   ├─ 选中该元素 (如果未选中)
    │   └─ 设置 dragState 准备拖动
    │
    └─ 未找到元素
        └─ 取消选中
```

## 实现代码

### hitTest.ts (新建文件)

```typescript
// packages/ui/src/components/canvas/hitTest.ts

import type { Item, Track } from '@remotion-fast/core';

/**
 * 测试点击点是否在元素内（支持旋转）
 */
export function testItemHit(
  clickX: number,
  clickY: number,
  item: Item,
  compositionWidth: number,
  compositionHeight: number
): boolean {
  const props = item.properties;
  if (!props) return false;

  const itemX = props.x ?? 0;
  const itemY = props.y ?? 0;
  const itemWidth = (props.width ?? 1) * compositionWidth;
  const itemHeight = (props.height ?? 1) * compositionHeight;
  const rotation = (props.rotation ?? 0) * (Math.PI / 180);

  // 将点击坐标转换到元素的本地坐标系（反向旋转）
  const dx = clickX - itemX;
  const dy = clickY - itemY;
  
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  // 检查是否在矩形范围内
  const halfWidth = itemWidth / 2;
  const halfHeight = itemHeight / 2;

  return (
    localX >= -halfWidth &&
    localX <= halfWidth &&
    localY >= -halfHeight &&
    localY <= halfHeight
  );
}

/**
 * 查找点击位置最上层的元素
 */
export function findTopItemAtPoint(
  x: number,
  y: number,
  tracks: Track[],
  currentFrame: number,
  compositionWidth: number,
  compositionHeight: number
): { itemId: string; trackId: string } | null {
  // 从后往前遍历 tracks（后面的 track 在上层）
  for (let i = tracks.length - 1; i >= 0; i--) {
    const track = tracks[i];
    
    // 从后往前遍历该 track 的 items（后面的 item 在上层）
    for (let j = track.items.length - 1; j >= 0; j--) {
      const item = track.items[j];
      
      // 检查元素是否在当前帧可见
      const isVisible = 
        currentFrame >= item.from &&
        currentFrame < item.from + item.durationInFrames;
      
      if (!isVisible) continue;
      
      // 执行碰撞检测
      if (testItemHit(x, y, item, compositionWidth, compositionHeight)) {
        return { itemId: item.id, trackId: track.id };
      }
    }
  }
  
  return null;
}
```

## 测试场景

- [x] 点击空白区域 → 取消选中
- [x] 点击单个元素 → 选中该元素
- [x] 点击重叠元素 → 选中最上层的元素
- [x] 点击旋转后的元素 → 正确选中
- [x] 按住拖动元素 → 选中并拖动
- [x] 点击控制手柄 → 不触发选中逻辑
- [x] 拖动到其他元素上 → 不改变选中

## 优势

1. **简单直观** - 逻辑清晰，易于理解
2. **正确的图层顺序** - 从后往前遍历，符合渲染顺序
3. **支持旋转** - 使用坐标变换进行精确检测
4. **一次性处理** - 点击即选中+拖动，无需二次点击
5. **性能好** - 找到第一个匹配就返回，不遍历所有元素
