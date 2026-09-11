import * as THREE from "three";
import { SpriteNodeMaterial } from "three/webgpu";
import { bayer16 } from "three/addons/tsl/math/Bayer.js";
import {
  instancedBufferAttribute,
  clamp,
  dot,
  normalize,
  screenSize,
  screenUV,
  texture,
  uniform,
  float,
  smoothstep
} from "three/tsl";
import { ColorRamp } from "./utils/ColorRamp.js";
import { hsl } from "./utils/hsl.js";
import { pane } from "./config.js";

class LeavesMaterial extends SpriteNodeMaterial {
  instanceCount = 0;

  constructor(csvText, leafTexture, sunDirectionNode, sunIntensityNode) {
    super({
      sizeAttenuation: true,
      color: 0x92ad2a,
      map: leafTexture,
    });

    this.name = "LeavesMaterial";
    this.alphaToCoverage = true;
    this.alphaTest = 0.05;

    const leavesFolder = pane.addFolder({ title: "leaves" });
    this.valueUniform = uniform(1);
    this.hueUniform = uniform(0);
    this.saturationUniform = uniform(1);

    leavesFolder.addBinding(this.valueUniform, "value", {
      label: "value",
      min: 0,
      max: 2,
      step: 0.01,
    });
    leavesFolder.addBinding(this.hueUniform, "value", {
      label: "hue",
      min: 0,
      max: Math.PI * 2,
      step: 0.01,
    });
    leavesFolder.addBinding(this.saturationUniform, "value", {
      label: "saturation",
      min: 0,
      max: 2,
      step: 0.01,
    });

    const instanceTransforms = this.parseInstanceTransforms(csvText);
    const positions = new Float32Array(instanceTransforms.length * 3);
    const rotations = new Float32Array(instanceTransforms.length);
    const scales = new Float32Array(instanceTransforms.length * 2);
    const normals = new Float32Array(instanceTransforms.length * 3);
    const dtps = new Float32Array(instanceTransforms.length);

    instanceTransforms.forEach(
      ({ position, rotation, scale, normal, dtp }, index) => {
        positions[index * 3] = position.x;
        positions[index * 3 + 1] = position.y;
        positions[index * 3 + 2] = position.z;
        rotations[index] = 0.0;
        scales[index * 2] = scale.x;
        scales[index * 2 + 1] = scale.y;
        normals[index * 3] = normal.x;
        normals[index * 3 + 1] = normal.y;
        normals[index * 3 + 2] = normal.z;
        dtps[index] = 1.0 - dtp;
      },
    );

    const positionAttribute = new THREE.InstancedBufferAttribute(positions, 3);
    const rotationAttribute = new THREE.InstancedBufferAttribute(rotations, 1);
    const scaleAttribute = new THREE.InstancedBufferAttribute(scales, 2);
    const normalAttribute = new THREE.InstancedBufferAttribute(normals, 3);
    const dtpAttribute = new THREE.InstancedBufferAttribute(dtps, 1);

    this.positionNode = instancedBufferAttribute(positionAttribute);
    this.rotationNode = instancedBufferAttribute(rotationAttribute);
    this.scaleNode = instancedBufferAttribute(scaleAttribute);
    this.normalNode = instancedBufferAttribute(normalAttribute);
    const leafColorRamp = ColorRamp([
      { color: new THREE.Color("#526D49"), weight: 0.0 },
      { color: new THREE.Color("#8F9D36"), weight: 0.9 },
      { color: new THREE.Color("#9BAB48"), weight: 1.0 },
    ]);
    // const leafColorRamp = ColorRamp([
    //   { color: new THREE.Color("#275255"), weight: 0.0 },
    //   { color: new THREE.Color("#92AD2A"), weight: 0.9 },
    //   { color: new THREE.Color("#A2C630"), weight: 1.0 },
    // ]);
    const instanceNormalNode = normalize(
      instancedBufferAttribute(normalAttribute),
    );
    const diffuseFactor = clamp(
      dot(instanceNormalNode.mul(-1), sunDirectionNode)
        .mul(0.5)
        .add(0.5)
        .mul(sunIntensityNode),
      0,
      1,
    );
    const instanceDtpNode = float(1.0); //instancedBufferAttribute(dtpAttribute);
    this.colorNode = hsl(
      leafColorRamp(diffuseFactor.mul(instanceDtpNode)),
      this.hueUniform,
      this.saturationUniform,
      this.valueUniform,
    );
    this.opacityNode = smoothstep(0.0, 0.55, texture(leafTexture).a);
    const bayerThreshold = clamp(
      bayer16(screenUV.mul(screenSize)).r.mul(0.98).add(0.01),
      0.01,
      0.99,
    );
    this.alphaTestNode = bayerThreshold;
    this.instanceCount = instanceTransforms.length;
  }

  parseInstanceTransforms(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map((header) => header.trim());
    const column = Object.fromEntries(
      headers.map((header, index) => [header, index]),
    );

    const rows = lines
      .slice(1)
      .map((line) => line.split(","))
      .filter((values) => values.length === headers.length);

    return rows
      .map((values) => ({
        position: new THREE.Vector3(
          Number(values[column.pos_x]),
          Number(values[column.pos_y]),
          Number(values[column.pos_z]),
        ),
        rotation: new THREE.Euler(
          THREE.MathUtils.degToRad(Number(values[column.rot_x_deg])),
          THREE.MathUtils.degToRad(Number(values[column.rot_y_deg])),
          THREE.MathUtils.degToRad(Number(values[column.rot_z_deg])),
          "XYZ",
        ),
        scale: new THREE.Vector3(
          Number(values[column.scale_x]),
          Number(values[column.scale_y]),
          Number(values[column.scale_z]),
        ),
        normal: new THREE.Vector3(
          Number(values[column.normal_x]),
          Number(values[column.normal_y]),
          Number(values[column.normal_z]),
        ),
        dtp: Number(values[column.dtp]),
      }))
      .filter(({ position, rotation, scale, normal, dtp }) =>
        [
          position.x,
          position.y,
          position.z,
          rotation.x,
          rotation.y,
          rotation.z,
          scale.x,
          scale.y,
          scale.z,
          normal.x,
          normal.y,
          normal.z,
          dtp,
        ].every(Number.isFinite),
      );
  }
}

export { LeavesMaterial };
