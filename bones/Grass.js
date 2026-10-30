import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { bayer16 } from "three/addons/tsl/math/Bayer.js";
import { configFolder } from "./config.js";
import { ColorRamp } from "./utils/ColorRamp.js";
import { minimalToneMap } from "./utils/minimalToneMap.js";
import { sampleIBLIrradiance } from "./utils/sampleIBLIrradiance.js";
import {
  attribute,
  modelViewMatrix,
  positionGeometry,
  screenCoordinate,
  smoothstep,
  step,
  texture as textureNode,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";

class Grass extends THREE.Group {
  constructor({ csvText, texture, environmentTexture, windvane }) {
    super();

    this.windvane = windvane;

    const instances = parseGrassInstances(csvText);
    const geometry = new THREE.InstancedBufferGeometry().copy(
      new THREE.PlaneGeometry(0.1, 0.12),
    );
    geometry.instanceCount = instances.length;

    const positions = new THREE.InstancedBufferAttribute(
      new Float32Array(instances.length * 3),
      3,
    );
    const scales = new THREE.InstancedBufferAttribute(
      new Float32Array(instances.length * 3),
      3,
    );
    const normals = new THREE.InstancedBufferAttribute(
      new Float32Array(instances.length * 3),
      3,
    );
    const variants = new THREE.InstancedBufferAttribute(
      new Float32Array(instances.length),
      1,
    );

    instances.forEach(({ position, scale, normal }, index) => {
      positions.setXYZ(index, position.x, position.y, position.z);
      scales.setXYZ(index, scale.x, scale.y, scale.z);
      normals.setXYZ(index, normal.x, normal.y, normal.z);
      variants.setX(index, Math.floor(Math.random() * 3));
    });

    geometry.setAttribute("instancePosition", positions);
    geometry.setAttribute("instanceScale", scales);
    geometry.setAttribute("normal", normals);
    geometry.setAttribute("grassVariant", variants);

    const material = new MeshBasicNodeMaterial({
      side: THREE.DoubleSide,
    });
    const grassFolder = configFolder.addFolder({ title: "grass", expanded: false });
    const fadeFolder = grassFolder.addFolder({ title: "fade"});
    const fadeLower = uniform(0);
    const fadeUpper = uniform(0.15);
    fadeFolder.addBinding(fadeLower, "value", {
      label: "lower",
      min: 0,
      max: 1,
      step: 0.01,
    });
    fadeFolder.addBinding(fadeUpper, "value", {
      label: "upper",
      min: 0,
      max: 1,
      step: 0.01,
    });
    const stepLower = uniform(0.5);
    fadeFolder.addBinding(stepLower, "value", {
      label: "step lower",
      min: 0,
      max: 1,
      step: 0.01,
    });
    const swayFolder = grassFolder.addFolder({
      title: "sway",
      expanded: false,
    });
    const swayIntensity = uniform(1);
    const swaySpeed = uniform(0.1);
    swayFolder.addBinding(swayIntensity, "value", {
      label: "intensity",
      min: 0,
      max: 3,
      step: 0.01,
    });
    swayFolder.addBinding(swaySpeed, "value", {
      label: "speed",
      min: 0,
      max: 5,
      step: 0.01,
    });
    const toneMappingFolder = grassFolder.addFolder({
      title: "tone mapping"
    });
    const toneMappingExposure = uniform(0.7);
    const toneMappingWhitePoint = uniform(2.5);
    toneMappingFolder.addBinding(toneMappingExposure, "value", {
      label: "exposure",
      min: 0,
      max: 5,
      step: 0.01,
    });
    material.setupPositionView = () => {
      const instancePosition = attribute("instancePosition", "vec3");
      const instanceScale = attribute("instanceScale", "vec3");
      const viewPosition = modelViewMatrix.mul(
        vec4(instancePosition, 1),
      );
      const normalizedHeight = positionGeometry.y.div(0.12).add(0.5);
      const windIntensity = this.windvane.windIntensity(
        instancePosition,
        time.mul(swaySpeed),
      );
      const sway = windIntensity
        .mul(normalizedHeight)
        .mul(0.12)
        .mul(instanceScale.x)
        .mul(swayIntensity);
      const spriteOffset = vec2(
        positionGeometry.x.mul(instanceScale.y).add(sway),
        positionGeometry.y.mul(instanceScale.x),
      );

      return vec4(viewPosition.xy.add(spriteOffset), viewPosition.zw);
    };
    const grassUv = uv()
      .mul(vec2(0.3, 1.0))
      .add(vec2(attribute("grassVariant", "float").div(3), 0));
    const sampledColor = textureNode(texture, grassUv);
    const grayscale = sampledColor.rgb.dot(vec3(0.299, 0.587, 0.114));
    const grassColorRamp = ColorRamp([
      { color: new THREE.Color("#A2C630"), weight: 0 },
      { color: new THREE.Color("#60751C"), weight: 0.77 },
    ]);
    const rampColor = grassColorRamp(uv().y.oneMinus());
    const sampledAlpha = step(stepLower, grayscale.oneMinus());
    const alpha = sampledAlpha.mul(smoothstep(
      fadeLower,
      fadeUpper,
      uv().y),
    );
    const irradiance = sampleIBLIrradiance(
      environmentTexture,
      attribute("normal", "vec3"),
    );
    const toneMappedColor = minimalToneMap(
      rampColor.mul(irradiance),
      toneMappingExposure,
      toneMappingWhitePoint,
    );
    material.alphaTestNode = bayer16(screenCoordinate.xy).r
      .mul(255)
      .add(0.5)
      .div(256);
    material.colorNode = vec4(toneMappedColor, alpha);

    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = "GrassInstances";
    mesh.frustumCulled = false;
    this.name = "Grass";
    this.mesh = mesh;
    this.texture = texture;
    this.add(mesh);
  }
}

function parseGrassInstances(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((header) => header.trim());
  const column = Object.fromEntries(
    headers.map((header, index) => [header, index]),
  );

  return lines
    .slice(1)
    .map((line) => line.split(","))
    .filter((values) => values.length === headers.length)
    .map((values) => ({
      position: new THREE.Vector3(
        Number(values[column.pos_x]),
        Number(values[column.pos_y]),
        -Number(values[column.pos_z]),
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
    }))
    .filter(({ position, scale, normal }) =>
      [
        position.x,
        position.y,
        position.z,
        scale.x,
        scale.y,
        scale.z,
        normal.x,
        normal.y,
        normal.z,
      ].every(Number.isFinite),
    );
}

export { Grass };
