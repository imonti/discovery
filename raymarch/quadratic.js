function computeQuadraticRoots(a, b, c) {
  const d = b * b - 4 * (a * c);
  if (d < 0) return null;
  const r0 = (-b - Math.sqrt(d)) / (2 * a);
  const r1 = (-b + Math.sqrt(d)) / (2 * a);
  return [r0, r1];
}

function sphereRayIntersection(ro, rd, center, radius) {
  const m = ro.clone().sub(center);
  const a = rd.dot(rd);
  const b = 2 * m.dot(rd);
  const c = m.dot(m) - radius * radius;
  const roots = computeQuadraticRoots(a, b, c);

  if (!roots) return null;

  const [t0, t1] = roots;
  return [t0, t1];
}

// const rd = new THREE.Vector3(1.0, 0.0, 0.0);
// const ro = new THREE.Vector3(-1.0, 0.0, 0.0);
// const center = new THREE.Vector3(0.0, 0.0, 0.0);
// const radius = 0.25;
// const [t0, t1] = sphereRayIntersection(rd, ro, center, radius);
// const r0 = ro.clone().add(rd.clone().multiplyScalar(t0));
// const r1 = ro.clone().add(rd.clone().multiplyScalar(t1));
// console.log(r0, r1);