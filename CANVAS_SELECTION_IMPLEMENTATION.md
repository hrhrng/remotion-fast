# Canvas 图层选中逻辑实现总结

## 已完成的改动

### 1. 新增文件

#### `packages/ui/src/components/canvas/hitTest.ts`
包含两个核心函数：

- **`testItemHit`**: 测试点击点是否在元素内，支持旋转变换
  - 使用反向旋转矩阵将点击坐标转换到元素的本地坐标系
  - 然后进行简单的矩形范围检测
  - **重要**：使用可选链操作符 `?.` 处理没有 `properties` 的元素，提供默认值（全屏居中）

- **`findTopItemAtPoint`**: 查找点击位置最上层的元素
  - 从后往前遍历 tracks（后面的 track 在上层）
  - 对每个 track，从后往前遍历 items
  - 检查元素在当前帧是否可见
  - 找到第一个匹配的元素后立即返回（性能优化）

#### `packages/ui/src/components/canvas/hitTest.test.ts`
单元测试文件，覆盖以下场景：
- 无旋转元素的碰撞检测
- 旋转元素的碰撞检测
- 多图层时选中最上层元素
- 点击空白区域返回 null
- 帧可见性检测

### 2. 修改文件

#### `packages/ui/src/components/InteractiveCanvas.tsx`

**关键改动**：

1. **导入新的碰撞检测函数**
   ```typescript
   import { findTopItemAtPoint } from './canvas/hitTest';
   ```

2. **替换 `handleCanvasClick` 为 `handlePointerDown`**
   - 使用 `onMouseDown` 而不是 `onClick`，实现点击即拖动
   - 调用 `findTopItemAtPoint` 查找最上层元素
   - 如果找到元素，选中并设置 dragState
   - 如果没找到，取消选中

3. **添加控制手柄保护**
   - 所有控制手柄添加 `className="control-handle"`
   - 在 `handlePointerDown` 中检查 `closest('.control-handle')` 避免触发选中

4. **简化事件处理**
   - 移除了原来复杂的 z-index 遍历逻辑
   - 移除了简单的矩形碰撞检测（不支持旋转）
   - 统一选中和拖动的入口点

## 核心逻辑流程

```
用户在 Canvas 上按下鼠标
    ↓
handlePointerDown 被触发
    ↓
检查是否点击控制手柄 ──是→ 返回（交给手柄处理）
    ↓ 否
将屏幕坐标转换为 composition 坐标
    ↓
调用 findTopItemAtPoint 查找最上层元素
    ↓
    ├─ 找到元素
    │   ├─ 如果未选中，触发 onSelectItem
    │   ├─ 查找完整的 item 数据
    │   └─ 设置 dragState（准备拖动）
    │
    └─ 未找到元素
        └─ 触发 onSelectItem(null) 取消选中
```

## 技术亮点

### 1. 支持旋转的碰撞检测
使用坐标变换而不是简单的矩形检测：

```typescript
// 反向旋转点击点到元素的本地坐标系
const cos = Math.cos(-rotation);
const sin = Math.sin(-rotation);
const localX = dx * cos - dy * sin;
const localY = dx * sin + dy * cos;

// 然后进行简单的矩形检测
return (
  localX >= -halfWidth &&
  localX <= halfWidth &&
  localY >= -halfHeight &&
  localY <= halfHeight
);
```

### 2. 正确的图层顺序
从后往前遍历，符合渲染顺序（后渲染的在上层）：

```typescript
for (let i = tracks.length - 1; i >= 0; i--) {
  const track = tracks[i];
  for (let j = track.items.length - 1; j >= 0; j--) {
    const item = track.items[j];
    // ...
  }
}
```

### 3. 点击即拖动
使用 `onMouseDown` 而不是 `onClick`，让用户体验更流畅：
- 点击元素 → 选中 + 准备拖动
- 移动鼠标 → 开始拖动
- 释放鼠标 → 完成拖动

无需先点击选中，再点击拖动（两步变一步）。

### 4. 性能优化
找到第一个匹配的元素后立即返回，不遍历所有元素：

```typescript
if (testItemHit(x, y, item, compositionWidth, compositionHeight)) {
  return { itemId: item.id, trackId: track.id }; // 立即返回
}
```

## 测试场景

- ✅ 点击空白区域 → 取消选中
- ✅ 点击单个元素 → 选中该元素
- ✅ 点击重叠元素 → 选中最上层的元素
- ✅ 点击旋转后的元素 → 正确选中
- ✅ 按住拖动元素 → 选中并拖动
- ✅ 点击控制手柄 → 不触发选中逻辑
- ✅ 拖动到其他元素上 → 不改变选中

## 运行测试

```bash
# 运行单元测试
npm test -- hitTest.test.ts

# 或者在项目根目录
pnpm test
```

## 未来扩展

这个架构为以下功能奠定了基础：

1. **多选** - 修改 `findTopItemAtPoint` 返回数组而不是单个元素
2. **框选** - 添加 `findItemsInRect` 函数
3. **图层锁定** - 在 `findTopItemAtPoint` 中跳过锁定的图层
4. **图层可见性** - 在遍历时检查 track 的 `hidden` 属性
5. **元素分组** - 支持选中组而不是单个元素

## 代码质量

- ✅ 类型安全（TypeScript）
- ✅ 逻辑分离（hitTest 独立模块）
- ✅ 性能优化（提前返回）
- ✅ 易于维护（清晰的注释）

## Bug 修复

### 问题：text 和 solid 元素刚插入时无法从 Canvas 选中

**原因**：
有些元素刚创建时可能没有 `properties` 字段，而 `testItemHit` 中的 `if (!props) return false;` 会直接返回 false，导致无法选中。

**解决方案**：
使用可选链操作符 `?.` 和空值合并操作符 `??` 为没有 properties 的元素提供默认值：

```typescript
// 修改前：
const props = item.properties;
if (!props) return false;  // ✘ 会阻止选中

// 修改后：
const props = item.properties;
const itemX = props?.x ?? 0;           // ✓ 默认居中
const itemY = props?.y ?? 0;
const itemWidth = (props?.width ?? 1) * compositionWidth;   // ✓ 默认全屏
const itemHeight = (props?.height ?? 1) * compositionHeight;
const rotation = (props?.rotation ?? 0) * (Math.PI / 180);  // ✓ 默认无旋转
```

这样，即使元素没有 properties，也会被当作全屏居中的元素处理，可以被正常选中。
