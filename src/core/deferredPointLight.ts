import { Vector3 } from "@babylonjs/core/Maths/math.vector";
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

import pointLightFrag from "./shaders/pointLight/main.glsl";
import { AbstractDeferredLight } from "./abstractDeferredLight";

type DeferredPointLightParams = {
  color: Color3;
  position: Vector3;
  intensity: number;
  range: number;
};

class DeferredPointLight extends AbstractDeferredLight {
  private _color = new Color3(0, 1, 1);
  get color() {
    return this._color;
  }
  set color(arg: Color3) {
    this._color = arg;
    DeferredPointLight.update();
  }

  get position() {
    return this._position;
  }
  set position(arg: Vector3) {
    this._position = arg;
    DeferredPointLight.update();
  }

  get range() {
    return this._range;
  }
  set range(arg: number) {
    this._range = arg;
    DeferredPointLight.update();
  }

  private _intensity = 0.05;
  get intensity() {
    return this._intensity;
  }
  set intensity(arg: number) {
    this._intensity = arg;
    DeferredPointLight.update();
  }

  static MAX_TEXTURE_SIZE: number;

  override clone() {
    const newLight = new DeferredPointLight({
      color: this.color,
      position: this.position,
      intensity: this.intensity,
      range: this.range,
    });
    return newLight;
  }

  constructor(options: Partial<DeferredPointLightParams> = {}) {
    super();
    this.color = options.color ?? this.color;
    this.position = options.position ?? this.position;
    this.intensity = options.intensity ?? this.intensity;
    this.range = options.range ?? this.range;
  }

  static override add(
    pointLightOrParams?: DeferredPointLight | Partial<DeferredPointLightParams>,
  ): number {
    if (pointLightOrParams instanceof DeferredPointLight) {
      this.lights[pointLightOrParams.uniqueId] = pointLightOrParams;
      return pointLightOrParams.uniqueId;
    }

    const newLight = new DeferredPointLight(pointLightOrParams);
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

  private static getDataBuffer(lights: DeferredPointLight[]) {
    const buffer = [];

    for (const l of lights) {
      const ci = l.getColorIntensityArray();
      const p = l.getPositionArray();

      buffer.push(...ci, ...p);
    }

    const { width, height } = DeferredPointLight.getTextureDimensionsByUnits(
      this.MAX_TEXTURE_SIZE,
      this.TOTAL_LIGHTS_ALLOWED,
      8,
    );
    const pixelCapacity = width * height;
    const paddingLength = DeferredPointLight.getPaddingLength(
      buffer.length,
      pixelCapacity,
    );

    if (this.previousPadding?.length !== paddingLength) {
      this.previousPadding = new Array(paddingLength).fill(0);
    }

    const padding = this.previousPadding;

    return new Float32Array(buffer.concat(padding));
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

    const { width, height } = DeferredPointLight.getTextureDimensionsByUnits(
      this.MAX_TEXTURE_SIZE,
      this.TOTAL_LIGHTS_ALLOWED,
      8,
    );

    const pointLightsDataTexture = RawTexture.CreateRGBATexture(
      this.getDataBuffer([]),
      width,
      height,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
      Engine.TEXTURETYPE_FLOAT,
    );

    (window as any).pl = pointLightsDataTexture;

    let defines = "";

    defines += `precision highp float;
#define TOTAL_LIGHTS_ALLOWED ${this.TOTAL_LIGHTS_ALLOWED}.0
#define POINTS_DATA_TEXTURE_WIDTH ${width}.0
#define POINTS_DATA_TEXTURE_HEIGHT ${height}.0
#define RECIPROCAL_PI 0.318309886
`;

    if (this.isPerformanceMode)
      defines += `#define IS_PERFORMANCE_MODE 1
#define TOTAL_PERFORMANCE_LIGHTS_ALLOWED ${this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED}
`;

    if (isUsingGeometryBufferRenderer)
      defines += `
#define IS_USING_GBUFFER 1
`;

    const frag = defines + pointLightFrag;
    shadersStore["deferredPointLightsFragmentShader"] = frag;

    const postProcess = new PostProcess(
      "Deferred Point Lights",
      "deferredPointLights",
      ["lights_len", "camera_position", "screenSize"].concat(
        this.isPerformanceMode
          ? ["lights_position_range", "lights_color_intensity"]
          : [],
      ),
      ["nBuffer", "pBuffer", "rBuffer"].concat(
        this.isPerformanceMode ? [] : ["point_lights_data"],
      ),
      1,
      camera ?? null,
      undefined,
      scene.getEngine(),
    );
    this.postProcess = postProcess;

    if (!isUsingGeometryBufferRenderer) {
      this.postProcess._prePassEffectConfiguration = {
        enabled: true,
        name: "__deferredPointLights__",
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
    };

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
      }) as DeferredPointLight[];

      if (!this.isPerformanceMode && this.needsUpdate) {
        pointLightsDataTexture.update(this.getDataBuffer(allLights));
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
      } else {
        e.setTexture("point_lights_data", pointLightsDataTexture);
      }

      e.setInt("lights_len", allLights.length);

      e.setFloat2(
        "screenSize",
        this.postProcess!.width,
        this.postProcess!.height,
      );
    };
  }
}

export type { DeferredPointLightParams };
export { DeferredPointLight };
