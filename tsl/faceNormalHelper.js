// DONT DISCARD THIS CODE: IT RENDERS NORMALS FOR EACH FACE RATHER THAN FOR EACH POINT LINE THE BUILTIN NORMAL HELPER
// const positionAttribute = icosphere.geometry.attributes.position;
// const normalAttribute = icosphere.geometry.attributes.normal;
// const faceCount = Math.floor(positionAttribute.count / 3);
// const normalSegmentAttribute = new THREE.BufferAttribute(
//   new Float32Array(faceCount * 2 * 3),
//   3,
// );
// const normalArrowLength = .2;
// const p0 = new THREE.Vector3();
// const p1 = new THREE.Vector3();
// const p2 = new THREE.Vector3();
// const n0 = new THREE.Vector3();
// const n1 = new THREE.Vector3();
// const n2 = new THREE.Vector3();
// const center = new THREE.Vector3();
// const faceNormal = new THREE.Vector3();
// const arrowEnd = new THREE.Vector3();

// for (let faceIndex = 0; faceIndex < faceCount; faceIndex++) {
//   const base = faceIndex * 3;

//   p0.fromBufferAttribute(positionAttribute, base);
//   p1.fromBufferAttribute(positionAttribute, base + 1);
//   p2.fromBufferAttribute(positionAttribute, base + 2);

//   center.copy(p0).add(p1).add(p2).multiplyScalar(1 / 3);

//   n0.fromBufferAttribute(normalAttribute, base);
//   n1.fromBufferAttribute(normalAttribute, base + 1);
//   n2.fromBufferAttribute(normalAttribute, base + 2);

//   faceNormal.copy(n0).add(n1).add(n2).multiplyScalar(1 / 3).normalize();
//   arrowEnd.copy(center).add(faceNormal.multiplyScalar(normalArrowLength));

//   const segmentBase = faceIndex * 2;
//   normalSegmentAttribute.setXYZ(segmentBase, center.x, center.y, center.z);
//   normalSegmentAttribute.setXYZ(
//     segmentBase + 1,
//     arrowEnd.x,
//     arrowEnd.y,
//     arrowEnd.z,
//   );
// }

// const normalHelperGeometry = new THREE.BufferGeometry();
// normalHelperGeometry.setAttribute("position", normalSegmentAttribute);
// const normalHelperMaterial = new THREE.LineBasicMaterial({ color: 0x8681b6});
// const normalMesh = new THREE.LineSegments(normalHelperGeometry, normalHelperMaterial);
// scene.add(normalMesh);