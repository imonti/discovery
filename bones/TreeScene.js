import * as THREE from "three";
import { RenderPipeline } from "three/webgpu";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { gaussianBlur } from "three/addons/tsl/display/GaussianBlurNode.js";
import { BarkMaterial } from "./BarkMaterial.js";
import { findNodeByName } from "./GraphUtils.js";
import { shortestArcQuaternion } from "./Utils.js";
import { Windvane } from "./Windvane.js";
import { TreeLeaves } from "./TreeLeaves.js";
import { LeafParticles } from "./LeafParticles.js";
import { Grass } from "./Grass.js";
import { configFolder } from "./config.js";
import { mix, pass, uniform } from "three/tsl";
import leafParticleTextureUrl from "./model/leaf.png?url";
import grassTextureUrl from "./model/grass.png?url";
import treeModelUrl from "./model/tree.glb?url";
import forestEnvironmentUrl from "./model/forest.exr?url";
import barkDiffuseTextureUrl from "./model/bark_diffuse.png?url";
import barkNormalTextureUrl from "./model/bark_normal.png?url";
import leafInstancesUrl from "./model/leaf_instances.csv?url";
import grassInstancesUrl from "./model/grass_instances.csv?url";
import leafDepthTextureUrl from "../bush/assets/leaves_cluster_depth.png?url";
import leafNormalTextureUrl from "../bush/assets/leaves_cluster_normal.png?url";
import leafOpacityTextureUrl from "../bush/assets/leaves_cluster_opacity.png?url";

class TreeScene extends THREE.Object3D {
  windvane = null;
  skeleton = null;
  model = null;
  leaves = null;
  leafParticles = null;
  grass = null;
  barkDiffuseTexture = null;
  barkNormalTexture = null;
  environmentTexture = null;
  environmentBackground = null;
  postProcessing = null;
  blurIntensity = uniform(0.8);
  softness = uniform(0.35);
  environmentSettings = {
    rotationX: Math.PI / 2,
    rotationY: 0,
    rotationZ: 0,
    preview: false,
  };

  constructor() {
    super();

    const environmentFolder = configFolder.addFolder({ title: "environment", expanded: false });
    for (const axis of ["X", "Y", "Z"]) {
      const rotationBinding = environmentFolder.addBinding(
        this.environmentSettings,
        `rotation${axis}`,
        {
          label: `rotation ${axis.toLowerCase()}`,
          min: -Math.PI,
          max: Math.PI,
          step: 0.01,
        },
      );
      rotationBinding.on("change", () => {
        this.updateEnvironmentRotation();
      });
    }

    const previewBinding = environmentFolder.addBinding(
      this.environmentSettings,
      "preview",
      { label: "background preview" },
    );
    previewBinding.on("change", () => {
      this.updateEnvironmentRotation();
    });

    const postProcessingFolder = configFolder.addFolder({
      title: "post processing",
      expanded: false,
    });
    postProcessingFolder.addBinding(this.blurIntensity, "value", {
      label: "blur radius",
      min: 0,
      max: 10,
      step: 0.01,
    });
    postProcessingFolder.addBinding(this.softness, "value", {
      label: "softness",
      min: 0,
      max: 1,
      step: 0.01,
    });
  }

  initializePostProcessing(renderer, camera) {
    const scenePass = pass(this.parent, camera);
    const scenePassColor = scenePass.getTextureNode("output");
    const blur = gaussianBlur(scenePassColor, this.blurIntensity, 4);

    this.postProcessing = new RenderPipeline(renderer);
    this.postProcessing.outputNode = mix(scenePassColor, blur, this.softness);
  }

  updateEnvironmentRotation() {
    const scene = this.parent;
    if (!scene?.isScene) return;

    const { rotationX, rotationY, rotationZ, preview } =
      this.environmentSettings;
    scene.environmentRotation.set(rotationX, rotationY, rotationZ);

    if (preview && this.environmentTexture) {
      scene.background = this.environmentTexture;
      scene.backgroundRotation.copy(scene.environmentRotation);
    } else if (this.environmentBackground) {
      scene.background = this.environmentBackground;
    }
  }

