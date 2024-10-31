import glsl from "vite-plugin-glsl";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
  build: {
    lib: {
      entry: "./src/index.ts",
      name: "DeferredLighting",
      fileName: (format) => `deferredLighting.${format}.js`,
      formats: ["es", "cjs", "umd"],
    },
    rollupOptions: {
      external: [
        "@babylonjs/core",
        "@babylonjs/core/Maths/math.vector",
        "@babylonjs/core/Maths/math.color",
        "@babylonjs/core/Rendering/geometryBufferRenderer",
        "@babylonjs/core/Materials/Textures/texture",
        "@babylonjs/core/Engines/constants",
        "@babylonjs/core/Materials/Textures/rawTexture",
        "@babylonjs/core/PostProcesses/postProcess",
        "@babylonjs/core/Rendering/prePassRendererSceneComponent",
        "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent",
        "@babylonjs/core/scene",
        "@babylonjs/core/Cameras/camera",
        "@babylonjs/core/Maths/math.frustum",
      ],
      output: {
        globals: {
          "@babylonjs/core": "BABYLON",
          // All specific imports will fall under the BABYLON namespace
          "@babylonjs/core/Maths/math.vector": "BABYLON",
          "@babylonjs/core/Maths/math.color": "BABYLON",
          "@babylonjs/core/Rendering/geometryBufferRenderer": "BABYLON",
          "@babylonjs/core/Materials/Textures/texture": "BABYLON",
          "@babylonjs/core/Engines/constants": "BABYLON",
          "@babylonjs/core/Materials/Textures/rawTexture": "BABYLON",
          "@babylonjs/core/PostProcesses/postProcess": "BABYLON",
          "@babylonjs/core/Rendering/prePassRendererSceneComponent": "BABYLON",
          "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent":
            "BABYLON",
          "@babylonjs/core/scene": "BABYLON",
          "@babylonjs/core/Cameras/camera": "BABYLON",
          "@babylonjs/core/Maths/math.frustum": "BABYLON",
        },
      },
    },
  },
  plugins: [
    glsl({ compress: true }),
    dts({
      outDir: "dist/types",
    }),
  ],
});
