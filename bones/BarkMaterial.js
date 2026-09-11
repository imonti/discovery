import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  Fn,
  hue,
  mix,
  normalMap,
  saturation,
  texture,
  uniform,
  uv,
  vec4,
} from "three/tsl";
import { pane } from "./config.js";

class BarkMaterial extends MeshStandardNodeMaterial {
  constructor({ map, nMap }) {
    super();
    this.name = "BarkMaterial";
    const settings = { uvScale: 5 };
    const barkFolder = pane.addFolder({ title: "bark" });
    const uvScaleBinding = barkFolder.addBinding(settings, "uvScale", {
      label: "uv scale",
      min: 0.1,
      max: 10,
      step: 0.1,
    });

    const defaultUvScale = settings.uvScale;
    this.uvScale = uniform(new THREE.Vector2(defaultUvScale, defaultUvScale));
    this.scaledUv = uv().mul(this.uvScale);
    this.valueUniform = uniform(1.5);
    this.factorUniform = uniform(1);
    this.saturationUniform = uniform(0.5);
    this.hueUniform = uniform(0);

    barkFolder.addBinding(this.valueUniform, "value", {
      label: "value",
      min: 0,
      max: 2,
      step: 0.01,
    });
    barkFolder.addBinding(this.factorUniform, "value", {
      label: "factor",
      min: 0,
      max: 1,
      step: 0.01,
    });
    barkFolder.addBinding(this.saturationUniform, "value", {
      label: "saturation",
      min: 0,
      max: 2,
      step: 0.01,
    });
    barkFolder.addBinding(this.hueUniform, "value", {
      label: "hue",
      min: 0,
      max: Math.PI * 2,
      step: 0.01,
    });

    const hueSaturationValueNode = Fn(([color, h, s, v]) => {
      return hue(saturation(color, s), h).mul(v);
    });

    const mapNode = texture(map, this.scaledUv);
    const adjustedColor = hueSaturationValueNode(
      mapNode.rgb,
      this.hueUniform,
      this.saturationUniform,
      this.valueUniform,
    );
    this.colorNode = vec4(
      mix(mapNode.rgb, adjustedColor, this.factorUniform),
      mapNode.a,
    );

    this.normalNode = normalMap(
      texture(nMap, this.scaledUv),
      new THREE.Vector2(2, 2),
    );

    uvScaleBinding.on("change", ({ value }) => {
      this.uvScale.value.set(value, value);
    });
  }
}

export { BarkMaterial };
