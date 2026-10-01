import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  attribute,
  float,
  modelViewMatrix,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  reference,
  rotate,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { pane } from "./config.js";
import { sampleIBLIrradiance } from "./utils/sampleIBLIrradiance.js";
import { minimalToneMap } from "./utils/minimalToneMap.js";

class LeavesMaterial extends MeshBasicNodeMaterial {
  instanceCount = 0;

  constructor(leafTexture, environmentTexture) {
    super({
      map: leafTexture,
      transparent: true,
    });
    this.lights = false;

    this.name = "LeavesMaterial";

    const leavesFolder = pane.addFolder({ title: "leaves", expanded: false });
    this.opacityLowerUniform = uniform(0);
    this.opacityUpperUniform = uniform(1);
    this.toneMappingExposureUniform = uniform(0.5);
    this.toneMappingWhitePointUniform = uniform(2.5);

    leavesFolder.addBinding(this.opacityLowerUniform, "value", {
      label: "opacity lower",
      min: 0,
      max: 1,
      step: 0.01,
    });
    leavesFolder.addBinding(this.opacityUpperUniform, "value", {
      label: "opacity upper",
      min: 0,
      max: 1,
      step: 0.01,
    });
    leavesFolder.addBinding(this.toneMappingExposureUniform, "value", {
      label: "tone exposure",
      min: 0,
      max: 5,
      step: 0.01,
    });
    leavesFolder.addBinding(this.toneMappingWhitePointUniform, "value", {
      label: "tone white point",
      min: 0.01,
      max: 10,
      step: 0.01,
    });
    const leafNormal = normalize(attribute("normal", "vec3"));
    const leafColor = attribute("color", "vec3");
    const irradiance = sampleIBLIrradiance(environmentTexture, leafNormal);
    const toneMappedColor = minimalToneMap(
      irradiance.mul(leafColor),
      this.toneMappingExposureUniform,
      this.toneMappingWhitePointUniform,
    );
    this.colorNode = vec4(toneMappedColor, 1);
    this.opacityNode = smoothstep(
      this.opacityLowerUniform,
      this.opacityUpperUniform,
      texture(leafTexture).a,
    );
  }

  setupPositionView(builder) {
    const { object } = builder;

    // Keep the leaves camera-facing while using ordinary plane geometry.
    const mvPosition = modelViewMatrix.mul(vec3(0));
    let scale = vec2(
      modelWorldMatrix[0].xyz.length(),
      modelWorldMatrix[1].xyz.length(),
    );

    let alignedPosition = positionGeometry.xy;
    if (object.center?.isVector2 === true) {
      const center = reference("center", "vec2", object);
      alignedPosition = alignedPosition.sub(center.sub(0.5));
    }

    alignedPosition = alignedPosition.mul(scale);
    const rotatedPosition = rotate(alignedPosition, float(0));

    return vec4(mvPosition.xy.add(rotatedPosition), mvPosition.zw);
  }

}

export { LeavesMaterial };
