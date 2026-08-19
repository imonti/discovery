import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { findNodeByName } from "./GraphUtils.js";
import { shortestArcQuaternion } from "./Utils.js";
import { Windvane } from "./Windvane.js";

class TreeScene extends THREE.Object3D {
  windvane = null;
  skeleton = null;

  constructor() {
    super();
  }

  load() {
    const loader = new GLTFLoader();
    loader.loadAsync("./model/tree1.glb").then(({ scene }) => {
      this.initialize(scene);
    });
  }

  initialize(model) {
    // The GLTF asset uses a coordinate frame that is rotated +90 degrees
    // around Z relative to this scene. Keep the complete loaded hierarchy
    // under this corrected root so geometry and bones receive the same
    // transform.
    // model.rotation.z = -Math.PI / 2;
    model.updateMatrix();
    this.add(model);

    this.windvane = new Windvane();
    this.windvane.onChange = () => this.update(0);
    this.windvane.enableConfig();
    this.add(this.windvane.display);

    // find root
    this.skeleton = findNodeByName(model, "Bone");
    // compute max depth previous to full bone initialization
    let maxDepth = 0;
    this.skeleton.traverse((bone) => {
      if (bone.isBone) {
        // compute rest path distance to root
        bone.userData.depth = computeDepth(bone);
        // The largest rest-path distance is used to normalize every branch's
        // distance into the range [0, 1]. This is computed once because the rest
        // pose does not change during wind animation.
        maxDepth = Math.max(maxDepth, bone.userData.depth);
      }
    });
    this.skeleton.userData.maxDepth = maxDepth;

    const rootResponse = 0.1;
    const distanceExponent = 1.5;
    this.skeleton.updateWorldMatrix(false, true);
    this.skeleton.traverse((bone) => {
      if (!bone.isBone) return;
      bone.userData.initialMatrix = bone.matrix.clone();
      bone.userData.initialPosition = bone.position.clone();
      bone.userData.initialScale = bone.scale.clone();

      const rawNoiseScale = Number(bone.userData.noiseScale);
      const samplerIndex = Number.isFinite(rawNoiseScale)
        ? Math.floor(rawNoiseScale)
        : 0;
      bone.userData.noiseScale = THREE.MathUtils.clamp(
        samplerIndex,
        0,
        this.windvane.windSamplers.length - 1,
      );

      // Save the branch's original world orientation. Wind is always computed
      // from this rest pose, never from the branch's orientation in the
      // previous frame. This prevents wind rotations from accumulating.
      const initialWorldQuaternion = new THREE.Quaternion();
      bone.getWorldQuaternion(initialWorldQuaternion);
      bone.userData.initialWorldQuaternion = initialWorldQuaternion;
      // This is filled in during update(). Children use their parent's solved
      // world orientation to calculate their own local orientation.
      bone.userData.currentWorldQuaternion = initialWorldQuaternion.clone();
      const worldPosition = bone.getWorldPosition(new THREE.Vector3());
      const normalizedDepth =
        maxDepth > 0
          ? THREE.MathUtils.clamp(bone.userData.depth / maxDepth, 0, 1)
          : 0;

      bone.userData.normalizedDepth = normalizedDepth;
      bone.userData.susceptibility =
        rootResponse +
        (1 - rootResponse) * Math.pow(normalizedDepth, distanceExponent);

      // Vector2 uses x for world X and y for world Z. The Reference Point starts
      // at the origin, so this is the rest-pose sampling coordinate. During
      // update(), the moving Reference Point is subtracted from this value.
      bone.userData.uv = new THREE.Vector2(worldPosition.x, worldPosition.z);
    });
  }

  update(deltaTime = 0) {
    if (!this.skeleton) return;

    this.windvane.update(deltaTime);

    // w is a single normalized direction in world space. Every segment is
    // gradually tilted toward this same direction.
    const windDirection = this.windvane.getDirection();

    // Make sure the non-branch ancestors (normally the scene) have current
    // world transforms. Branch transforms themselves are solved below from the
    // rest pose, so their previous wind state is not used as input.
    if (this.skeleton.parent) {
      this.skeleton.parent.updateWorldMatrix(true, false);
    }

    this.skeleton.traverse((child) => {
      if (!child.isBone) return;

      const {
        initialPosition,
        initialScale,
        initialWorldQuaternion,
        currentWorldQuaternion,
        uv,
        susceptibility,
        noiseScale,
      } = child.userData;

      // The rest-pose coordinate is precomputed during initialization. Only
      // the moving Reference Point offset changes during animation.
      const noise = this.windvane.sampleNoise(
        uv.x - this.windvane.referencePoint.x,
        uv.y - this.windvane.referencePoint.y,
        noiseScale,
      );

      // The signed noise value creates local variation around the shared wind
      // direction. Distance susceptibility still controls how strongly each
      // branch responds.
      const branchK = THREE.MathUtils.clamp(
        this.windvane.getStrength() * noise * susceptibility,
        -0.5,
        0.5,
      );

      // A segment is defined by its local +Y axis: (0, 1, 0). Transform that
      // axis by the segment's original world orientation to get its rest
      // direction in world space.
      const restDirection = new THREE.Vector3(0, 1, 0).applyQuaternion(
        initialWorldQuaternion,
      );

      // Find the shortest rotation that takes the rest direction to the wind
      // direction. This rotation changes the segment's pointing direction
      // without adding an arbitrary roll around the segment's own axis.
      const fullTiltRotation = shortestArcQuaternion(
        restDirection,
        windDirection,
        initialWorldQuaternion,
      );

      // Slerping identity toward the full-tilt rotation scales the rotation's
      // angle by this branch's distance-weighted ratio.
      const interpolatedRotation = new THREE.Quaternion().slerp(
        fullTiltRotation,
        branchK,
      );

      // Quaternion multiplication order matters. premultiply applies the wind
      // rotation in world space to the original segment orientation:
      // desiredWorld = windRotation * restWorld.
      const desiredWorldQuaternion = initialWorldQuaternion
        .clone()
        .premultiply(interpolatedRotation);

      // Object3D.rotation is local to the parent. Convert the desired world
      // orientation into the parent's local coordinate system:
      // desiredLocal = inverse(parentWorld) * desiredWorld.
      const parentWorldQuaternion = child.parent.isBone
        ? child.parent.userData.currentWorldQuaternion
        : child.parent.getWorldQuaternion(new THREE.Quaternion());

      const desiredLocalQuaternion = parentWorldQuaternion
        .clone()
        .invert()
        .multiply(desiredWorldQuaternion);

      child.position.copy(initialPosition);
      child.quaternion.copy(desiredLocalQuaternion);
      child.scale.copy(initialScale);
      child.updateMatrix();
      child.updateWorldMatrix(false, true);

      // Store the solved world orientation so the next child can use it as its
      // parent orientation. root.traverse() visits parents before children.
      currentWorldQuaternion.copy(desiredWorldQuaternion);
    });
  }
}

export { TreeScene };

function computeDepth(node) {
  let distance = 0;
  let current = node;
  const currentPosition = new THREE.Vector3();
  const parentPosition = new THREE.Vector3();
  // Accumulate the rest-pose distance between consecutive bone origins.
  // Stop when we reach the root bone, rather than including non-bone GLTF
  // container nodes above it. The root bone therefore has distance 0.
  while (current.parent?.isBone) {
    current.getWorldPosition(currentPosition);
    current.parent.getWorldPosition(parentPosition);
    distance += currentPosition.distanceTo(parentPosition);
    current = current.parent;
  }

  return distance;
}
