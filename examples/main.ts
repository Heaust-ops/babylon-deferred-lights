import * as BABYLON from "@babylonjs/core";
import { DeferredPointLight, DeferredRectAreaLight } from "../src";

const randomize = (light: any) => {
  const r = Math.random;
  const scale = 50;
  light.position = new BABYLON.Vector3(
    (r() - 0.5) * 2 * scale,
    (r() - 0.5) * 2 * scale,
    (r() - 0.5) * 2 * scale,
  );
  light.intensity = r() * r();
  light.color = new BABYLON.Color3(r(), r(), r());
};

(window as any).BABYLON = BABYLON;

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

  multiViewPortDemo() {
    this.makeArcRotateCamera();

    const camera2 = new BABYLON.ArcRotateCamera(
      "camera2",
      0,
      0,
      10,
      new BABYLON.Vector3(0, 2, 0),
      this.scene,
    );
    camera2.position = new BABYLON.Vector3(0, 10, 0);
    camera2.target = new BABYLON.Vector3(0, 0, 0);

    (window as any).c1 = this.camera;
    (window as any).c2 = camera2;

    this.camera.onDisposeObservable.add(() => {
      camera2.dispose();
    });

    this.camera.viewport = new BABYLON.Viewport(0, 0, 1, 1);
    camera2.viewport = new BABYLON.Viewport(0, 0.5, 1, 1);

    if (this.scene.activeCameras)
      this.scene.activeCameras.push(this.camera, camera2);
    else {
      console.log("heh?");
    }

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

    const standardPipeline = new BABYLON.PostProcessRenderPipeline(
      this.scene.getEngine(),
      "standardPipeline",
    );

    DeferredPointLight.TOTAL_LIGHTS_ALLOWED = 1024 * 50;
    DeferredPointLight.enable(
      this.scene,
      BABYLON.Effect.ShadersStore,
      null,
      null,
      false,
    );

    const re = new BABYLON.PostProcessRenderEffect(
      this.scene.getEngine(),
      "e1",
      () => DeferredPointLight.postProcess,
    );
    standardPipeline.addEffect(re);

    this.scene.postProcessRenderPipelineManager.addPipeline(standardPipeline);
    this.scene.postProcessRenderPipelineManager.attachCamerasToRenderPipeline(
      "standardPipeline",
      [this.camera, camera2],
    );
  }

  private makeArcRotateCamera() {
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
  }

  multiCubeDemo() {
    this.makeArcRotateCamera();
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

  thousandSunsDemo(numLights = 500, numSpheres = 10_000) {
    this.makeRandomSpheres(numSpheres);
    for (let i = 0; i < numLights; i++) {
      const id = DeferredPointLight.add();
      randomize(DeferredPointLight.getById(id)!);
    }

    if ((window as any).sphereListener) {
      window.removeEventListener("keypress", (window as any).sphereListener);
    }
    (window as any).sphereListener = (e: KeyboardEvent) => {
      if (e.key !== "r") return;
      DeferredPointLight.getAll().forEach((l) => randomize(l));
    }

    window.addEventListener("keypress", (window as any).sphereListener);
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

  rectAreaLightDemo() {
    const scene = this.scene;

    this.makeArcRotateCamera();
    (this.camera as BABYLON.ArcRotateCamera).beta = Math.PI / 3;
    (this.camera as BABYLON.ArcRotateCamera).radius = 100;

    DeferredRectAreaLight.TOTAL_LIGHTS_ALLOWED = 1024 * 50;
    const pp = DeferredRectAreaLight.enable(
      scene,
      BABYLON.Effect.ShadersStore,
      this.camera,
      null,
      false,
      1,
      false
    );


    const light = new BABYLON.HemisphericLight("light1", new BABYLON.Vector3(0, 1, 0), scene);
    light.intensity = 0.001;

    (window as any).dral = DeferredRectAreaLight;

    const gr = () => {
      const r = (Math.random() - 0.5) * 100;
      return r;
    }

    // for (let i = 0; i < 20; i++) {
    const rectAreaLight = new DeferredRectAreaLight({
      position: new BABYLON.Vector3(gr(), Math.random() * 2 + 1, gr()),
      isTwoSided: true,
      intensity: Math.random() * 0.3 + 0.5,
      color: new BABYLON.Color3(...(new BABYLON.Vector3(...BABYLON.Color3.Random().asArray())).normalize().asArray()),
      scaling: new BABYLON.Vector2(4, 4)
    });
    rectAreaLight.setRotation(0, 0, 0);

    DeferredRectAreaLight.add(rectAreaLight);
    // }


    const ground = BABYLON.MeshBuilder.CreateGround("ground", { width: 100, height: 100 }, scene);
    ground.position = new BABYLON.Vector3(0, 0, 0);

    const groundMat = new BABYLON.StandardMaterial("groundMat");
    groundMat.backFaceCulling = false;
    ground.material = groundMat;
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
      case 3:
        this.multiViewPortDemo();
        break;
      case 4:
        this.rectAreaLightDemo();
        break;
    }

    const fpsel = document.getElementById("fps")!;
    const avgArr = new Array(60).fill(60);

    const refreshTime = 1e3; // ms

    let prevTime = Date.now();
    this.scene.onBeforeRenderObservable.add(() => {
      avgArr.shift();
      avgArr.push(this.engine.getFps());

      const now = Date.now();
      if (now - prevTime < refreshTime) return;
      prevTime = now;
      fpsel.innerHTML = `fps: ${Math.floor(avgArr.reduce((a, b) => a + b) / avgArr.length)}`
    })

    return scene;
  }

  constructor(demo: number) {
    const canvas = document.getElementById("bblon")! as unknown as HTMLCanvasElement;
    this.canvas = canvas;

    const engine = new BABYLON.Engine(canvas, true);

    DeferredPointLight.reset();
    DeferredRectAreaLight.reset();

    const scene = this.createScene(engine, canvas, demo);
    if (demo !== 3) {
      DeferredPointLight.TOTAL_LIGHTS_ALLOWED = 1024 * 50;
      DeferredPointLight.enable(
        scene,
        BABYLON.Effect.ShadersStore,
        scene.activeCamera,
        null,
        false,
      );
    }
    (window as any).deferredPointLight = DeferredPointLight;
    (window as any).scene = scene;

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
document.getElementById("demo-mvp")?.addEventListener("click", () => {
  app.dispose();
  app = new App(3);
});
document.getElementById("demo-rad")?.addEventListener("click", () => {
  app.dispose();
  app = new App(4);
});
