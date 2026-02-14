import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('./renderer', import.meta.url));
const outDir = fileURLToPath(new URL('./dist/renderer', import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  base: './',
  build: {
    outDir,
    emptyOutDir: true,
  },
  server: {
    port: 5170,
    strictPort: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(root, 'src'),
    },
  },
});
