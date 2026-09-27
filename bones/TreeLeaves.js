import * as THREE from "three";
import { LeavesMaterial } from "./LeavesMaterial.js";

class TreeLeaves {
  constructor({ csvText, texture, environmentTexture, skeleton }) {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const material = new LeavesMaterial(texture, environmentTexture);
    const leafColor = new THREE.Color("#92AD2A");
    const transforms = parseLeafTransforms(csvText);
    const boneBases = collectBoneBases(skeleton);
    // Keep sprite selection repeatable while still distributing leaves across
    // the 3x3 spritesheet grid.
    THREE.MathUtils.seededRandom(0x1eaf);

    for (const { position, rotation, scale, normal } of transforms) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      // Store normalized cell offsets: 0, 1/3, or 2/3 on each axis.
      const leafUvOffset = new THREE.Vector2(
        Math.floor(THREE.MathUtils.seededRandom() * 3) / 3,
        Math.floor(THREE.MathUtils.seededRandom() * 3) / 3,
      );
      const uvAttribute = leaf.geometry.getAttribute("uv");
      for (let vertexIndex = 0; vertexIndex < uvAttribute.count; vertexIndex++) {
        uvAttribute.setXY(
          vertexIndex,
          uvAttribute.getX(vertexIndex) / 3 + leafUvOffset.x,
          uvAttribute.getY(vertexIndex) / 3 + leafUvOffset.y,
        );
      }
      uvAttribute.needsUpdate = true;
      const bone = findClosestBone(position, boneBases);
      const localPosition = bone.worldToLocal(position.clone());
      leaf.position.copy(localPosition);
      // Preserve the exported rest-pose rotation values without compensating
      // for the new bone parent.
      leaf.rotation.copy(rotation);
      leaf.scale.set(scale.x, scale.y, 1);
      const vertexCount = leaf.geometry.getAttribute("position").count;
      const normals = new Float32Array(vertexCount * 3);
      for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
        normal.toArray(normals, vertexIndex * 3);
      }
      const normalBuffer = new THREE.BufferAttribute(normals, 3);
      leaf.geometry.setAttribute("normal", normalBuffer);
      const colors = new Float32Array(vertexCount * 3);
      for (let vertexIndex = 0; vertexIndex < vertexCount; vertexIndex += 1) {
        leafColor.toArray(colors, vertexIndex * 3);
      }
      leaf.geometry.setAttribute(
        "color",
        new THREE.BufferAttribute(colors, 3),
      );
      bone.add(leaf);
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

function parseLeafTransforms(csvText) {
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
    }))
    .filter(({ position, rotation, scale, normal }) =>
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
      ].every(Number.isFinite),
    );
}
