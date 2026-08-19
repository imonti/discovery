import * as THREE from "three";

export default function (geometry) {
  const vectors = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];
  const position = geometry.attributes.position;
  const centers = new Float32Array(position.count * 3);
  for (let i = 0, l = position.count; i < l; i++) {
    vectors[i % 3].toArray(centers, i * 3);
  }
  return new THREE.BufferAttribute(centers, 3)
}
