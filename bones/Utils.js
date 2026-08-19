import * as THREE from 'three'

function shortestArcQuaternion(from, to, restWorldQuaternion) {
  const fromDirection = from.clone().normalize();
  const toDirection = to.clone().normalize();
  const dot = THREE.MathUtils.clamp(fromDirection.dot(toDirection), -1, 1);

  // The directions already match, so no rotation is needed.
  if (dot > 1 - 1e-6) {
    return new THREE.Quaternion();
  }

  // Opposite directions have infinitely many equally short half-turns. Use
  // the rest-pose X axis as a stable fallback, projected onto the plane
  // perpendicular to the segment direction.
  if (dot < -1 + 1e-6) {
    const fallbackAxis = new THREE.Vector3(1, 0, 0)
      .applyQuaternion(restWorldQuaternion)
      .projectOnPlane(fromDirection);

    if (fallbackAxis.lengthSq() < 1e-8) {
      fallbackAxis
        .set(0, 0, 1)
        .applyQuaternion(restWorldQuaternion)
        .projectOnPlane(fromDirection);
    }

    return new THREE.Quaternion().setFromAxisAngle(
      fallbackAxis.normalize(),
      Math.PI,
    );
  }

  // For the ordinary case, Three.js returns the shortest rotation between
  // the two normalized directions.
  return new THREE.Quaternion().setFromUnitVectors(fromDirection, toDirection);
}


function printMatrix(m) {
  const e = m.elements.map((el) => {
    return el.toFixed(2).toString();
  });
  let s = "";
  s += e[0] + "," + e[1] + "," + e[2] + "," + e[3] + "\n";
  s += e[4] + "," + e[5] + "," + e[6] + "," + e[7] + "\n";
  s += e[8] + "," + e[9] + "," + e[10] + "," + e[11] + "\n";
  s += e[12] + "," + e[13] + "," + e[14] + "," + e[15] + "\n";
  console.log(s);
}

export { shortestArcQuaternion, printMatrix }