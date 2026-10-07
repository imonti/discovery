import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  float,
  hash,
  normalWorld,
  positionWorld,
  rotate,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { Pane } from "tweakpane";
import { DirectionalShadow } from "./DirectionalShadow.js";

export function createScene(renderer) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const overlayScene = new THREE.Scene();
  const overlayCamera = new THREE.OrthographicCamera(
    0,
    window.innerWidth,
    window.innerHeight,
    0,
    -1,
    1,
  );

  const directionalShadow = new DirectionalShadow(renderer, scene);
  scene.add(directionalShadow.shadowCamera);
  scene.add(directionalShadow.cameraHelper);

  const shadowCameraInitialOffset = directionalShadow.shadowCamera.position.clone();
  const shadowCameraRadius = shadowCameraInitialOffset.length();
  const shadowCameraOrbit = {
    // The orbit starts from (0, 0, -radius), then rotates around world X and Y.
    x: Math.atan2(shadowCameraInitialOffset.y, -shadowCameraInitialOffset.z),
    y: 0,
  };
  const shadowCameraBaseOffset = new THREE.Vector3(0, 0, -shadowCameraRadius);
  const shadowCameraOffset = new THREE.Vector3();
  const shadowCameraXAxis = new THREE.Vector3(1, 0, 0);
  const shadowCameraYAxis = new THREE.Vector3(0, 1, 0);

  // Undo the initial X orbit before computing the corresponding Y orbit angle.
  const shadowCameraUnrotatedOffset = shadowCameraInitialOffset
    .clone()
    .applyAxisAngle(shadowCameraXAxis, -shadowCameraOrbit.x);
  shadowCameraOrbit.y = Math.atan2(
    -shadowCameraUnrotatedOffset.x,
    -shadowCameraUnrotatedOffset.z,
  );

  function updateShadowCamera() {
    shadowCameraOffset
      .copy(shadowCameraBaseOffset)
      .applyAxisAngle(shadowCameraXAxis, shadowCameraOrbit.x)
      .applyAxisAngle(shadowCameraYAxis, shadowCameraOrbit.y);

    directionalShadow.shadowCamera.position.copy(shadowCameraOffset);
    directionalShadow.shadowCamera.lookAt(0, 0, 0);
    directionalShadow.shadowCamera.updateMatrixWorld();

    const lightDirection = new THREE.Vector3();
    directionalShadow.shadowCamera.getWorldDirection(lightDirection).negate();
    directionalShadow.lightDirectionNode.value.copy(lightDirection);
    directionalShadow.shadowMatrix.multiplyMatrices(
      directionalShadow.shadowCamera.projectionMatrix,
      directionalShadow.shadowCamera.matrixWorldInverse,
    );
  }

  const shadowFolder = new Pane({ title: "Directional shadow" });
  shadowFolder.addBinding(shadowCameraOrbit, "x", {
    label: "x rotation (rad)",
    min: 0,
    max: Math.PI,
    step: 0.01,
  });
  shadowFolder.addBinding(shadowCameraOrbit, "y", {
    label: "y rotation (rad)",
    min: 0,
    max: Math.PI,
    step: 0.01,
  });
  shadowFolder.on("change", updateShadowCamera);

  const shadowSettings = {
    filterRadius: 1,
  };
  const shadowFilterRadius = uniform(shadowSettings.filterRadius);
  shadowFolder
    .addBinding(shadowSettings, "filterRadius", {
      label: "filter radius (texels)",
      min: 0,
      max: 8,
      step: 0.1,
    })
    .on("change", (event) => {
      shadowFilterRadius.value = event.value;
    });

  overlayCamera.layers.enable(directionalShadow.visualLayer);
  overlayScene.add(directionalShadow.helper);

  const overlayPanelSize = 200;
  const overlayMargin = 16;
  directionalShadow.helper.scale.set(overlayPanelSize, overlayPanelSize, 1);
  directionalShadow.helper.position.set(
    overlayMargin + overlayPanelSize * 0.5,
    window.innerHeight - overlayMargin - overlayPanelSize * 0.5,
    0,
  );

  const grid = new THREE.GridHelper(10, 10, 0x888888, 0xcccccc);
  grid.layers.set(directionalShadow.visualLayer);
  scene.add(grid);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new MeshBasicNodeMaterial(),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.01;

  // The shadow pass follows the renderer's drawing-buffer resolution.
  const shadowMapSize = uniform(new THREE.Vector2());
  renderer.getDrawingBufferSize(shadowMapSize.value);

  // Transform the floor fragment from world space into shadow-camera clip space.
  const shadowClipPosition = directionalShadow.shadowMatrixNode.mul(
    vec4(positionWorld, 1),
  );
  // Perform the perspective divide to obtain normalized device coordinates.
  const shadowNdc = shadowClipPosition.xyz.div(shadowClipPosition.w);
  // Map NDC XY from [-1, 1] into shadow-texture UV coordinates [0, 1].
  // WebGPU render-target textures use the opposite Y origin from NDC UVs.
  const shadowUv = shadowNdc.xy.mul(vec2(0.5, -0.5)).add(0.5);
  // WebGPU NDC Z already matches the depth-texture range [0, 1].
  const receiverDepth = shadowNdc.z;
  // Sample the closest surface recorded by the shadow camera at this UV.
  const storedDepth = directionalShadow.shadowDepth.sample(shadowUv);
  // Increase the tolerance where shadow coordinates change rapidly, reducing
  // self-shadowing artifacts at grazing angles.
  const bias = float(0.001).add(shadowNdc.xy.fwidth().length().mul(0.01));

  // Fixed Poisson-disk offsets. The center tap is handled separately so the
  // existing storedDepth sample can be reused, giving 16 taps in total.
  const poissonOffsets = [
    [-0.942, -0.399],
    [0.946, -0.769],
    [-0.094, -0.929],
    [0.345, 0.294],
    [-0.916, 0.458],
    [-0.815, -0.879],
    [-0.383, 0.277],
    [0.975, 0.756],
    [0.443, -0.975],
    [0.537, -0.474],
    [-0.265, -0.419],
    [0.792, 0.191],
    [-0.242, 0.997],
    [-0.814, 0.914],
    [0.200, 0.786],
  ];

  const shadowTexelSize = vec2(1).div(shadowMapSize);
  // Keep the Poisson pattern stable per fragment while breaking up repeated
  // orientations across the receiver. `hash()` returns a vec3 for the vec3
  // world-position seed, so use one component as the scalar angle seed.
  const angle = hash(positionWorld).x.mul(Math.PI * 2.0);
  const sampleVisibility = (sampleDepth) =>
    receiverDepth.greaterThan(sampleDepth.add(bias)).select(0, 1);
  const sampleShadow = ([x, y]) => {
    const rotatedOffset = rotate(vec2(x, y), angle);
    const sampleUv = shadowUv.add(
      shadowTexelSize.mul(rotatedOffset).mul(shadowFilterRadius),
    );
    // Let the texture's address mode resolve samples outside [0, 1].
    return sampleVisibility(directionalShadow.shadowDepth.sample(sampleUv));
  };

  const shadowVisibility = [
    sampleVisibility(storedDepth),
    ...poissonOffsets.map(sampleShadow),
  ].reduce((sum, sample) => sum.add(sample), float(0)).div(16);

  // Keep a little ambient visibility so shadowed floor fragments remain readable.
  const floorVisibility = shadowVisibility.mul(0.75).add(0.25);
  // Apply the computed visibility as the floor's final color.
  floor.material.colorNode = vec4(vec3(floorVisibility), 1);
  scene.add(floor);

  const baseColor = uniform(new THREE.Color(0xeeeeee));
  const diffuse = normalWorld
    .dot(directionalShadow.lightDirectionNode)
    .mul(0.5)
    .add(0.5);
  const shadedColor = baseColor.mul(diffuse);
  const cubeMaterial = new MeshBasicNodeMaterial();
  cubeMaterial.colorNode = vec4(shadedColor, 1);

  const cube = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cubeMaterial);
  cube.position.y = 0.5;
  cube.position.Z = 0.01;
  scene.add(cube);

  function resizeOverlay(width, height) {
    overlayCamera.right = width;
    overlayCamera.top = height;
    overlayCamera.updateProjectionMatrix();
    renderer.getDrawingBufferSize(shadowMapSize.value);
    directionalShadow.helper.position.set(
      overlayMargin + overlayPanelSize * 0.5,
      height - overlayMargin - overlayPanelSize * 0.5,
      0,
    );
  }

  return { scene, overlayScene, overlayCamera, resizeOverlay };
}
