import { Quaternion, Vector2, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { GeometryBufferRenderer } from "@babylonjs/core/Rendering/geometryBufferRenderer";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Constants } from "@babylonjs/core/Engines/constants";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { Frustum } from "@babylonjs/core/Maths/math.frustum";
import { Engine } from "@babylonjs/core/Engines/engine";

import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";

import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { PostProcessOptions } from "@babylonjs/core/PostProcesses/postProcess";

import lightFrag from "./shaders/rectAreaLight/main.glsl";
import { AbstractDeferredLight } from "./abstractDeferredLight";
import { g_ltc_1 } from "./ltc/ltc";

type DeferredRectAreaLightParams = {
  color: Color3;
  position: Vector3;
  rotation: Vector3;
  isTwoSided: boolean;
  scaling: Vector2;
  intensity: number;
  range: number;
};

class DeferredRectAreaLight extends AbstractDeferredLight {
  private _color = new Color3(0, 1, 1);
  get color() {
    return this._color;
  }
  set color(arg: Color3) {
    this._color = arg;
    DeferredRectAreaLight.update();
  }

  get position() {
    return this._position;
  }
  set position(arg: Vector3) {
    this._position = arg;
    DeferredRectAreaLight.update();
  }

  get range() {
    return this._range;
  }
  set range(arg: number) {
    this._range = arg;
    DeferredRectAreaLight.update();
  }

  private _intensity = 0.05;
  get intensity() {
    return this._intensity;
  }
  set intensity(arg: number) {
    this._intensity = arg;
    DeferredRectAreaLight.update();
  }

  private _rotationQuaternion = new Quaternion();
  get rotationQuaternion() {
    return this._rotationQuaternion;
  }
  set rotationQuaternion(arg: Quaternion) {
    this._rotationQuaternion = arg;
    DeferredRectAreaLight.update();
  }

  rotateX(angle: number) {
    const factor = Quaternion.RotationAxis(Vector3.Right(), angle);
    this.rotationQuaternion = this.rotationQuaternion.multiply(factor).normalize();
  }
  rotateY(angle: number) {
    const factor = Quaternion.RotationAxis(Vector3.Up(), angle);
    this.rotationQuaternion = this.rotationQuaternion.multiply(factor).normalize();
  }
  rotateZ(angle: number) {
    const factor = Quaternion.RotationAxis(Vector3.Forward(), angle);
    this.rotationQuaternion = this.rotationQuaternion.multiply(factor).normalize();
  }
  setRotation(x: number, y: number, z: number) {
    const factorX = Quaternion.RotationAxis(Vector3.Right(), x);
    const factorY = Quaternion.RotationAxis(Vector3.Up(), y);
    const factorZ = Quaternion.RotationAxis(Vector3.Forward(), z);

    this.rotationQuaternion = new Quaternion().multiply(factorX).multiply(factorY).multiply(factorZ).normalize();
  }

  private _scaling = Vector2.One();
  get scaling() {
    return this._scaling;
  }
  set scaling(arg: Vector2) {
    this._scaling = arg;
    DeferredRectAreaLight.update();
  }

  private _isTwoSided = false;
  get isTwoSided() {
    return this._isTwoSided;
  }
  set isTwoSided(arg: boolean) {
    this._isTwoSided = arg;
    DeferredRectAreaLight.update();
  }

  static MAX_TEXTURE_SIZE: number;

  override clone() {
    const newLight = new DeferredRectAreaLight({
      color: this.color,
      position: this.position,
      intensity: this.intensity,
      range: this.range,
      isTwoSided: this.isTwoSided,
      scaling: this.scaling
    });

    newLight.rotationQuaternion = this.rotationQuaternion;
    return newLight;
  }

  constructor(options: Partial<DeferredRectAreaLightParams> = {}) {
    super();
    this.color = options.color ?? this.color;
    this.position = options.position ?? this.position;
    this.intensity = options.intensity ?? this.intensity;

    this.range = options.range ?? 0;

    this.isTwoSided = options.isTwoSided ?? this.isTwoSided;
    this.scaling = options.scaling ?? this.scaling;

    if (options.rotation) {
      this.setRotation(options.rotation.x, options.rotation.y, options.rotation.z);
    }
  }

  static override add(
    lightOrParams?: DeferredRectAreaLight | Partial<DeferredRectAreaLightParams>,
  ): number {
    if (lightOrParams instanceof DeferredRectAreaLight) {
      this.lights[lightOrParams.uniqueId] = lightOrParams;
      return lightOrParams.uniqueId;
    }

    const newLight = new DeferredRectAreaLight(lightOrParams);
    return this.add(newLight);
  }

  /**
   * DATA BUFFERS
   */

  private getPositionArray() {
    return [this.position.x, this.position.y, this.position.z, this.range];
  }

  private getColorIntensityArray() {
    return [this.color.r, this.color.g, this.color.b, this.intensity];
  }

