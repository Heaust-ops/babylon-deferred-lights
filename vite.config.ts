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
      ],
      output: {
        globals: {
          "@babylonjs/core/Maths/math.vector": "BABYLON.Vector3",
          "@babylonjs/core/Maths/math.color": "BABYLON.Color3",
          "@babylonjs/core/Rendering/geometryBufferRenderer":
            "BABYLON.GeometryBufferRenderer",
          "@babylonjs/core/Materials/Textures/texture": "BABYLON.Texture",
          "@babylonjs/core/Engines/constants": "BABYLON.Constants",
          "@babylonjs/core/Materials/Textures/rawTexture": "BABYLON.RawTexture",
          "@babylonjs/core/PostProcesses/postProcess": "BABYLON.PostProcess",
        },
      },
    },
  },
  plugins: [
    glsl(),
    dts({
      outDir: "dist/types",
    }),
  ],
});
