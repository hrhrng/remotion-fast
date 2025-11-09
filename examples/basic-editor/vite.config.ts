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
  resolve: {
    alias: {
      '@remotion-fast/core': path.resolve(__dirname, '../../packages/core/src'),
      '@remotion-fast/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@remotion-fast/remotion-components': path.resolve(__dirname, '../../packages/remotion-components/src'),
    },
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
