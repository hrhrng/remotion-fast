import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const base = process.env.VITE_BASE ?? '/';

  return {
    base, // ✅ 支持 GitHub Pages 子路径
    plugins: [react()],
    server: {
      port: 3001,
    },
  };
});
