import * as THREE from 'three'

export function findClosestFaceNormal(geometry, point, target) {
  const positionAttribute = geometry.getAttribute('position')
  const indexAttribute = geometry.getIndex()
  const triangle = new THREE.Triangle()
  const vertexA = new THREE.Vector3()
  const vertexB = new THREE.Vector3()
  const vertexC = new THREE.Vector3()
  const closestPoint = new THREE.Vector3()
  const faceNormal = new THREE.Vector3()
  let closestDistanceSquared = Infinity

  const triangleCount = indexAttribute
    ? indexAttribute.count / 3
    : positionAttribute.count / 3

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex++) {
    const firstIndex = indexAttribute
      ? indexAttribute.getX(triangleIndex * 3)
      : triangleIndex * 3
    const secondIndex = indexAttribute
      ? indexAttribute.getX(triangleIndex * 3 + 1)
      : triangleIndex * 3 + 1
    const thirdIndex = indexAttribute
      ? indexAttribute.getX(triangleIndex * 3 + 2)
      : triangleIndex * 3 + 2

    vertexA.fromBufferAttribute(positionAttribute, firstIndex)
    vertexB.fromBufferAttribute(positionAttribute, secondIndex)
    vertexC.fromBufferAttribute(positionAttribute, thirdIndex)
    triangle.set(vertexA, vertexB, vertexC)
    triangle.closestPointToPoint(point, closestPoint)

    const distanceSquared = point.distanceToSquared(closestPoint)
    if (distanceSquared < closestDistanceSquared) {
      closestDistanceSquared = distanceSquared
      triangle.getNormal(faceNormal)
      target.copy(faceNormal)
    }
  }

  return target.normalize()
}
