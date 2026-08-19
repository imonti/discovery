import * as THREE from "three";
import triangulate from "./nodes/triangulate";
import isPointInMesh from './isPointInMesh'

export default function pointGrid(geometry, subdivision) {
  // preparation
  geometry.computeBoundingBox();
  const aabb = geometry.boundingBox;
  const triangleMesh = triangulate(geometry);
  const size = aabb.max.clone().sub(aabb.min);
  const cellSize = size.clone().divideScalar(subdivision);
  const offsetVector = new THREE.Vector3();
  const point = new THREE.Vector3();
  const output = [];

  for (let _x = 0; _x < subdivision; _x++) {
    for (let _y = 0; _y < subdivision; _y++) {
      for (let _z = 0; _z < subdivision; _z++) {
        const offset_x = _x * cellSize.x + cellSize.x * 0.5
        const offset_y = _y * cellSize.y + cellSize.y * 0.5
        const offset_z = _z * cellSize.z + cellSize.z * 0.5
        offsetVector.set(offset_x, offset_y, offset_z);
        point.addVectors(aabb.min, offsetVector)

        if (isPointInMesh(point, triangleMesh)) {
          output.push(point.clone());
        }
      }
    }
  }

  return output;

}

