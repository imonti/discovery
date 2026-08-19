import * as THREE from "three";

export default function triangulate(geometry) {
  const triangles = [];
  const vertexBuffer = geometry.getAttribute("position");
  const indexBuffer = geometry.getIndex();
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const p2 = new THREE.Vector3();

  if (indexBuffer) {
    for (let i = 0; i < indexBuffer.count; i += 3) {
      const i0 = indexBuffer.getX(i);
      const i1 = indexBuffer.getX(i + 1);
      const i2 = indexBuffer.getX(i + 2);
      triangles.push(
        new THREE.Triangle(
          p0.clone().fromBufferAttribute(vertexBuffer, i0),
          p1.clone().fromBufferAttribute(vertexBuffer, i1),
          p2.clone().fromBufferAttribute(vertexBuffer, i2),
        ),
      );
    }

    return triangles;
  }

  for (let i = 0; i < vertexBuffer.count; i += 3) {
    triangles.push(
      new THREE.Triangle(
        p0.clone().fromBufferAttribute(vertexBuffer, i),
        p1.clone().fromBufferAttribute(vertexBuffer, i + 1),
        p2.clone().fromBufferAttribute(vertexBuffer, i + 2),
      ),
    );
  }

  return triangles;
}