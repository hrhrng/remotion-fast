.PHONY: dev build typecheck verify clean install restart kill help

# 默认目标
.DEFAULT_GOAL := help

## 开发相关命令

# 启动热更新开发服务器
dev:
	@echo "🚀 Starting development server with hot reload..."
	pnpm run dev

# 重启开发服务器
restart: kill
	@echo "🔄 Restarting development server..."
	@sleep 2
	pnpm run dev

# 停止所有相关进程
kill:
	@echo "🛑 Stopping all dev servers..."
	-@pkill -f "vite" || true
	-@pkill -f "tsup" || true
	-@pkill -f "concurrently" || true
	@echo "✅ All dev servers stopped"

## 构建相关命令

# 构建所有包
build:
	@echo "🏗️  Building all packages..."
	pnpm run build

# 类型检查
typecheck:
	@echo "🔍 Running type check..."
	pnpm run typecheck

# 验证（类型检查 + 构建）
verify:
	@echo "✨ Running full verification..."
	@./scripts/verify.sh

## 安装和清理

# 安装依赖
install:
	@echo "📦 Installing dependencies..."
	pnpm install

# 清理所有构建产物和依赖
clean:
	@echo "🧹 Cleaning..."
	pnpm run clean
	@echo "✅ Clean complete"

# 完全重置（清理 + 重装 + 构建）
reset: clean
	@echo "🔄 Resetting project..."
	rm -rf pnpm-lock.yaml
	pnpm install
	pnpm run build
	@echo "✅ Reset complete"

## 帮助

# 显示帮助信息
help:
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo "  Remotion Fast - Development Commands"
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
	@echo ""
	@echo "🚀 Development:"
	@echo "  make dev       - Start hot-reload dev server"
	@echo "  make restart   - Restart dev server"
	@echo "  make kill      - Stop all dev servers"
	@echo ""
	@echo "🏗️  Build & Test:"
	@echo "  make build     - Build all packages"
	@echo "  make typecheck - Run TypeScript type check"
	@echo "  make verify    - Type check + build"
	@echo ""
	@echo "📦 Install & Clean:"
	@echo "  make install   - Install dependencies"
	@echo "  make clean     - Clean build artifacts"
	@echo "  make reset     - Complete reset (clean + reinstall + build)"
	@echo ""
	@echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
