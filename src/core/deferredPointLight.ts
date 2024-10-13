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

    const readDataFromTexture = `
            float texIndex = (float(i) / ${this.TOTAL_LIGHTS_ALLOWED}.0);
            vec4 ci = texture2D(point_lights_data, vec2(texIndex, 0.0 / ${POINTS_DATA_TEXTURE_HEIGHT}.0));
            vec4 px = texture2D(point_lights_data, vec2(texIndex, 1.001 / ${POINTS_DATA_TEXTURE_HEIGHT}.0)) * 255.0;
            vec4 py = texture2D(point_lights_data, vec2(texIndex, 2.001 / ${POINTS_DATA_TEXTURE_HEIGHT}.0)) * 255.0;
            vec4 pz = texture2D(point_lights_data, vec2(texIndex, 3.001 / ${POINTS_DATA_TEXTURE_HEIGHT}.0)) * 255.0;
            vec4 range = texture2D(point_lights_data, vec2(texIndex, 1.0)) * 255.0;
            
            float true_px = assembleNumber(int(px.r), int(px.g), int(px.b), int(px.a));
            float true_py = assembleNumber(int(py.r), int(py.g), int(py.b), int(py.a));
            float true_pz = assembleNumber(int(pz.r), int(pz.g), int(pz.b), int(pz.a));
            float true_range = assembleNumber(int(range.r), int(range.g), int(range.b), int(range.a));
        `;

    const readDataFromUniforms = `
            vec4 ci = lights_color_intensity[i];
            float true_px = lights_position_range[i].x;
            float true_py = lights_position_range[i].y;
            float true_pz = lights_position_range[i].z;
            float true_range = lights_position_range[i].w;
        `;

    // https://www.youtube.com/watch?v=gya7x9H3mV0
    // https://www.gsn-lib.org/index.html#projectName=ShadersMonthly09&graphName=MicrofacetBRDF
    const brdf_microfacet = `
            vec3 fresnelSchlick(float cosTheta, vec3 F0) {
                return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
            }

            float D_GGX(float NoH, float roughness) {
                float alpha = roughness * roughness;
                float alpha2 = alpha * alpha;
                float NoH2 = NoH * NoH;
                float b = (NoH2 * (alpha2 - 1.0) + 1.0);
                return alpha2 * RECIPROCAL_PI / (b * b);
            }

            float G1_GGX_Schlick(float NoV, float roughness) {
                float alpha = roughness * roughness;
                float k = alpha / 2.0;
                return max(NoV, 0.001) / (NoV * (1.0 - k) + k);
            }

            float G_Smith(float NoV, float NoL, float roughness) {
                return G1_GGX_Schlick(NoL, roughness) * G1_GGX_Schlick(NoV, roughness);
            }

            float fresnelSchlick90(float cosTheta, float F0, float F90) {
                return F0 + (F90 - F0) * pow(1.0 - cosTheta, 5.0);
            } 

            float disneyDiffuseFactor(float NoV, float NoL, float VoH, float roughness) {
                float alpha = roughness * roughness;
                float F90 = 0.5 + 2.0 * alpha * VoH * VoH;
                float F_in = fresnelSchlick90(NoL, 1.0, F90);
                float F_out = fresnelSchlick90(NoV, 1.0, F90);
                return F_in * F_out;
            }

            vec3 brdfMicrofacets(vec3 L, vec3 V, vec3 N, float metallic, float roughness, vec3 baseColor, float reflectance) {
                vec3 H = normalize(V + L);
                
                float NoV = clamp(dot(N, V), 0.0, 1.0);
                float NoL = clamp(dot(N, L), 0.0, 1.0);
                float NoH = clamp(dot(N, H), 0.0, 1.0);
                float VoH = clamp(dot(V, H), 0.0, 1.0);
                
                vec3 f0 = vec3(0.16 * (reflectance * reflectance));
                f0 = mix(f0, baseColor, metallic);
                
                vec3 F = fresnelSchlick(VoH, f0);
                float D = D_GGX(NoH, roughness);
                float G = G_Smith(NoV, NoL, roughness);
                
                vec3 spec = (F * D * G) / (4.0 * max(NoV, 0.001) * max(NoL, 0.001));
                
                vec3 rhoD = baseColor;
                
                // optionally
                rhoD *= vec3(1.0) - F;
                rhoD *= disneyDiffuseFactor(NoV, NoL, VoH, roughness);
                
                rhoD *= (1.0 - metallic);
                
                vec3 diff = rhoD * RECIPROCAL_PI;

                return diff + spec;
            }
        `;

    Effect.ShadersStore["__deferredPointLights__FragmentShader"] =
      `precision highp float;

        #define RECIPROCAL_PI 0.318309886

        in vec2 vUV;
        uniform int lights_len;
        uniform vec2 screenSize;
        uniform vec3 camera_position;

        ${this.isPerformanceMode ? "" : "uniform sampler2D point_lights_data;"}
        ${this.isPerformanceMode ? `uniform vec4 lights_position_range[${this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED}];` : ""}
        ${this.isPerformanceMode ? `uniform vec4 lights_color_intensity[${this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED}];` : ""}

        uniform sampler2D textureSampler;
        uniform sampler2D nBuffer;
        uniform sampler2D pBuffer;
        uniform sampler2D rBuffer;

        ${this.isPerformanceMode ? "" : Bits.glslNumberAssembler}
        ${brdf_microfacet}

        vec3 getColor (
            float intensity,
            vec3 light_p,
            vec3 light_color,
            float light_range,
            vec4 color,
            vec4 normals,
            vec4 p0,
            vec4 refl
        ) {
            vec3 d = light_p - p0.rgb;
            float r = length(d);
            vec3 l = d / r;
            vec3 n = normals.rgb;

            float normalFactor = pow(max(0.0, dot(n, l)), 2.0);
            float distanceFactor = clamp(pow( intensity / r , 2.0), 0.0, 1.0);
            float mixFactor = distanceFactor * normalFactor;
            float rangeClampFactor = light_range == 0.0 ? 1.0 : smoothstep(light_range, light_range - 0.1, r);
            vec3 final_standard = max(vec3(0.0), light_color * clamp(mixFactor, 0.0, 1.0)) * rangeClampFactor;

            float roughness = 1.0 - refl.a;
            float metalness = refl.b;
            if (roughness == 0.0 && metalness == 0.0) {
                return final_standard;
            }

            vec3 v = normalize(camera_position - p0.rgb);
            
            return brdfMicrofacets(l, v, normalize(n), metalness, roughness, color.rgb * light_color, 0.5) * rangeClampFactor;
        }

        void main(void) {
            vec4 normals = texture2D(nBuffer, vUV);
            vec4 color = texture2D(textureSampler, vUV);
            if (normals.a == 0.0) {
                gl_FragColor = color;
                return;
            }

            vec4 pbuff = texture2D(pBuffer, vUV);
            vec4 refl = texture2D(rBuffer, vUV);

            for (int i = 0; i < lights_len; i++) {
                ${this.isPerformanceMode ? readDataFromUniforms : readDataFromTexture}

                color.rgb += getColor(
                    abs(ci.a * 10.0),
                    vec3(true_px, true_py, true_pz),
                    normalize(ci.rgb),
                    true_range,
                    color,
                    normals,
                    pbuff,
                    refl
                );
            }
            
            gl_FragColor = color;
        }
        `;

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
