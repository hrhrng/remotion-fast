#!/bin/bash
set -e

echo "🔍 Running type check..."
pnpm run typecheck

echo "✅ Type check passed!"

echo "🏗️  Building packages..."
pnpm run build

echo "✅ Build successful!"

echo "🎉 All checks passed!"
