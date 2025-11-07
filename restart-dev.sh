#!/bin/bash

# Remotion Fast - Development Server Restart Script
# This script stops all running dev processes and restarts them with full watch mode

echo "🔄 Restarting Remotion Fast development environment..."

# Step 1: Kill all processes on port 3001
echo "📛 Stopping existing processes on port 3001..."
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Step 2: Kill any existing tsup/vite processes
echo "📛 Stopping existing tsup and vite processes..."
pkill -f "tsup.*remotion-fast" 2>/dev/null || true
pkill -f "vite.*remotion-fast" 2>/dev/null || true

# Wait a moment for processes to fully terminate
sleep 1

# Get the script directory (project root)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Step 3: Start core package watch
echo "🔨 Starting @remotion-fast/core watch mode..."
(cd "$SCRIPT_DIR/packages/core" && npm run dev > /dev/null 2>&1) &
CORE_PID=$!

# Step 4: Start ui package watch
echo "🎨 Starting @remotion-fast/ui watch mode..."
(cd "$SCRIPT_DIR/packages/ui" && npm run dev > /dev/null 2>&1) &
UI_PID=$!

# Step 5: Start dev server
echo "🚀 Starting development server..."
(cd "$SCRIPT_DIR/examples/basic-editor" && npm run dev) &
DEV_PID=$!

# Wait for services to start
sleep 2

# Step 6: Verify all processes are running
echo ""
echo "✅ Development environment restarted!"
echo ""
echo "📦 Running processes:"
ps aux | grep -E "tsup|vite" | grep -v grep | awk '{print "   - " $11 " " $12 " " $13 " " $14 " " $15}' | head -5

echo ""
echo "🌐 Server: http://localhost:3001/"
echo ""
echo "💡 Tips:"
echo "   - Press Ctrl+C to stop all processes"
echo "   - Run 'npm run clean' to clear build cache"
echo "   - Run './restart-dev.sh' to restart services"
echo ""