  load() {
    const gltfLoader = new GLTFLoader();
    const exrLoader = new EXRLoader();
    const textureLoader = new THREE.TextureLoader();

    Promise.all([
      gltfLoader.loadAsync(treeModelUrl),
      exrLoader.loadAsync(forestEnvironmentUrl),
      textureLoader.loadAsync(barkDiffuseTextureUrl),
      textureLoader.loadAsync(barkNormalTextureUrl),
      textureLoader.loadAsync(leafParticleTextureUrl),
      textureLoader.loadAsync(grassTextureUrl),
      textureLoader.loadAsync(leafDepthTextureUrl),
      textureLoader.loadAsync(leafNormalTextureUrl),
      textureLoader.loadAsync(leafOpacityTextureUrl),
      fetch(leafInstancesUrl).then((response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load leaf_instances.csv: ${response.status}`,
          );
        }
        return response.text();
      }),
      fetch(grassInstancesUrl).then((response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load grass_instances.csv: ${response.status}`,
          );
        }
        return response.text();
      }),
    ]).then(
      ([
        { scene },
        environmentTexture,
        barkDiffuseTexture,
        barkNormalTexture,
        leafParticleTexture,
        grassTexture,
        leafDepthTexture,
        leafNormalTexture,
        leafOpacityTexture,
        leafCsv,
        grassCsv,
      ]) => {
        environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
        this.environmentTexture = environmentTexture;
        if (this.parent?.isScene) {
          this.environmentBackground = this.parent.background;
          this.parent.environment = environmentTexture;
          this.updateEnvironmentRotation();
        }
        this.barkDiffuseTexture = barkDiffuseTexture;
        this.barkDiffuseTexture.colorSpace = THREE.SRGBColorSpace;
        this.barkDiffuseTexture.wrapS = THREE.RepeatWrapping;
        this.barkDiffuseTexture.wrapT = THREE.RepeatWrapping;
        this.barkNormalTexture = barkNormalTexture;
        this.barkNormalTexture.wrapS = THREE.RepeatWrapping;
        this.barkNormalTexture.wrapT = THREE.RepeatWrapping;
        this.model = scene;
        for (const texture of [leafDepthTexture, leafNormalTexture, leafOpacityTexture]) {
          texture.colorSpace = THREE.NoColorSpace;
        }
        this.leaves = new TreeLeaves({
          csvText: leafCsv,
          skeleton: findNodeByName(scene, "Bone"),
          depthMap: leafDepthTexture,
          normalMap: leafNormalTexture,
          opacityMap: leafOpacityTexture,
        });
        this.leafParticles = new LeafParticles({
          texture: leafParticleTexture,
          environmentTexture,
        });
        this.windvane ??= new Windvane();
        this.grass = new Grass({
          csvText: grassCsv,
          texture: grassTexture,
          environmentTexture,
          windvane: this.windvane,
        });
        this.initialize();
      },
    );
  }

  initialize() {
    // The GLTF asset uses a coordinate frame that is rotated +90 degrees
    // around Z relative to this scene. Keep the complete loaded hierarchy
    // under this corrected root so geometry and bones receive the same
    // transform.
    // model.rotation.z = -Math.PI / 2;
    const model = this.model;
    model.updateMatrix();
    this.add(model);
    
    const particleCenter = this.leafParticles.boundingBox.getCenter(new THREE.Vector3());
    this.leafParticles.position.x = -particleCenter.x;
    this.leafParticles.position.y = -particleCenter.y * 2;
    this.add(this.leafParticles);

    const treeMesh = findNodeByName(model, "TreeGeometry");
    const geometry = treeMesh.geometry;
    geometry.computeBoundingBox();
    const modelHeight = geometry.boundingBox.max.z - geometry.boundingBox.min.z;
    const positions = geometry.getAttribute("position");
    const heights = new Float32Array(positions.count);
    for (let i = 0; i < positions.count; i++) {
      heights[i] = modelHeight > 0 ? positions.getZ(i) / modelHeight : 0;
    }
    geometry.setAttribute("height", new THREE.BufferAttribute(heights, 1));

    treeMesh.material = new BarkMaterial({
      map: this.barkDiffuseTexture,
      nMap: this.barkNormalTexture,
      environmentTexture: this.environmentTexture,
    });

    this.add(this.grass);

    this.windvane ??= new Windvane();
    this.windvane.onChange = () => this.update(0);
    this.windvane.enableConfig();
    // this.add(this.windvane.display);

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
    const distanceExponent = 3;
    this.skeleton.updateWorldMatrix(false, true);
    this.skeleton.traverse((bone) => {
      if (!bone.isBone) return;
      bone.userData.initialMatrix = bone.matrix.clone();
      bone.userData.initialPosition = bone.position.clone();
      bone.userData.initialScale = bone.scale.clone();

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

      // Vector2 uses x for world X and y for world Y. The Reference Point starts
      // at the origin, so this is the rest-pose sampling coordinate. During
      // update(), the moving Reference Point is subtracted from this value.
      bone.userData.uv = new THREE.Vector2(worldPosition.x, worldPosition.y);
      bone.userData.noiseScale = this.computeNoiseScale(bone);
    });
  }

  computeNoiseScale(bone) {
    const maxNoiseScale = this.windvane.windSamplers.length - 1;
    const hasNoiseScale =
      bone.userData.noiseScale !== undefined &&
      bone.userData.noiseScale !== null;

    if (!hasNoiseScale) {
      // Automatically add finer octaves as the bone gets farther from the
      // root. Divide the normalized depth into one band per sampler so the
      // highest octave is assigned to the entire final band.
      const samplerCount = this.windvane.windSamplers.length;
      return Math.min(
        maxNoiseScale,
        Math.floor(bone.userData.normalizedDepth * samplerCount),
      );
    }

    const rawNoiseScale = Number(bone.userData.noiseScale);
    const sanitizedNoiseScale = Number.isFinite(rawNoiseScale)
      ? Math.floor(rawNoiseScale)
      : 0;

    return THREE.MathUtils.clamp(sanitizedNoiseScale, 0, maxNoiseScale);
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