  // ci
  // posrange
  // quaternion
  // w h bool(2 sided? clipless?) null

  private static updateDataBuffer(lights: DeferredRectAreaLight[]) {
    for (let i = 0; i < lights.length; i++) {
      const ci = lights[i].getColorIntensityArray();
      const p = lights[i].getPositionArray();
      const q = lights[i].rotationQuaternion;
      const sc = lights[i].scaling;

      this.lightsArrayBuffer[i * 16 + 0] = ci[0];
      this.lightsArrayBuffer[i * 16 + 1] = ci[1];
      this.lightsArrayBuffer[i * 16 + 2] = ci[2];
      this.lightsArrayBuffer[i * 16 + 3] = ci[3];

      this.lightsArrayBuffer[i * 16 + 4] = p[0];
      this.lightsArrayBuffer[i * 16 + 5] = p[1];
      this.lightsArrayBuffer[i * 16 + 6] = p[2];
      this.lightsArrayBuffer[i * 16 + 7] = p[3];

      this.lightsArrayBuffer[i * 16 + 8] = q.x;
      this.lightsArrayBuffer[i * 16 + 9] = q.y;
      this.lightsArrayBuffer[i * 16 + 10] = q.z;
      this.lightsArrayBuffer[i * 16 + 11] = q.w;

      this.lightsArrayBuffer[i * 16 + 12] = sc.x;
      this.lightsArrayBuffer[i * 16 + 13] = sc.y;
      this.lightsArrayBuffer[i * 16 + 14] = +lights[i].isTwoSided;
      this.lightsArrayBuffer[i * 16 + 15] = 0;
    }
  }

  private static getLTCTextures(scene: Scene) {
    const ltc1tex = RawTexture.CreateRGBATexture(
      new Float32Array(g_ltc_1),
      64,
      64,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
      Engine.TEXTURETYPE_FLOAT,
    );

    const ltc2tex = RawTexture.CreateRGBATexture(
      new Float32Array(g_ltc_1),
      64,
      64,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
      Engine.TEXTURETYPE_FLOAT,
    );

    return [ltc1tex, ltc2tex];
  }

  /**
   * ENABLE
   */

