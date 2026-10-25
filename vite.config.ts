import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  server: {
    port: 5173,
    // Documents, build output and logs change constantly (agent edits, compiles);
    // watching them made Vite reload the page.
    watch: {
      ignored: ['**/projects/**', '**/.logs/**', '**/dist/**', '**/.*_test*/**', '**/*.{tex,bib,pdf,gz,log,aux}'],
    },
    proxy: {
      '/api': {
        target: process.env.API_TARGET || 'http://localhost:3001',
        changeOrigin: true,
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
