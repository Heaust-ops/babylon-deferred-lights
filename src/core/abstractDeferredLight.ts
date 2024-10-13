import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Plane } from "@babylonjs/core/Maths/math.plane";
import type { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import type { DeepImmutable } from "@babylonjs/core/types";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";

class AbstractDeferredLight {
  uniqueId: number;

  alwaysSelectAsActiveLight = false;
  isVisible = true;

  range = 20;
  position = Vector3.Zero();

  clone() {
    throw new Error("Method not implemented");
  }

  constructor() {
    this.uniqueId = AbstractDeferredLight.getUniqueId();
  }

  /**
   * ==== ==== ==== ====
   * MANAGEMENT STUFF
   * ==== ==== ==== ====
   */

  /**
   * META STUFF
   */

  protected static uniqueId = -1;
  protected static getUniqueId() {
    this.uniqueId++;
    return this.uniqueId;
  }

  protected static isPerformanceMode = false;

  static TOTAL_LIGHTS_ALLOWED = 1024;
  static TOTAL_PERFORMANCE_LIGHTS_ALLOWED = 128;

  /**
   * LIGHT SPECIFIC STUFF
   */

  protected static lights = {} as Record<number, AbstractDeferredLight>;

  // Active Lights
  protected static activeLights = [] as AbstractDeferredLight[];
  protected static isFrustumCullingEnabled = true;

  static freezeActive() {
    this.isFrustumCullingEnabled = false;
  }
  static unfreezeActive() {
    this.isFrustumCullingEnabled = true;
  }

  static updateActive(frustumPlanes: Array<DeepImmutable<Plane>>) {
    if (!this.isFrustumCullingEnabled) return;
    this.activeLights = [];

    for (const key in this.lights) {
      const light = this.lights[key];
      if (!light.range || light.alwaysSelectAsActiveLight) {
        this.activeLights.push(light);
        continue;
      }

      let isActive = true;

      for (const plane of frustumPlanes) {
        if (plane.dotCoordinate(light.position) <= -light.range) {
          isActive = false;
          break;
        }
      }

      if (isActive) this.activeLights.push(light);
    }
  }

  /**
   * ACCESSORS
   */
  static getAll(
    filters?: Partial<{
      active: boolean;
      visible: boolean;
      capLength: boolean;
    }>,
  ) {
    if (!filters) return Object.values(this.lights);

    const allLights = filters.active
      ? this.activeLights
      : Object.values(this.lights);
    const filteredLights = [];
    const totalAllowed = this.isPerformanceMode
      ? this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED
      : this.TOTAL_LIGHTS_ALLOWED;

    for (let i = 0; i < allLights.length; i++) {
      const light = allLights[i];
      if (filters.visible && !light.isVisible) continue;
      filteredLights.push(light);
      if (filters.capLength && filteredLights.length === totalAllowed) break;
    }

    return filteredLights;
  }

  static getById(id: number): AbstractDeferredLight | null {
    return this.lights[id] ?? null;
  }

  static remove(idOrLight: number | AbstractDeferredLight) {
    if (idOrLight instanceof AbstractDeferredLight) {
      delete this.lights[idOrLight.uniqueId];
      return;
    }

    delete this.lights[idOrLight];
  }

  static add(light: AbstractDeferredLight) {
    this.lights[light.uniqueId] = light;
    return light.uniqueId;
  }

  /**
   * POSTPROCESS STUFF
   */

  protected static attachedCamera = null as Camera | null;
  static postProcess = null as PostProcess | null;

  static disable() {
    if (!this.attachedCamera || !this.postProcess) return;
    this.attachedCamera.detachPostProcess(this.postProcess);
    this.postProcess.dispose();
    this.postProcess = null;
    this.attachedCamera = null;
  }

  static reset() {
    if (this.postProcess) this.postProcess.dispose();
    this.postProcess = null;
    this.attachedCamera = null;
    this.isFrustumCullingEnabled = true;
    this.activeLights = [];
    this.lights = {};
    this.isPerformanceMode = false;
    this.TOTAL_LIGHTS_ALLOWED = 1024;
    this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED = 128;
  }
}

export { AbstractDeferredLight };
