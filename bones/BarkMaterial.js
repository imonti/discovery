import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { bayer16 } from "three/addons/tsl/math/Bayer.js";
import {
  Fn,
  attribute,
  bitangentWorld,
  hue,
  mix,
  normalWorldGeometry,
  saturation,
  screenCoordinate,
  smoothstep,
  tangentWorld,
  vec4,
  texture,
  uniform,
  uv,
} from "three/tsl";
import { configFolder } from "./config.js";
import { sampleIBLIrradiance } from "./utils/sampleIBLIrradiance.js";

class BarkMaterial extends MeshBasicNodeMaterial {
  sampleNormalMap(uvNode) {
    const sampledNormal = texture(this.normalMap, uvNode).xyz;

    // Normal maps encode tangent-space normals in the [0, 1] range.
    return sampledNormal.mul(2).sub(1).normalize();
  }

  combineNormals(baseNormalWorld, tangentNormal, tangentWorldNode, bitangentWorldNode) {
    return tangentWorldNode
      .mul(tangentNormal.x)
      .add(bitangentWorldNode.mul(tangentNormal.y))
      .add(baseNormalWorld.mul(tangentNormal.z))
      .normalize();
  }

  constructor({ map, nMap, environmentTexture }) {
    super();
    this.lights = false;
    this.normalMap = nMap;
    this.name = "BarkMaterial";
    const settings = { uvScale: 3 };
    const barkFolder = configFolder.addFolder({ title: "bark", expanded: false });
    const uvScaleBinding = barkFolder.addBinding(settings, "uvScale", {
      label: "uv scale",
      min: 0.1,
      max: 10,
      step: 0.1,
    });

    const defaultUvScale = settings.uvScale;
    this.uvScale = uniform(new THREE.Vector2(defaultUvScale, defaultUvScale));
    this.scaledUv = uv().mul(this.uvScale);
    this.valueUniform = uniform(0.6);
    this.factorUniform = uniform(1.0);
    this.saturationUniform = uniform(0.6);
    this.hueUniform = uniform(0);
    this.alphaThresholdUniform = uniform(0.02);

    barkFolder.addBinding(this.alphaThresholdUniform, "value", {
      label: "alpha threshold",
      min: 0.01,
      max: 1,
      step: 0.01,
    });

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
    const barkColor = mix(mapNode.rgb, adjustedColor, this.factorUniform);
    const tangentNormal = this.sampleNormalMap(this.scaledUv);
    const barkNormalWorld = this.combineNormals(
      normalWorldGeometry,
      tangentNormal,
      tangentWorld,
      bitangentWorld,
    );
    const irradiance = sampleIBLIrradiance(
      environmentTexture,
      barkNormalWorld,
    );
    // Center the built-in Bayer texture's 8-bit thresholds so alpha 1 keeps all pixels.
    this.alphaTestNode = bayer16(screenCoordinate.xy).r.mul(255).add(0.5).div(256);
    this.colorNode = vec4(
      barkColor.mul(irradiance),
      smoothstep(0, this.alphaThresholdUniform, attribute("height", "float")),
    );

    uvScaleBinding.on("change", ({ value }) => {
      this.uvScale.value.set(value, value);
    });
  }

}

export { BarkMaterial };
