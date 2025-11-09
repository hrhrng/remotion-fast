# Remotion Fast - 项目构建和部署指南

## 🚀 快速开始

### 开发环境要求
- Node.js >= 20
- pnpm >= 10

### 安装依赖
```bash
pnpm install
```

### 开发模式
```bash
# 启动开发服务器
pnpm dev

# 或者使用 Makefile
make dev
```

## 📦 构建命令

### 包构建
```bash
# 构建所有包
pnpm build

# 仅构建 packages
pnpm build:packages

# 仅构建示例
pnpm build:examples
```

### 代码质量检查
```bash
# 代码检查
pnpm lint
pnpm lint:fix

# 格式化
pnpm format
pnpm format:check

# 类型检查
pnpm typecheck
```

### 测试
```bash
# 运行测试
pnpm test

# 监听模式
pnpm test:watch

# CI 模式（带覆盖率）
pnpm test:ci
```

## 🔄 版本管理

使用 Changesets 进行版本管理：

```bash
# 添加变更记录
pnpm changeset

# 更新版本
pnpm version-packages

# 发布包
pnpm release
```

## 🚀 部署

### GitHub Pages 部署

项目配置了自动部署到 GitHub Pages：

1. 推送到 `main` 分支会自动触发部署
2. 示例应用会部署到 `https://hrhrng.github.io/remotion-fast/`

### 手动部署

```bash
# 构建示例应用
pnpm --filter=basic-editor-example build

# 部署到 GitHub Pages（需要配置 gh-pages）
pnpm deploy
```

## 🔧 CI/CD 流水线

### CI 流程
1. **代码检查**: ESLint + Prettier + TypeScript
2. **测试**: Vitest 单元测试
3. **构建**: 构建所有包和示例

### 发布流程
1. **自动发布**: 基于 Changesets 的版本管理
2. **NPM 发布**: 自动发布到 NPM registry
3. **GitHub Releases**: 自动创建 GitHub releases

### 部署流程
1. **构建**: 构建示例应用
2. **部署**: 自动部署到 GitHub Pages

## 📁 项目结构

```
remotion-fast/
├── packages/                 # 核心包
│   ├── core/                # 核心状态管理
│   ├── ui/                  # UI 组件
│   └── remotion-components/ # Remotion 组件
├── examples/                # 示例应用
│   └── basic-editor/        # 基础编辑器示例
├── .github/workflows/       # GitHub Actions
├── .changeset/             # Changesets 配置
└── scripts/                # 构建脚本
```

## 🛠️ 开发工具配置

- **ESLint**: 代码检查
- **Prettier**: 代码格式化
- **Husky**: Git hooks
- **lint-staged**: 提交前检查
- **Vitest**: 单元测试
- **TypeScript**: 类型检查
- **Changesets**: 版本管理

## 📋 可用脚本

| 命令 | 描述 |
|------|------|
| `pnpm dev` | 启动开发服务器 |
| `pnpm build` | 构建所有包 |
| `pnpm test` | 运行测试 |
| `pnpm lint` | 代码检查 |
| `pnpm format` | 格式化代码 |
| `pnpm typecheck` | 类型检查 |
| `pnpm clean` | 清理构建产物 |
| `pnpm changeset` | 添加变更记录 |
| `pnpm release` | 发布包 |

## 🔗 相关链接

- [Remotion 文档](https://www.remotion.dev/)
- [pnpm 文档](https://pnpm.io/)
- [Changesets 文档](https://github.com/changesets/changesets)