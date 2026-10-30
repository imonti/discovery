import * as THREE from "three";
import { MeshStandardNodeMaterial } from "three/webgpu";
import {
  abs,
  attribute,
  cameraFar,
  cameraNear,
  cameraViewMatrix,
  clamp,
  modelWorldMatrix,
  mix,
  normalize,
  positionView,
  select,
  texture,
  transformNormalByViewMatrix,
  uniform,
  uv,
  vec3,
  vec4,
  viewZToPerspectiveDepth,
} from "three/tsl";
import { instancedBillboarding } from "../bush/instancedBillboarding.js";
import { configFolder } from "./config.js";

class TreeLeaves {
  constructor({ csvText, skeleton, depthMap, normalMap, opacityMap }) {
    const boneBases = collectBoneBases(skeleton);
    const leavesByBone = new Map();
    this.meshes = [];
    this.depthMap = depthMap;
    this.normalMap = normalMap;
    this.opacityMap = opacityMap;
    this.normalVariation = uniform(0.5);
    this.depthDistance = uniform(0.02);
    const leavesFolder = configFolder.addFolder({ title: "leaves", expanded: false });
    leavesFolder.addBinding(this.normalVariation, "value", {
      label: "normal variation",
      min: 0,
      max: 1,
      step: 0.01,
    });
    leavesFolder.addBinding(this.depthDistance, "value", {
      label: "depth distance",
      min: 0,
      max: 0.1,
      step: 0.001,
    });

    for (const leaf of parseLeaves(csvText)) {
      const bone = findClosestBone(leaf.position, boneBases);
      leaf.position = bone.worldToLocal(leaf.position.clone());
      if (!leavesByBone.has(bone)) leavesByBone.set(bone, []);
      leavesByBone.get(bone).push(leaf);
    }

    const material = new MeshStandardNodeMaterial({
      color: "#92AD2A",
      side: THREE.DoubleSide,
      roughness: 0.85,
      alphaMap: opacityMap,
      alphaTest: 0.75,
    });
    leavesFolder.addBinding(material, "alphaTest", {
      label: "alpha test",
      min: 0,
      max: 1,
      step: 0.01,
    });
    const worldCenter = modelWorldMatrix.mul(
      vec4(attribute("leafCenter", "vec3"), 1),
    ).xyz;
    material.vertexNode = instancedBillboarding(
      worldCenter,
      attribute("leafScale", "float"),
      attribute("leafRotation", "float"),
    );
    // Match the Z correction used by sampleIBLIrradiance for bark and the
    // original leaves, before converting the world-space normal to view space.
    const leafNormal = attribute("normal", "vec3");
    const lightingNormal = normalize(vec3(
      leafNormal.x,
      leafNormal.y,
      leafNormal.z.negate(),
    ));
    // Use the same stable tangent basis and texture interpretation as Bush.
    const worldUp = vec3(0, 1, 0);
    const fallbackAxis = vec3(1, 0, 0);
    const referenceAxis = select(
      abs(lightingNormal.dot(worldUp)).greaterThan(0.999),
      fallbackAxis,
      worldUp,
    );
    const tangent = normalize(referenceAxis.cross(lightingNormal));
    const bitangent = normalize(lightingNormal.cross(tangent));
    const encodedNoiseNormal = normalize(texture(normalMap, uv()).xyz);
    const tangentSpaceNormal = normalize(
      tangent.mul(encodedNoiseNormal.x)
        .add(bitangent.mul(encodedNoiseNormal.y))
        .add(lightingNormal.mul(encodedNoiseNormal.z)),
    );
    const finalNormal = normalize(mix(
      lightingNormal,
      tangentSpaceNormal,
      this.normalVariation,
    ));
    material.normalNode = normalize(transformNormalByViewMatrix(
      finalNormal,
      cameraViewMatrix,
    ));

    const signedDepthOffset = texture(depthMap, uv()).r.mul(2).sub(1);
    const adjustedViewZ = positionView.z.sub(
      signedDepthOffset.mul(this.depthDistance),
    );
    material.depthNode = clamp(
      viewZToPerspectiveDepth(adjustedViewZ, cameraNear, cameraFar),
      0,
      1,
    );

    for (const [bone, leaves] of leavesByBone) {
      const geometry = new THREE.PlaneGeometry(1, 1);
      const centers = new THREE.InstancedBufferAttribute(
        new Float32Array(leaves.length * 3), 3,
      );
      const scales = new THREE.InstancedBufferAttribute(
        new Float32Array(leaves.length), 1,
      );
      const rotations = new THREE.InstancedBufferAttribute(
        new Float32Array(leaves.length), 1,
      );
      const normals = new THREE.InstancedBufferAttribute(
        new Float32Array(leaves.length * 3), 3,
      );
      const mesh = new THREE.InstancedMesh(geometry, material, leaves.length);
      const matrix = new THREE.Matrix4();
      const rotation = new THREE.Quaternion();
      const scale = new THREE.Vector3();

      leaves.forEach(({ position, size, normal, roll }, index) => {
        centers.setXYZ(index, position.x, position.y, position.z);
        scales.setX(index, size);
        rotations.setX(index, roll);
        normals.setXYZ(index, normal.x, normal.y, normal.z);
        matrix.compose(position, rotation, scale.setScalar(size));
        mesh.setMatrixAt(index, matrix);
      });
      geometry.setAttribute("leafCenter", centers);
      geometry.setAttribute("leafScale", scales);
      geometry.setAttribute("leafRotation", rotations);
      geometry.setAttribute("normal", normals);
      mesh.instanceMatrix.needsUpdate = true;
      mesh.name = "TreeLeafBillboards";
      // Billboard rotation happens in the shader, outside the CPU plane bounds.
      mesh.frustumCulled = false;
      bone.add(mesh);
      this.meshes.push(mesh);
    }
  }
}

