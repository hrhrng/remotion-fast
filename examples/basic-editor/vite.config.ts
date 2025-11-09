import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE || '/',
  server: {
    port: 3001,
    watch: {
      // 监听 workspace 包的变化
      ignored: ['!**/node_modules/@remotion-fast/**'],
    },
  },
  optimizeDeps: {
    // 排除 workspace 包，使其始终使用最新编译结果
    exclude: ['@remotion-fast/core', '@remotion-fast/ui', '@remotion-fast/remotion-components'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          remotion: ['remotion', '@remotion/player'],
        },
      },
    },
  },
});