  static enable(
    scene: Scene,
    shadersStore: { [key: string]: string },
    camera?: Camera | null,
    geometryBufferRenderer?: GeometryBufferRenderer | null,
    isPerformanceMode = false,
    postProcessOptions: number | PostProcessOptions = 1,
    useCliplessApproximation = false
  ) {
    this.MAX_TEXTURE_SIZE = scene.getEngine().getCaps().maxTextureSize;
    this.isPerformanceMode = isPerformanceMode;

    const isUsingGeometryBufferRenderer = !!geometryBufferRenderer;

    let getGTextures: () => Texture[];

    if (isUsingGeometryBufferRenderer) {
      geometryBufferRenderer.enablePosition = true;
      geometryBufferRenderer.enableReflectivity = true;
      geometryBufferRenderer.generateNormalsInWorldSpace = true;

      const gBuffer = geometryBufferRenderer.getGBuffer();

      getGTextures = () => {
        const nIdx = geometryBufferRenderer.getTextureIndex(
          GeometryBufferRenderer.NORMAL_TEXTURE_TYPE,
        );
        const pIdx = geometryBufferRenderer.getTextureIndex(
          GeometryBufferRenderer.POSITION_TEXTURE_TYPE,
        );
        const rIdx = geometryBufferRenderer.getTextureIndex(
          GeometryBufferRenderer.REFLECTIVITY_TEXTURE_TYPE,
        );
        return [
          gBuffer.textures[nIdx],
          gBuffer.textures[pIdx],
          gBuffer.textures[rIdx],
        ];
      };
    } else {
      const prePassRenderer = scene.enablePrePassRenderer();
      if (!prePassRenderer) {
        throw new Error("failed to make preprass renderer");
      }

      prePassRenderer.doNotUseGeometryRendererFallback = true;
      prePassRenderer.generateNormalsInWorldSpace = true;

      getGTextures = () => {
        const nIdx = prePassRenderer.getIndex(
          Constants.PREPASS_NORMAL_TEXTURE_TYPE,
        );
        const pIdx = prePassRenderer.getIndex(
          Constants.PREPASS_POSITION_TEXTURE_TYPE,
        );
        const rIdx = prePassRenderer.getIndex(
          Constants.PREPASS_REFLECTIVITY_TEXTURE_TYPE,
        );
        return [
          prePassRenderer.getRenderTarget().textures[nIdx],
          prePassRenderer.getRenderTarget().textures[pIdx],
          prePassRenderer.getRenderTarget().textures[rIdx],
        ];
      };
    }

    const { width, height } = DeferredRectAreaLight.getTextureDimensionsByUnits(
      this.MAX_TEXTURE_SIZE,
      this.TOTAL_LIGHTS_ALLOWED,
      16,
    );

    this.lightsArrayBuffer = new Float32Array(
      new Array(width * height * 4).fill(0),
    );

    const lightsDataTexture = RawTexture.CreateRGBATexture(
      this.lightsArrayBuffer,
      width,
      height,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
      Engine.TEXTURETYPE_FLOAT,
    );

    let defines = "";

    defines += `precision highp float;
#define TOTAL_LIGHTS_ALLOWED ${this.TOTAL_LIGHTS_ALLOWED}.0
#define POINTS_DATA_TEXTURE_WIDTH ${width}.0
#define POINTS_DATA_TEXTURE_HEIGHT ${height}.0
`;

    if (this.isPerformanceMode)
      defines += `#define IS_PERFORMANCE_MODE 1
#define TOTAL_PERFORMANCE_LIGHTS_ALLOWED ${this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED}
`;

    if (isUsingGeometryBufferRenderer)
      defines += `
#define IS_USING_GBUFFER 1
`;

    if (useCliplessApproximation)
      defines += `
#define IS_USING_CLIPLESS_APPROX 1
`;

    const frag = defines + lightFrag;
    shadersStore["deferredRectAreaLightsFragmentShader"] = frag;

    const postProcess = new PostProcess(
      "Deferred Rect Area Lights",
      "deferredRectAreaLights",
      ["lights_len", "camera_position", "screenSize", "view"].concat(
        this.isPerformanceMode
          ? ["lights_position_range", "lights_color_intensity", "lights_quaternion", "lights_scaling_etal"]
          : [],
      ),
      ["nBuffer", "pBuffer", "rBuffer", "ltc_1", "ltc_2"].concat(
        this.isPerformanceMode ? [] : ["point_lights_data"],
      ),
      postProcessOptions,
      camera ?? null,
      undefined,
      scene.getEngine(),
    );
    this.postProcess = postProcess;

    if (!isUsingGeometryBufferRenderer) {
      this.postProcess._prePassEffectConfiguration = {
        enabled: true,
        name: "__deferredRectAreaLights__",
        texturesRequired: [
          Constants.PREPASS_POSITION_TEXTURE_TYPE,
          Constants.PREPASS_REFLECTIVITY_TEXTURE_TYPE,
          Constants.PREPASS_NORMAL_TEXTURE_TYPE,
        ],
      };
    }

    const updateCamera = (attachedCamera: Camera) => {
      const transformMatrix = attachedCamera.getTransformationMatrix();
      const frustum = Frustum.GetPlanes(transformMatrix);

      const e = postProcess.getEffect();

      this.updateActive(frustum);

      const cameraPos = attachedCamera.globalPosition;

      e.setFloat3("camera_position", cameraPos.x, cameraPos.y, cameraPos.z);
      e.setFloatArray("view", attachedCamera.getViewMatrix().asArray());
    };

    const [ltc1tex, ltc2tex] = this.getLTCTextures(scene);

    let cam = camera;
    postProcess.onActivateObservable.add((c) => {
      cam = c;
    });

    postProcess.onApply = (e) => {
      if (!cam) return;
      updateCamera(cam);

      const allLights = this.getAll({
        active: true,
        visible: true,
        capLength: true,
      }) as DeferredRectAreaLight[];

      if (!this.isPerformanceMode && this.needsUpdate) {
        this.updateDataBuffer(allLights);
        lightsDataTexture.update(this.lightsArrayBuffer);
        this.needsUpdate = false;
      }

      const gTextures = getGTextures();

      e.setTexture("nBuffer", gTextures[0]);
      e.setTexture("pBuffer", gTextures[1]);
      e.setTexture("rBuffer", gTextures[2]);

      if (this.isPerformanceMode) {
        e.setFloatArray4(
          "lights_position_range",
          allLights
            .map((l) => l.getPositionArray())
            .flatMap((a) => a as number[]),
        );
        e.setFloatArray4(
          "lights_color_intensity",
          allLights.map((l) => l.getColorIntensityArray()).flatMap((a) => a),
        );
        e.setFloatArray4(
          "lights_quaternion",
          allLights.map((l) => l.rotationQuaternion.asArray()).flatMap((a) => a),
        );
        e.setFloatArray3(
          "lights_scaling_etal",
          allLights.map((l) => [...l.scaling.asArray(), +l.isTwoSided]).flatMap((a) => a),
        );
      } else {
        e.setTexture("point_lights_data", lightsDataTexture);
      }

      e.setTexture("ltc_1", ltc1tex);
      e.setTexture("ltc_2", ltc2tex);

      e.setInt("lights_len", allLights.length);

      e.setFloat2(
        "screenSize",
        this.postProcess!.width,
        this.postProcess!.height,
      );
    };

    return postProcess;
  }
}

export type { DeferredRectAreaLightParams };
export { DeferredRectAreaLight };
