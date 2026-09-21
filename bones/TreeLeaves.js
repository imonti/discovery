import * as THREE from "three";
import { LeavesMaterial } from "./LeavesMaterial.js";

class TreeLeaves extends THREE.Group {
  constructor({ csvText, texture, environmentTexture }) {
    super();

    this.name = "Leaves";

    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.repeat.set(1 / 3, 1 / 3);
    // Three.js UVs start at the bottom, so the image's top-left cell is
    // the third row from the bottom.
    texture.offset.set(0, 2 / 3);

    const material = new LeavesMaterial(texture, environmentTexture);
    const leafColor = new THREE.Color("#92AD2A");
    const transforms = parseLeafTransforms(csvText);

    for (const { position, rotation, scale, normal } of transforms) {
      const leaf = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
      leaf.position.copy(position);
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
      this.add(leaf);
    }
  }
}

export { TreeLeaves };

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
