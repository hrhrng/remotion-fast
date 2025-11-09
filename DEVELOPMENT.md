# Development Guide

## 开发流程

### 快速开始

```bash
# 安装依赖
pnpm install

# 启动开发服务器（自动监听文件变化）
pnpm run dev
```

### 在开发前验证代码

```bash
# 运行类型检查和构建验证
pnpm run verify
```

这个命令会：
1. ✅ 检查所有包的 TypeScript 类型
2. ✅ 构建所有包
3. ✅ 确保没有语法错误

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm run dev` | 启动开发服务器（热更新） |
| `pnpm run build` | 构建所有包 |
| `pnpm run typecheck` | 类型检查 |
| `pnpm run verify` | 完整验证（typecheck + build） |
| `pnpm run clean` | 清理所有 node_modules 和 dist |

## 项目结构

```
remotion-fast/
├── packages/
│   ├── core/              # 核心状态管理和类型
│   ├── remotion-components/  # Remotion 渲染组件
│   └── ui/                # UI 编辑器组件
├── examples/
│   └── basic-editor/      # 基础编辑器示例
└── scripts/
    └── verify.sh          # 验证脚本
```

## 开发工作流

### 修改代码后

1. **自动热更新**：`pnpm run dev` 会监听文件变化并自动重新编译
2. **浏览器刷新**：Vite 会自动热更新浏览器
3. **遇到问题**：
   - 硬刷新浏览器：`Cmd + Shift + R` (Mac) 或 `Ctrl + Shift + R` (Windows)
   - 如果还是不行，停止 dev server 并运行 `pnpm run verify`

### 提交代码前

```bash
# 运行验证确保代码没有错误
pnpm run verify
```

### CI/CD

项目配置了 GitHub Actions，会在以下情况自动运行：
- Push 到 main/develop 分支
- 创建 Pull Request

CI 会自动执行：
1. TypeScript 类型检查
2. 构建所有包
3. 构建示例应用

## 热更新不工作？

如果发现代码修改后没有生效：

1. **检查 tsup 是否在监听**
   ```bash
   # 应该看到类似这样的输出：
   # [0] > @remotion-fast/core@0.1.0 dev
   # [1] > @remotion-fast/remotion-components@0.1.0 dev
   # [2] > @remotion-fast/ui@0.1.0 dev
   ```

2. **重启开发服务器**
   ```bash
   # Ctrl+C 停止
   pnpm run dev
   ```

3. **清理并重新构建**
   ```bash
   pnpm run clean
   pnpm install
   pnpm run build
   pnpm run dev
   ```

## 故障排查

### 类型错误

```bash
# 只运行类型检查，快速定位问题
pnpm run typecheck
```

### 构建失败

```bash
# 检查具体哪个包构建失败
pnpm run build

# 单独构建某个包
pnpm run build --workspace=@remotion-fast/ui
```

### 清理重装

```bash
# 完全清理
pnpm run clean
rm -rf pnpm-lock.yaml

# 重新安装
pnpm install
pnpm run build
```

## 最佳实践

1. **在开始开发前运行 `pnpm run dev`**
2. **修改代码后等待几秒让 tsup 重新编译**
3. **提交前运行 `pnpm run verify`**
4. **遇到奇怪问题时，重启开发服务器**