export { TreeLeaves };

function collectBoneBases(skeleton) {
  const boneBases = [];
  skeleton.updateWorldMatrix(true, true);
  skeleton.traverse((bone) => {
    if (!bone.isBone || bone.children.some((child) => child.isBone)) return;
    boneBases.push({
      bone,
      position: bone.getWorldPosition(new THREE.Vector3()),
    });
  });
  return boneBases;
}

function findClosestBone(worldPosition, boneBases) {
  let closest = null;
  let closestDistanceSquared = Infinity;

  for (const boneBase of boneBases) {
    const distanceSquared = worldPosition.distanceToSquared(boneBase.position);
    if (distanceSquared < closestDistanceSquared) {
      closest = boneBase.bone;
      closestDistanceSquared = distanceSquared;
    }
  }

  if (!closest) {
    throw new Error("TreeLeaves requires a skeleton with at least one bone");
  }

  return closest;
}

function parseLeaves(csvText) {
  const [header, ...rows] = csvText.trim().split(/\r?\n/);
  const columns = Object.fromEntries(
    header.split(",").map((name, index) => [name.trim(), index]),
  );

  return rows
    .filter((row) => row.trim())
    .map((row) => {
      const values = row.split(",");
      return {
        position: new THREE.Vector3(
          Number(values[columns.pos_x]),
          Number(values[columns.pos_y]),
          Number(values[columns.pos_z]),
        ),
        size: Number(values[columns.scale_x]),
        roll: THREE.MathUtils.degToRad(Number(values[columns.rot_z_deg])),
        normal: new THREE.Vector3(
          Number(values[columns.normal_x]),
          Number(values[columns.normal_y]),
          Number(values[columns.normal_z]),
        ),
      };
    })
    .filter(({ position, size, normal, roll }) =>
      [position.x, position.y, position.z, size, roll,
        normal.x, normal.y, normal.z].every(Number.isFinite),
    );
}
