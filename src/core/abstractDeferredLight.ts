import type { Camera } from "@babylonjs/core/Cameras/camera";
import type { Plane } from "@babylonjs/core/Maths/math.plane";
import type { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import type { DeepImmutable } from "@babylonjs/core/types";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";

class AbstractDeferredLight {
  uniqueId: number;

  alwaysSelectAsActiveLight = false;
  isVisible = true;

  protected _range = 20;
  protected _position = Vector3.Zero();

  get range() {
    return this._range;
  }

  get position() {
    return this._position;
  }

  clone() {
    throw new Error("Method not implemented");
  }

  constructor() {
    this.uniqueId = AbstractDeferredLight.getUniqueId();
  }

  /**
   * ==== ==== ==== ====
   * UTILS
   * ==== ==== ==== ====
   */
  protected static getPaddingLength(
    bufferLength: number,
    pixelCapacity: number,
  ) {
    const valueCapacity = pixelCapacity * 4;
    const l = valueCapacity - bufferLength;
    return l;
  }

  /**
   * RTT Dimensions depending on the max data that populates it
   */
  protected static getTextureDimensionsByUnits(
    maxTexSize: number,
    units: number,
    sizePerUnit: number,
  ) {
    const pixels = Math.ceil((units * sizePerUnit) / 4);

    let width = maxTexSize;
    let height = Math.ceil(pixels / maxTexSize);

    if (pixels < width) width = pixels;

    return { width, height };
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
  private static _needsUpdate = false;
  static get needsUpdate() {
    return this.autoUpdate || this._needsUpdate;
  }
  static set needsUpdate(arg: boolean) {
    this._needsUpdate = arg;
  }

  static update() {
    this.needsUpdate = true;
  }

  static autoUpdate = true;

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
    this.needsUpdate = true;

    if (idOrLight instanceof AbstractDeferredLight) {
      delete this.lights[idOrLight.uniqueId];
      return;
    }

    delete this.lights[idOrLight];
  }

  static add(light: AbstractDeferredLight) {
    this.needsUpdate = true;

    this.lights[light.uniqueId] = light;
    return light.uniqueId;
  }

  /**
   * POSTPROCESS STUFF
   */

  static postProcess = null as PostProcess | null;

  static disable() {
    if (!this.postProcess) return;
    this.postProcess.dispose();
    this.postProcess = null;
  }

  static previousPadding: number[] | null = null;
  static reset() {
    if (this.postProcess) this.postProcess.dispose();
    this.postProcess = null;
    this.isFrustumCullingEnabled = true;
    this.activeLights = [];
    this.needsUpdate = false;
    this.lights = {};
    this.previousPadding = null;
    this.isPerformanceMode = false;
    this.TOTAL_LIGHTS_ALLOWED = 1024;
    this.TOTAL_PERFORMANCE_LIGHTS_ALLOWED = 128;
    this.autoUpdate = true;
  }
}

export { AbstractDeferredLight };
