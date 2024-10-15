import { defineConfig } from 'vite';
import glsl from 'vite-plugin-glsl';

export default defineConfig({
  root: './examples',
  build: {
    outDir: '../dist-demo',
  },
  server: {
    port: 5173,
  },
  plugins: [glsl()]
});
