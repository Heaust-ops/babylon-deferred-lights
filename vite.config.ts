import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'DeferredLighting',
      fileName: (format) => `deferredLighting.${format}.js`,
      formats: ['es', 'cjs', 'umd'],
    },
    rollupOptions: {
      external: [],
    },
  },
  plugins: [dts({
    outDir: 'dist/types'
  })],
});
