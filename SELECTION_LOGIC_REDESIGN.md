# 画布元素选中逻辑重新设计

## 当前问题分析

### 1. 选中来源分散
当前有三个地方可以触发选中:
- **InteractiveCanvas**: 通过点击画布上的元素 (handleCanvasClick)
- **TimelineItem**: 通过点击时间轴上的 item (handleClick)
- **TimelineTracksContainer**: 通过点击空白区域取消选中

### 2. 选中检测逻辑问题
在 `InteractiveCanvas.tsx` 的 `handleCanvasClick` 中:
```typescript
// 问题1: 从前往后遍历 tracks,没有考虑 z-index
for (let trackIndex = 0; trackIndex < tracks.length; trackIndex++) {
  // 问题2: 简单的矩形碰撞检测,没有考虑旋转
  if (x >= left && x <= right && y >= top && y <= bottom) {
    onSelectItem(item.id);
    return;
  }
}
```

### 3. 选中状态传递混乱
- `selectedItemId` 存储在全局状态 (EditorState)
- 通过 props 层层传递到各个组件
- Timeline 和 Canvas 需要保持同步

### 4. 拖拽时的选中行为不一致
- Canvas 拖拽时阻止选中 (有 dragState 检查)
- Timeline 拖拽时可能触发选中
- 没有统一的拖拽状态管理

## 重新设计方案

### 1. 统一选中管理器 (SelectionManager)

创建一个专门的选中管理模块:

```typescript
// packages/ui/src/selection/SelectionManager.ts

export interface SelectionContext {
  selectedItemId: string | null;
  hoveredItemId: string | null;
  isDragging: boolean;
  isResizing: boolean;
}

export interface SelectionTarget {
  itemId: string;
  trackId: string;
  source: 'canvas' | 'timeline';
}

export class SelectionManager {
  private context: SelectionContext;
  private listeners: Set<(context: SelectionContext) => void>;

  constructor() {
    this.context = {
      selectedItemId: null,
      hoveredItemId: null,
      isDragging: false,
      isResizing: false,
    };
    this.listeners = new Set();
  }

  // 选中元素
  select(target: SelectionTarget | null): boolean {
    // 如果正在拖拽或调整大小,阻止选中
    if (this.context.isDragging || this.context.isResizing) {
      return false;
    }

    const newItemId = target?.itemId ?? null;
    if (this.context.selectedItemId !== newItemId) {
      this.context.selectedItemId = newItemId;
      this.notify();
      return true;
    }
    return false;
  }

  // 悬停元素
  hover(itemId: string | null) {
    if (this.context.hoveredItemId !== itemId) {
      this.context.hoveredItemId = itemId;
      this.notify();
    }
  }

  // 设置拖拽状态
  setDragging(isDragging: boolean) {
    this.context.isDragging = isDragging;
    this.notify();
  }

  // 设置调整大小状态
  setResizing(isResizing: boolean) {
    this.context.isResizing = isResizing;
    this.notify();
  }

  // 获取当前上下文
  getContext(): SelectionContext {
    return { ...this.context };
  }

  // 订阅状态变化
  subscribe(listener: (context: SelectionContext) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(listener => listener(this.getContext()));
  }
}
```

### 2. 改进的画布选中检测

```typescript
// packages/ui/src/selection/CanvasHitTest.ts

export interface HitTestResult {
  itemId: string;
  trackId: string;
  distance: number; // 距离中心的距离,用于优先级排序
}

export class CanvasHitTest {
  /**
   * 检测点击位置是否命中某个 item
   * 考虑旋转、缩放等变换
   */
  static testPoint(
    x: number,
    y: number,
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

    // 将点击坐标转换到 item 的本地坐标系
    const dx = x - itemX;
    const dy = y - itemY;

    // 反向旋转点击点
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
   * 查找点击位置的所有可能目标
   * 按照 z-index 排序(后渲染的在前)
   */
  static findTargets(
    x: number,
    y: number,
    tracks: Track[],
    currentFrame: number,
    compositionWidth: number,
    compositionHeight: number
  ): HitTestResult[] {
    const results: HitTestResult[] = [];

    // 从后往前遍历 tracks (z-index 高的在后)
    for (let trackIndex = tracks.length - 1; trackIndex >= 0; trackIndex--) {
      const track = tracks[trackIndex];

      for (const item of track.items) {
        // 检查是否在当前帧可见
        if (
          currentFrame < item.from ||
          currentFrame >= item.from + item.durationInFrames
        ) {
          continue;
        }

        // 执行命中测试
        if (this.testPoint(x, y, item, compositionWidth, compositionHeight)) {
          const props = item.properties;
          const itemX = props?.x ?? 0;
          const itemY = props?.y ?? 0;
          const distance = Math.sqrt(
            Math.pow(x - itemX, 2) + Math.pow(y - itemY, 2)
          );

          results.push({
            itemId: item.id,
            trackId: track.id,
            distance,
          });
        }
      }
    }

    // 按距离排序,距离小的优先
    return results.sort((a, b) => a.distance - b.distance);
  }
}
```

### 3. 统一的选中事件处理

