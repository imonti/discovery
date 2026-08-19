import * as THREE from "three";
import { pane } from "./config.js";
import { createPerlinSampler } from "../noise/noise2D.js";

class Windvane {
  constructor(samplerSizes = [2, 4]) {
    // The Windvane is a controller. The visible Three.js object is exposed
    // separately so callers can add it to any scene or hierarchy they want.
    this.display = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(),
      1,
      0xffffff,
    );
    this._configInitialized = false;
    this._direction = null;
    this.onChange = null;
    this.referencePoint = new THREE.Vector2();
    this.windSamplers = samplerSizes.map((size) => createPerlinSampler(size));
    this._settings = {
      direction: Math.PI / 2,
      k: 0,
      noiseSpeed: 1,
    };
  }

  /**
   * Enable the Windvane Tweakpane controls once.
   *
   * Calling this method repeatedly is safe.
   */
  enableConfig() {
    if (this._configInitialized) return this;

    this._configInitialized = true;
    const windFolder = pane.addFolder({ title: "wind" });

    const directionBinding = windFolder.addBinding(
      this._settings,
      "direction",
      {
        label: "direction (radians)",
        min: 0,
        max: Math.PI * 2,
        step: 0.01,
      },
    );

    const kBinding = windFolder.addBinding(this._settings, "k", {
      label: "k",
      min: -0.5,
      max: 0.5,
      step: 0.01,
    });

    const noiseSpeedBinding = windFolder.addBinding(
      this._settings,
      "noiseSpeed",
      {
      label: "noise speed",
      min: 0,
      max: 5,
      step: 0.01,
      },
    );

    directionBinding.on("change", () => {
      this.setDirection(this._settings.direction);
      if (this.onChange !== null) this.onChange();
    });

    kBinding.on("change", () => {
      if (this.onChange !== null) this.onChange();
    });

    noiseSpeedBinding.on("change", () => {
      if (this.onChange !== null) this.onChange();
    });

    this.setDirection(this._settings.direction);

    return this;
  }

  setDirection(r) {
    const normalizedDirection = THREE.MathUtils.euclideanModulo(
      r,
      Math.PI * 2,
    );

    if (normalizedDirection === this._direction) return;

    this._direction = normalizedDirection;

    // Positive r moves from +X toward +Z in the XZ plane.
    const direction = new THREE.Vector3(
      Math.cos(normalizedDirection),
      0,
      Math.sin(normalizedDirection),
    );
    this.display.setDirection(direction);
  }

  getStrength() {
    return this._settings.k;
  }

  getNoiseSpeed() {
    return this._settings.noiseSpeed;
  }

  update(deltaTime) {
    const direction = this.getDirection();
    const distance = this.getNoiseSpeed() * deltaTime;

    // Vector2 uses x for world X and y for world Z.
    this.referencePoint.x += direction.x * distance;
    this.referencePoint.y += direction.z * distance;
  }

  sampleNoise(u, v, index) {
    const maxOctave = THREE.MathUtils.clamp(
      Math.floor(Number(index) || 0),
      0,
      this.windSamplers.length - 1,
    );

    let value = 0;
    let amplitude = 1;
    let amplitudeSum = 0;
    const persistence = 0.5;

    // Include every octave from the broadest sampler through the selected
    // maximum octave. Normalize the result to keep its amplitude stable as
    // more octaves are added.
    for (let octave = 0; octave <= maxOctave; octave++) {
      value += amplitude * this.windSamplers[octave](u, v);
      amplitudeSum += amplitude;
      amplitude *= persistence;
    }

    return amplitudeSum > 0 ? value / amplitudeSum : 0;
  }

  /** Return the wind direction as a normalized world-space XZ vector. */
  getDirection() {
    this.display.updateWorldMatrix(true, false);
    return new THREE.Vector3(0, 1, 0).transformDirection(
      this.display.matrixWorld,
    );
  }

}

export { Windvane };
