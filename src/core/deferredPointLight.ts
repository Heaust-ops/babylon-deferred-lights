import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { AbstractDeferredLight } from "./abstractDeferredLight";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Bits } from "./bits";
import { GeometryBufferRenderer } from "@babylonjs/core/Rendering/geometryBufferRenderer";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Constants } from "@babylonjs/core/Engines/constants";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { Effect } from "@babylonjs/core/Materials/effect";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";

import "@babylonjs/core/Rendering/prePassRendererSceneComponent";
import "@babylonjs/core/Rendering/geometryBufferRendererSceneComponent";

import type { Scene } from "@babylonjs/core/scene";
import type { Camera } from "@babylonjs/core/Cameras/camera";

import pointLightFrag from "./shaders/pointLight/main.glsl";

type DeferredPointLightParams = {
  color: Color3;
  position: Vector3;
  intensity: number;
  range: number;
};

class DeferredPointLight extends AbstractDeferredLight {
  color = new Color3(0, 1, 1);
  position = new Vector3(1, 0, 0);
  intensity = 0.05;

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

  private getPositionArray(isSplit = true) {
    if (isSplit) {
      return [
        Bits.splitNumber(this.position.x),
        Bits.splitNumber(this.position.y),
        Bits.splitNumber(this.position.z),
        Bits.splitNumber(this.range),
      ];
    }
    return [this.position.x, this.position.y, this.position.z, this.range];
  }

  private getColorIntensityArray(isTextureScaled = true) {
    const scale = isTextureScaled ? 255 : 1;
    return [
      this.color.r * scale,
      this.color.g * scale,
      this.color.b * scale,
      this.intensity * scale,
    ];
  }

  private static getDataBuffer(lights: DeferredPointLight[]) {
    const paddingArray = new Array(
      (this.TOTAL_LIGHTS_ALLOWED - lights.length) * 4,
    ).fill(1);

    const newCI = [];
    const posBufferX = [] as number[];
    const posBufferY = [] as number[];
    const posBufferZ = [] as number[];
    const rangeBuffer = [] as number[];

    for (const l of lights) {
      const ci = l.getColorIntensityArray();
      const p = l.getPositionArray() as number[][];

      for (let i = 0; i < 4; i++) {
        newCI.push(ci[i]);
        posBufferX.push(p[0][i]);
        posBufferY.push(p[1][i]);
        posBufferZ.push(p[2][i]);
        rangeBuffer.push(p[3][i]);
      }
    }

    const pixelBuffer = newCI
      .concat(paddingArray)
      .concat(posBufferX)
      .concat(paddingArray)
      .concat(posBufferY)
      .concat(paddingArray)
      .concat(posBufferZ)
      .concat(paddingArray)
      .concat(rangeBuffer)
      .concat(paddingArray);

    return new Uint8Array(pixelBuffer);
  }

  /**
   * ENABLE
   */

  static enable(
    scene: Scene,
    camera?: Camera | null,
    geometryBufferRenderer?: GeometryBufferRenderer | null,
    isPerformanceMode = false,
  ) {
    this.isPerformanceMode = isPerformanceMode;

    const isUsingGeometryBufferRenderer = !!geometryBufferRenderer;

    camera = camera ?? scene.activeCamera;
    if (!camera) throw new Error("No Camera Found");

    this.attachedCamera = camera;

    let getGTextures: () => Texture[];

    if (isUsingGeometryBufferRenderer) {
      geometryBufferRenderer.enablePosition = true;
      geometryBufferRenderer.enableReflectivity = true;
      geometryBufferRenderer.generateNormalsInWorldSpace = true;

      const gBuffer = geometryBufferRenderer.getGBuffer();

      getGTextures = () => {
        const nIdx = geometryBufferRenderer.getTextureIndex(GeometryBufferRenderer.NORMAL_TEXTURE_TYPE);
        const pIdx = geometryBufferRenderer.getTextureIndex(GeometryBufferRenderer.POSITION_TEXTURE_TYPE);
        const rIdx = geometryBufferRenderer.getTextureIndex(GeometryBufferRenderer.REFLECTIVITY_TEXTURE_TYPE);
        return [
          gBuffer.textures[nIdx],
          gBuffer.textures[pIdx],
          gBuffer.textures[rIdx],
        ]
      }
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

    const POINTS_DATA_TEXTURE_HEIGHT = 5;

    const pointLightsDataTexture = RawTexture.CreateRGBATexture(
      this.getDataBuffer([]),
      this.TOTAL_LIGHTS_ALLOWED,
      POINTS_DATA_TEXTURE_HEIGHT,
      scene,
      false,
      undefined,
      Texture.NEAREST_NEAREST,
    );

    let defines = "";

    defines += `precision highp float;
#define TOTAL_LIGHTS_ALLOWED ${this.TOTAL_LIGHTS_ALLOWED}.0
#define POINTS_DATA_TEXTURE_HEIGHT ${POINTS_DATA_TEXTURE_HEIGHT}.0
#define RECIPROCAL_PI 0.318309886
`;

    if (this.isPerformanceMode) defines += `#define IS_PERFORMANCE_MODE 1
#define TOTAL_PERFORMANCE_LIGHTS_ALLOWED ${this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED}
`;

    const frag = defines + pointLightFrag;
    console.log(frag);

    Effect.ShadersStore["__deferredPointLights__FragmentShader"] = frag;

    this.postProcess = new PostProcess(
      "__deferredPointLights__ pp",
      "__deferredPointLights__",
      ["lights_len", "camera_position", "screenSize"].concat(
        this.isPerformanceMode
          ? ["lights_position_range", "lights_color_intensity"]
          : [],
      ),
      ["nBuffer", "pBuffer", "rBuffer"].concat(
        this.isPerformanceMode ? [] : ["point_lights_data"],
      ),
      1,
      camera,
      undefined,
      scene.getEngine(),
    );

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

    this.postProcess.onApply = (e) => {
      this.updateActive(scene.frustumPlanes);
      const cameraPos = camera.globalPosition;
      const allLights = this.getAll({
        active: true,
        visible: true,
        capLength: true,
      }) as DeferredPointLight[];

      if (!this.isPerformanceMode)
        pointLightsDataTexture.update(this.getDataBuffer(allLights));

      const gTextures = getGTextures();

      e.setTexture("nBuffer", gTextures[0]);
      e.setTexture("pBuffer", gTextures[1]);
      e.setTexture("rBuffer", gTextures[2]);

      if (this.isPerformanceMode) {
        e.setFloatArray4(
          "lights_position_range",
          allLights
            .map((l) => l.getPositionArray(false))
            .flatMap((a) => a as number[]),
        );
        e.setFloatArray4(
          "lights_color_intensity",
          allLights
            .map((l) => l.getColorIntensityArray(false))
            .flatMap((a) => a),
        );
      } else {
        e.setTexture("point_lights_data", pointLightsDataTexture);
      }

      e.setInt("lights_len", allLights.length);
      e.setFloat3("camera_position", cameraPos.x, cameraPos.y, cameraPos.z);

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
