import * as THREE from "three";

export default function octreeSubdivision(voxel) {
  const box = voxel.box ?? voxel.voxel;
  const { min, max } = box;
  const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
  const triangles = voxel.triangles ?? [];

  const octree = [];

  for (let xi = 0; xi < 2; xi++) {
    for (let yi = 0; yi < 2; yi++) {
      for (let zi = 0; zi < 2; zi++) {
        const childMin = new THREE.Vector3(
          xi === 0 ? min.x : center.x,
          yi === 0 ? min.y : center.y,
          zi === 0 ? min.z : center.z,
        );
        const childMax = new THREE.Vector3(
          xi === 0 ? center.x : max.x,
          yi === 0 ? center.y : max.y,
          zi === 0 ? center.z : max.z,
        );
        const childBox = new THREE.Box3(childMin, childMax);
        const childTriangles = [];

        for (const triangle of triangles) {
          const intersects =
            childBox.intersectsTriangle(triangle) ||
            childBox.containsPoint(triangle.a) ||
            childBox.containsPoint(triangle.b) ||
            childBox.containsPoint(triangle.c);

          if (intersects) {
            childTriangles.push(triangle);
          }
        }

        if (childTriangles.length > 0) {
          octree.push({
            box: childBox,
            triangles: childTriangles,
          });
        }
      }
    }
  }

  return octree;
}