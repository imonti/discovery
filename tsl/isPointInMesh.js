import * as THREE from "three";
import triangulate from "./nodes/triangulate";

// other heuristics may be: heuristics_normals, heuristics_raycasting (currently not working)
export default heuristics_winding_number;

const rayDirection = new THREE.Vector3(-1.0, 0.0, 0.0).normalize();
const ray = new THREE.Ray(new THREE.Vector3(0.0, 0.0, 0.0), rayDirection);
const raycastResult = new THREE.Vector3();

function heuristics_raycasting(point, triangles) {
  ray.origin.copy(point);
  const intersections = [];
  for (let i = 0; i < triangles.length; i++) {
    const { a, b, c } = triangles[i];
    let intersectionPoint = ray.intersectTriangle(a, b, c, false, raycastResult)
    if (intersectionPoint !== null) {
      const previouslyIntersected = intersections.find(ip => ip.equals(intersectionPoint))
      if(!previouslyIntersected) {
        intersections.push(intersectionPoint)
      }
    }
  }

  return intersections.length % 2 != 0;
}

function heuristics_normals(point, triangles) {
  const triangleCenter = new THREE.Vector3();
  const triangleNormal = new THREE.Vector3();
  const centerToPoint = new THREE.Vector3();

  for (let i = 0; i < triangles.length; i++) {
    const triangle = triangles[i];
    triangle.getMidpoint(triangleCenter);
    triangle.getNormal(triangleNormal);
    centerToPoint.subVectors(point, triangleCenter);

    if (centerToPoint.dot(triangleNormal) >= 0) {
      return false;
    }
  }

  return true;
}

function triangleSolidAngle(p, a, b, c) {
    const A = a.clone().sub(p);
    const B = b.clone().sub(p);
    const C = c.clone().sub(p);

    const numerator =
        A.dot(B.clone().cross(C));

    const denominator =
        A.length() * B.length() * C.length() +
        A.dot(B) * C.length() +
        B.dot(C) * A.length() +
        C.dot(A) * B.length();

    return 2 * Math.atan2(numerator, denominator);
}

function windingNumber(p, mesh) {
    let totalOmega = 0;
    for (const triangle of mesh) {
        const {a, b, c} = triangle
        totalOmega += triangleSolidAngle(p, a, b, c)
    }
    return totalOmega / (4 * Math.PI)
}

function heuristics_winding_number(p, mesh) {
    const w = windingNumber(p, mesh)
    return Math.abs(w) > 0.5;
}