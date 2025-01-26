# Deferred Lighting

A deferred lighting solution for [babylonjs](https://www.babylonjs.com/).

What's deferred lighting? In a nutshell, 1000s of lights w/ no lag. _(You can read more [here](https://learnopengl.com/Advanced-Lighting/Deferred-Shading))_

npm: https://www.npmjs.com/package/babylon-deferred-lighting

demo: https://babylon-deferred-lighting.netlify.app/

Right now this only supports point lights, this will change.

## How to use

```javascript
import { DeferredPointLight } from "babylon-deferred-lighting";
import { Effect } from "@babylonjs/core/Materials/effect";

// ...

DeferredPointLight.reset(); // reset the lighting system
const scene = new BABYLON.Scene(engine);

//...

// enable the lighting system
DeferredPointLight.enable(
  scene,
  Effect.ShadersStore,
  /** camera */ scene.activeCamera,
  /** GBuffer if you wanna use one */ null,
  /** performance mode */ false,
);
```

Start by importing the deferred point light.

Reset the lighting system before you make your scene and enable it.

if you plan to use fewer than about 150 lights, performance mode will be fare better on low spec devices. Otherwise keep it turned off.

```javascript
const pp = DeferredPointLight.postprocess;
```

You can get the postprocess that is doing all the lighting calclulations.

```javascript
// Just enable the system w/o using it
DeferredPointLight.enable(scene, Effect.ShadersStore);

// Use it later w/ whatever camera
camera.attachPostProcess(DeferredPointLight.postProcess);
```

That means you can just enable the lighting system, and use the postprocess later however you wish.

```javascript
const light = new DeferredPointLight({
  // All these are optional, you don't even need to pass in an object.
  position: BABYLON.Vector3.Zero(), // position of the light
  color: BABYLON.Color3.Red(), // color of the light
  intensity: 0.2, // intensity of the light
  range: 2, // range of the light (beyond this, the light won't be visible, 0 means infinite range)
});

// set params after the light is made
light.position = new BABYLON.Vector3(1, 2, 3);
light.color = BABYLON.Color3.Blue();
light.intensity = 0.5;
light.range = 10;

light.isVisible = false; // make light invisible
light.alwaysSelectAsActiveLight = true; // turns off frustum culling for this light and always tries to render it
```

You can make a light like so and control the parameters as you see fit.

```javascript
// add the light to the system
DeferredPointLight.add(light);

// make a new light and add it at the same time
const uniqueId = DeferredPointLight.add({
  position: BABYLON.Vector3.Zero(),
  color: BABYLON.Color3.Red(),
  intensity: 0.2,
  range: 2,
});

// get the light we just made
const newLight = DeferredPointLight.getById(uniqueId);

// get all the lights
const allLights = DeferredPointLight.getAll();

// get all visible and active lights
const allVisibleActiveLights = DeferredPointLight.getAll({
  active: true,
  visible: true,
});

// remove the lights
DeferredPointLight.remove(uniqueId); // by id
DeferredPointLight.remove(light); // or by object
```

After making the light, you have to add it to the system to see any effect.

You can also skip the making part and just pass the options to `add`, it will make a new light w/ those options to add.

You can get a light from the system if you have its id. or you can get all lights, or all active and/or visible lights.

once you're done w/ a light, go ahead and remove it from the system.

```javascript
DeferredPointLight.freezeActive(); // disable frustum culling
DeferredPointLight.unfreezeActive(); // enable frustum culling
```

You can enable and disable frustum culling _(cpu filtering out lights that are off screen)_ if you need it.

```javascript
DeferredPointLight.TOTAL_LIGHTS_ALLOWED = 2000; // default: 1024
DeferredPointLight.TOTAL_PERFORMANCE_LIGHTS_ALLOWED = 200; // default: 128
```

You can decide the max cap for lights in normal and performance mode _(don't go too high on performance mode)_

The cap is evaluated after frustum culling, so it's the maximum cap of simultaneous lights on screen.

For non-performance mode, higher total lights means a larger texture.

Large textures take more ram, vram and time to update. So try to keep total lights allowed fairly tight.

(You can always change it on the fly)

In case you do have 10s of thousands of lights, and are bogged down by the texture update per frame.

```javascript
DeferredPointLight.autoUpdate = false;
```

If your lights are mostly static, you can disable auto-update and boost performance by not updating the texture.

```javascript
DeferredPointLight.update();
```

You do have to manually call update if there's any change to your lights though if you do that.

```javascript
DeferredPointLight.disable();
```

You can get rid of the entire system once you no longer need it.

Have fun :)

Credits: [Heaust](https://forum.babylonjs.com/u/heaust-ops/summary) & [Joe_Kerr](https://forum.babylonjs.com/u/joe_kerr/summary)
