import {
  cameraProjectionMatrix,
  cameraViewMatrix,
  cos,
  Fn,
  modelWorldMatrix,
  positionGeometry,
  sin,
} from 'three/tsl'

/**
 * Builds a GPU billboard transform for an instanced plane.
 *
 * Each instance supplies:
 * - `instanceCenter`: the world-space center of the plane.
 * - `instanceScale`: the uniform scale of the plane.
 * - `instanceRotation`: a roll angle around the camera-facing axis.
 *
 * The returned node produces clip-space vertex positions. The billboard
 * orientation and roll are evaluated in the vertex shader for every instance.
 */
export function instancedBillboarding(
  instanceCenter,
  instanceScale,
  instanceRotation,
) {
  return Fn(() => {
    // Start from the object's world matrix and replace its translation with
    // the current instance's center. `toVar()` makes the matrix mutable in the
    // generated shader code without changing the original model matrix node.
    const worldMatrix = modelWorldMatrix.toVar()
    worldMatrix[3][0] = instanceCenter.x
    worldMatrix[3][1] = instanceCenter.y
    worldMatrix[3][2] = instanceCenter.z

    // Convert the instance transform from world space into camera/view space.
    // The resulting matrix still contains the instance translation, which is
    // preserved while its rotation basis is replaced below.
    const viewMatrix = cameraViewMatrix.mul(worldMatrix).toVar()

    // Build a scaled 2D rotation matrix for a roll around the camera-facing
    // view-space Z axis. Multiplying cosine and sine by the instance scale
    // applies both rotation and uniform scale in the same basis.
    const scaledCosine = cos(instanceRotation).mul(instanceScale)
    const scaledSine = sin(instanceRotation).mul(instanceScale)

    // TSL matrices use column-first indexing: matrix[column][row]. These
    // assignments create the camera-facing X/Y basis with a random roll.
    viewMatrix[0][0] = scaledCosine
    viewMatrix[0][1] = scaledSine
    viewMatrix[0][2] = 0
    viewMatrix[1][0] = scaledSine.negate()
    viewMatrix[1][1] = scaledCosine
    viewMatrix[1][2] = 0

    // Keep the plane's local Z axis aligned with the camera-facing axis.
    // This is what preserves the billboard behavior while the X/Y basis rolls.
    viewMatrix[2][0] = 0
    viewMatrix[2][1] = 0
    viewMatrix[2][2] = instanceScale

    // Transform the plane's local vertex position into clip space:
    // projection * view * localPosition.
    return cameraProjectionMatrix.mul(viewMatrix).mul(positionGeometry)
  })()
}
