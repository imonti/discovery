import { TempNode } from "three/webgpu";
import {
  abs,
  cross,
  float,
  getScreenPosition,
  getViewPosition,
  normalize,
  reference,
  vec3,
  vec4,
  uv,
} from "three/tsl";

// Unit-length samples in tangent space. The local +Z axis is the surface
// normal, so every sample lies in the upper hemisphere (z >= 0).
const HEMISPHERE_KERNEL = [
  [0.000, 0.000, 1.000],
  [0.353, 0.000, 0.936],
  [-0.353, 0.000, 0.936],
  [0.000, 0.353, 0.936],
  [0.000, -0.353, 0.936],
  [0.500, 0.500, 0.707],
  [-0.500, 0.500, 0.707],
  [0.500, -0.500, 0.707],
  [-0.500, -0.500, 0.707],
  [0.707, 0.000, 0.707],
  [-0.707, 0.000, 0.707],
  [0.000, 0.707, 0.707],
  [0.000, -0.707, 0.707],
];

/**
 * Turns fixed tangent-space directions into view-space sample positions.
 *
 * The returned positions are ready to project into screen UVs and use for
 * depth lookups. `normal` and `viewPosition` must be in the same space.
 */
function createTangentSpaceKernel(viewPosition, normal, radius) {
  const n = normalize(normal);

  // Pick a helper axis that is not parallel to the normal. This avoids a
  // degenerate cross product when the normal points near +Z.
  const helper = abs(n.z).lessThan(0.999)
    ? vec3(0, 0, 1)
    : vec3(0, 1, 0);

  const tangent = normalize(cross(helper, n));
  const bitangent = cross(n, tangent);

  return HEMISPHERE_KERNEL.map(([x, y, z]) => {
    const tangentDirection = tangent.mul(x)
      .add(bitangent.mul(y))
      .add(n.mul(z));

    return viewPosition.add(tangentDirection.mul(radius));
  });
}

/**
 * Projects view-space sample positions back into screen UV coordinates.
 * `getScreenPosition` performs the perspective divide and accounts for the
 * coordinate-system-specific vertical flip used by the renderer.
 */
function projectKernelToUv(samplePositions, projectionMatrix) {
  return samplePositions.map((samplePosition) =>
    getScreenPosition(samplePosition, projectionMatrix),
  );
}

/**
 * Custom screen-space ambient occlusion node.
 *
 * The sampling algorithm will be added incrementally. For now the node keeps
 * the scene pass inputs and returns neutral occlusion so it can be connected
 * to the composition graph without changing the rendered image.
 */
class SSAONode extends TempNode {
  static get type() {
    return "SSAO";
  }

  constructor(depthNode, normalNode, camera) {
    super("vec4");

    this.depthNode = depthNode;
    this.normalNode = normalNode;
    this.camera = camera;
    this.cameraProjectionMatrixInverse = reference(
      "projectionMatrixInverse",
      "mat4",
      camera,
    );
  }

  setup() {
    const uvNode = uv();
    const depth = this.depthNode.sample(uvNode).r;
    const viewPosition = getViewPosition(
      uvNode,
      depth,
      this.cameraProjectionMatrixInverse,
    );

    // scenePass stores normalWorld, while viewPosition is view-space. Bring
    // the sampled normal into view space before constructing the basis.
    const cameraViewMatrix = reference("matrixWorldInverse", "mat4", this.camera);
    const cameraProjectionMatrix = reference(
      "projectionMatrix",
      "mat4",
      this.camera,
    );
    const worldNormal = this.normalNode.sample(uvNode).xyz;
    const viewNormal = normalize(
      cameraViewMatrix.mul(vec4(worldNormal, 0)).xyz,
    );

    const samplePositions = createTangentSpaceKernel(
      viewPosition,
      viewNormal,
      0.5,
    );
    const sampleUvs = projectKernelToUv(
      samplePositions,
      cameraProjectionMatrix,
    );
    const sampleDepths = sampleUvs.map((sampleUv) =>
      this.depthNode.sample(sampleUv).r,
    );
    const sampledPositions = sampleUvs.map((sampleUv, index) =>
      getViewPosition(
        sampleUv,
        sampleDepths[index],
        this.cameraProjectionMatrixInverse,
      ),
    );

    // A sampled surface is an occluder when it is closer to the camera than
    // the hypothetical kernel position. Compare reconstructed view-space Z
    // values rather than raw depth values, which are nonlinear under
    // perspective projection.
    const depthBias = 0.025;
    const occlusionSamples = sampledPositions.map(
      (sampledPosition, index) =>
        sampledPosition.z
          .greaterThan(samplePositions[index].z.add(depthBias))
          .select(1, 0),
    );

    const occlusion = occlusionSamples.reduce(
      (sum, occlusionSample) => sum.add(occlusionSample),
      float(0),
    ).div(occlusionSamples.length);

    // Convert the fraction of occluded samples into visibility. The strength
    // leaves some ambient light so the AO pass does not turn contacts black.
    const visibility = occlusion.mul(0.85).oneMinus();

    return vec4(vec3(visibility), 1);
  }
}

export const ssao = (depthNode, normalNode, camera) =>
  new SSAONode(depthNode, normalNode, camera);

export { SSAONode };
export { createTangentSpaceKernel, projectKernelToUv };
