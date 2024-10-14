import { defineConfig } from 'vite';

export default defineConfig({
  root: './examples',
  build: {
    outDir: '../dist-demo',
  },
  server: {
    port: 5173,
  },
});
