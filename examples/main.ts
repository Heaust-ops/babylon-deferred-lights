import * as BABYLON from "@babylonjs/core";
import { DeferredPointLight } from "../src";

const randomize = (light: any) => {
  const r = Math.random;
  const scale = 75;
  light.position = new BABYLON.Vector3(
    (r() - 0.5) * 2 * scale,
    (r() - 0.5) * 2 * scale,
    (r() - 0.5) * 2 * scale,
  );
  light.intensity = r() * r();
  light.color = new BABYLON.Color3(r(), r(), r());
};

class App {
  camera: BABYLON.Camera;
  scene: BABYLON.Scene;
  engine: BABYLON.Engine;
  canvas: HTMLCanvasElement;

  private setupLight(useDefLight: boolean) {
    const position = new BABYLON.Vector3(0, 1.5, 0);
    const color = BABYLON.Color3.Red();
    const intensity = 0.2;
    const range = 2;

    if (useDefLight) {
      const testLight = new DeferredPointLight({
        position,
        color,
        intensity,
      });

      testLight.range = range;

      DeferredPointLight.add(testLight);

      return testLight;
    } else {
      const light = new BABYLON.PointLight("light", position, this.scene);
      light.diffuse = color;
      light.intensity = intensity * 10;

      return light;
    }
  }

  multiCubeDemo() {
    this.camera.dispose();
    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      0,
      Math.PI / 2,
      10,
      BABYLON.Vector3.Zero(),
      this.scene,
    );
    (this.camera as BABYLON.ArcRotateCamera).setTarget(BABYLON.Vector3.Zero());
    this.camera.attachControl(this.canvas, true);
    const matPBR = new BABYLON.PBRMaterial("");

    const matStd = new BABYLON.StandardMaterial("");
    matPBR.metallic = 0.2;
    matPBR.roughness = 0.23;
    for (let i = -3; i <= 3; i++) {
      for (let j = -3; j <= 3; j++) {
        const b = BABYLON.MeshBuilder.CreateBox("box", { size: 0.5 });
        b.position.set(i, (i + j - 1) % 2 === 0 ? 0.25 : 0, j);
        b.material = (i + j - 1) % 2 === 0 ? matStd : matPBR;
      }
    }

    const light = this.setupLight(true) as any;
    const scaling = light.range ? light.range * 2 : 0;

    if (1) {
      const debugOverlay = BABYLON.MeshBuilder.CreateSphere("dbov", {
        diameter: 1,
      });
      debugOverlay.position.copyFrom(light.position);
      debugOverlay.scaling.setAll(scaling);
      debugOverlay.visibility = 0.3;
    }

    this.scene.createDefaultEnvironment();
    this.scene.environmentIntensity = 0.14; // (debugNode as BABYLON.Scene)
  }

  makeRandomSpheres(numSpheres = 10_000) {
    const sphere = BABYLON.MeshBuilder.CreateSphere(
      "sphere",
      { diameter: 1, segments: 32 },
      this.scene,
    );

    const getRandom = (range = 50) => {
      const r = (Math.random() - 0.5) * 2;
      return r * range + r;
    };

    for (let i = 0; i < numSpheres; i++) {
      const ni = sphere.createInstance(i + "si");
      ni.position.x = getRandom();
      ni.position.y = getRandom();
      ni.position.z = getRandom();
    }
  }

  thousandSunsDemo(numLights = 100, numSpheres = 10_000) {
    this.makeRandomSpheres(numSpheres);
    for (let i = 0; i < numLights; i++) {
      const id = DeferredPointLight.add();
      randomize(DeferredPointLight.getById(id)!);
    }

    window.addEventListener("keypress", (e) => {
      if (e.key !== "r") return;
      DeferredPointLight.getAll().forEach((l) => randomize(l));
    });
  }

  followCubeDemo() {
    const box = BABYLON.MeshBuilder.CreateBox(
      "light-tracer-00",
      { size: 1 },
      this.scene,
    );

    const pl = new DeferredPointLight();
    DeferredPointLight.add(pl);

    this.scene.onBeforeRenderObservable.add(() => {
      box.position.x = 3 * Math.sin(Date.now() / 1e3);
      box.position.z = 3 * Math.cos(Date.now() / 1e3);
      pl.position = box.position.clone();
      pl.position.y += 1.001;
    });
  }

  createScene(engine: BABYLON.Engine, canvas: HTMLCanvasElement, demo: number) {
    const scene = new BABYLON.Scene(engine);
    (window as any).scene = scene;

    const camera = new BABYLON.FreeCamera(
      "camera1",
      new BABYLON.Vector3(0, 5, -10),
      scene,
    );

    this.camera = camera;
    this.scene = scene;
    this.engine = engine;

    camera.attachControl(canvas, true);

    switch (demo) {
      case 0:
        this.thousandSunsDemo(500);
        break;
      case 1:
        this.followCubeDemo();
        break;
      case 2:
        this.multiCubeDemo();
        break;
    }

    return scene;
  }

  constructor(demo: number) {
    const canvas = document.getElementById("bblon") as HTMLCanvasElement;
    this.canvas = canvas;

    const engine = new BABYLON.Engine(canvas, true);

    DeferredPointLight.reset();
    const scene = this.createScene(engine, canvas, demo);
    DeferredPointLight.enable(
      scene,
      BABYLON.Effect.ShadersStore,
      null,
      null,
      false,
    );
    (window as any).deferredPointLight = DeferredPointLight;

    engine.runRenderLoop(() => {
      scene.render();
    });
  }

  dispose() {
    this.scene.dispose();
    this.engine.dispose();
  }
}

let app = new App(2);

document.getElementById("demo-spheres")?.addEventListener("click", () => {
  app.dispose();
  app = new App(0);
});
document.getElementById("demo-track")?.addEventListener("click", () => {
  app.dispose();
  app = new App(1);
});
document.getElementById("demo-pbr")?.addEventListener("click", () => {
  app.dispose();
  app = new App(2);
});
