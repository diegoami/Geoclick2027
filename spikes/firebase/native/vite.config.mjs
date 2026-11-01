import { defineConfig } from 'vite';

export default defineConfig({
  envDir: '..',
  clearScreen: false,
  server: { watch: { ignored: ['**/src-tauri/**'] } },
  build: { outDir: 'dist', emptyOutDir: true }
});
