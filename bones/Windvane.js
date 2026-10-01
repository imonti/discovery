import * as THREE from "three";
import { pane } from "./config.js";
import { createPerlinSampler } from "../noise/noise2D.js";
import { Fn, triNoise3D, uniform } from "three/tsl";

class Windvane {
  constructor(samplerSizes = [2, 4]) {
    // The Windvane is a controller. The visible Three.js object is exposed
    // separately so callers can add it to any scene or hierarchy they want.
    this.display = new THREE.ArrowHelper(
      new THREE.Vector3(0, -1, 0),
      new THREE.Vector3(),
      1,
      0x999999,
    );
    this._configInitialized = false;
    this._direction = null;
    this.onChange = null;
    this.referencePoint = new THREE.Vector2();
    this.windSamplers = samplerSizes.map((size) => createPerlinSampler(size));
    this._settings = {
      direction: 0,
      k: 0.5,
      noiseSpeed: 0.2,
      amplitude: 0.5,
      persistence: 0.2,
    };
    this.directionUniform = uniform(new THREE.Vector3(0, -1, 0));
    this.noiseSpeedUniform = uniform(this._settings.noiseSpeed);
    this.amplitudeUniform = uniform(this._settings.amplitude);
    this.windIntensity = Fn(([position, currentTime]) => {
      const animatedPosition = position.add(
        this.directionUniform
          .mul(this.noiseSpeedUniform)
          .mul(currentTime),
      );
      return triNoise3D(animatedPosition, 1, currentTime)
        .mul(2)
        .sub(1)
        .mul(this.amplitudeUniform);
    }).setLayout({
      name: "windIntensity",
      type: "float",
      inputs: [
        { name: "position", type: "vec3" },
        { name: "currentTime", type: "float" },
      ],
    });
  }

  /**
   * Enable the Windvane Tweakpane controls once.
   *
   * Calling this method repeatedly is safe.
   */
  enableConfig() {
    if (this._configInitialized) return this;

    this._configInitialized = true;
    const windFolder = pane.addFolder({ title: "wind", expanded: false });

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
      min: -1,
      max: 1,
      step: 0.01,
    });

    const noiseSpeedBinding = windFolder.addBinding(
      this._settings,
      "noiseSpeed",
      {
      label: "speed",
      min: 0,
      max: 5,
      step: 0.01,
      },
    );

    const amplitudeBinding = windFolder.addBinding(
      this._settings,
      "amplitude",
      {
        label: "amplitude",
        min: 0,
        max: 2,
        step: 0.01,
      },
    );

    const persistenceBinding = windFolder.addBinding(
      this._settings,
      "persistence",
      {
        label: "persistence",
        min: 0,
        max: 1,
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
      this.noiseSpeedUniform.value = this._settings.noiseSpeed;
      if (this.onChange !== null) this.onChange();
    });

    amplitudeBinding.on("change", () => {
      this.amplitudeUniform.value = this._settings.amplitude;
      if (this.onChange !== null) this.onChange();
    });

    persistenceBinding.on("change", () => {
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

    // Keep the explicit angular basis: angle 0 is -Y, and positive angles
    // rotate clockwise around +Z when viewed from +Z (-Y -> +X).
    const direction = new THREE.Vector3(
      Math.sin(normalizedDirection),
      -Math.cos(normalizedDirection),
      0,
    );
    this.directionUniform.value.copy(direction);
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

    // Vector2 uses x for world X and y for world Y.
    this.referencePoint.x += direction.x * distance;
    this.referencePoint.y += direction.y * distance;
  }

  sampleNoise(u, v, index) {
    const maxOctave = THREE.MathUtils.clamp(
      Math.floor(Number(index) || 0),
      0,
      this.windSamplers.length - 1,
    );

    let value = 0;
    let octaveAmplitude = 1;
    let amplitudeSum = 0;
    const persistence = this._settings.persistence;

    // Include every octave from the broadest sampler through the selected
    // maximum octave. Normalize the result to keep its amplitude stable as
    // more octaves are added.
    for (let octave = 0; octave <= maxOctave; octave++) {
      value += octaveAmplitude * this.windSamplers[octave](u, v);
      amplitudeSum += octaveAmplitude;
      octaveAmplitude *= persistence;
    }

    return amplitudeSum > 0
      ? (value / amplitudeSum) * this._settings.amplitude
      : 0;
  }

  /** Return the wind direction as a normalized world-space vector. */
  getDirection() {
    this.display.updateWorldMatrix(true, false);
    return new THREE.Vector3(0, 1, 0).transformDirection(
      this.display.matrixWorld,
    );
  }

}

export { Windvane };