```typescript
// packages/ui/src/selection/useSelection.ts

export function useSelection() {
  const { state, dispatch } = useEditor();
  const selectionManagerRef = useRef<SelectionManager>(new SelectionManager());
  const manager = selectionManagerRef.current;

  // 同步 manager 和 Redux state
  useEffect(() => {
    manager.select(
      state.selectedItemId
        ? { itemId: state.selectedItemId, trackId: '', source: 'canvas' }
        : null
    );
  }, [state.selectedItemId]);

  // 订阅 manager 变化并同步到 Redux
  useEffect(() => {
    return manager.subscribe((context) => {
      if (context.selectedItemId !== state.selectedItemId) {
        dispatch({
          type: 'SELECT_ITEM',
          payload: context.selectedItemId,
        });
      }
    });
  }, [manager, dispatch, state.selectedItemId]);

  const selectFromCanvas = useCallback(
    (x: number, y: number) => {
      const targets = CanvasHitTest.findTargets(
        x,
        y,
        state.tracks,
        state.currentFrame,
        state.compositionWidth,
        state.compositionHeight
      );

      if (targets.length > 0) {
        manager.select({
          itemId: targets[0].itemId,
          trackId: targets[0].trackId,
          source: 'canvas',
        });
      } else {
        manager.select(null);
      }
    },
    [state, manager]
  );

  const selectFromTimeline = useCallback(
    (itemId: string, trackId: string) => {
      manager.select({ itemId, trackId, source: 'timeline' });
    },
    [manager]
  );

  const clearSelection = useCallback(() => {
    manager.select(null);
  }, [manager]);

  const setDragging = useCallback(
    (isDragging: boolean) => {
      manager.setDragging(isDragging);
    },
    [manager]
  );

  const setResizing = useCallback(
    (isResizing: boolean) => {
      manager.setResizing(isResizing);
    },
    [manager]
  );

  return {
    selectedItemId: state.selectedItemId,
    context: manager.getContext(),
    selectFromCanvas,
    selectFromTimeline,
    clearSelection,
    setDragging,
    setResizing,
  };
}
```

### 4. 重构 InteractiveCanvas

```typescript
// InteractiveCanvas.tsx 中的改动

const { selectFromCanvas, clearSelection, setDragging } = useSelection();

// 替换原来的 handleCanvasClick
const handleCanvasClick = useCallback(
  (e: React.MouseEvent) => {
    if (dragState) return; // 如果正在拖拽,不触发选择
    
    const { x, y } = screenToComposition(e.clientX, e.clientY);
    selectFromCanvas(x, y);
  },
  [dragState, screenToComposition, selectFromCanvas]
);

// 在拖拽开始时设置状态
const handleMouseDown = useCallback(
  (e: React.MouseEvent, mode: DragMode) => {
    // ...existing code...
    setDragging(true);
    setDragState({...});
  },
  [setDragging, /* ...other deps... */]
);

// 在拖拽结束时清除状态
const handleMouseUp = useCallback(() => {
  setDragState(null);
  setDragging(false);
}, [setDragging]);
```

### 5. 重构 TimelineItem

```typescript
// TimelineItem.tsx 中的改动

const { selectFromTimeline, setDragging, setResizing } = useSelection();

const handleClick = useCallback(
  (e: React.MouseEvent) => {
    e.stopPropagation();
    selectFromTimeline(item.id, trackId);
  },
  [item.id, trackId, selectFromTimeline]
);

// 在调整大小时设置状态
const handleResizeMouseDown = useCallback(
  (edge: 'left' | 'right', e: React.MouseEvent, isRollEdit = false) => {
    e.stopPropagation();
    e.preventDefault();

    setResizing(true);
    setResizingEdge(edge);
    onResizeStart?.(edge);

    // ...existing resize logic...

    const handleMouseUp = () => {
      setResizingEdge(null);
      setResizing(false); // 清除调整大小状态
      onResizeEnd?.();
      // ...
    };
  },
  [setResizing, /* ...other deps... */]
);

// 在 dnd-kit 拖拽时设置状态
useEffect(() => {
  if (isDragging) {
    setDragging(true);
  } else {
    setDragging(false);
  }
}, [isDragging, setDragging]);
```

## 实施步骤

### Phase 1: 基础设施 (不破坏现有功能)
1. ✅ 创建 `SelectionManager` 类
2. ✅ 创建 `CanvasHitTest` 工具类
3. ✅ 创建 `useSelection` hook
4. ✅ 编写单元测试

### Phase 2: 逐步迁移
1. 🔄 在 `InteractiveCanvas` 中使用新的选中逻辑
2. 🔄 在 `TimelineItem` 中使用新的选中逻辑
3. 🔄 在 `TimelineTracksContainer` 中使用新的选中逻辑
4. 🔄 测试所有选中场景

### Phase 3: 清理
1. ⏳ 移除旧的选中逻辑代码
2. ⏳ 更新文档
3. ⏳ 性能优化

## 测试场景清单

### Canvas 选中
- [ ] 点击可见元素能正确选中
- [ ] 点击旋转的元素能正确选中
- [ ] 点击重叠元素时选中最上层的
- [ ] 点击空白区域取消选中
- [ ] 拖拽元素时不触发选中
- [ ] 调整大小时不触发选中

### Timeline 选中
- [ ] 点击 timeline item 能正确选中
- [ ] 拖拽 item 时不改变选中状态
- [ ] 调整 item 大小时不改变选中状态
- [ ] 点击空白区域取消选中

### 跨组件同步
- [ ] Canvas 选中能同步到 Timeline
- [ ] Timeline 选中能同步到 Canvas
- [ ] 删除选中的元素能清除选中状态

## 优势总结

1. **统一管理**: 所有选中逻辑集中在 SelectionManager
2. **精确检测**: CanvasHitTest 支持旋转、缩放等变换
3. **状态明确**: 清晰的拖拽/调整大小状态管理
4. **易于测试**: 逻辑分离,便于单元测试
5. **可扩展**: 未来可以轻松添加多选、框选等功能
