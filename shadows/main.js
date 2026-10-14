import * as THREE from "three";
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  RenderPipeline,
  ShadowNodeMaterial,
  WebGPURenderer,
} from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { EXRLoader } from "three/addons/loaders/EXRLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import {
  Fn,
  mrt,
  normalView,
  output,
  pass,
  uniform,
  uv,
  vec4,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { ssao } from "three/addons/tsl/display/SSAONode.js";
import { createConfig } from "./config.js";
import { createPCSSShadowNode } from "./PCSSShadowNode.js";
import grasslandsEnvironmentUrl from "./model/grasslands.exr?url";
import portalDiffuseUrl from "./model/PortalDiffuse.png?url";
import portalModelUrl from "./model/portal.glb?url";

const renderer = new WebGPURenderer({ antialias: true });
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.AgXToneMapping;
renderer.toneMappingExposure = 1.5;
await renderer.init();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(1.777357, 1.616713, 3.003873);

const scene = new THREE.Scene();

const environmentTexture = await new EXRLoader().loadAsync(
  grasslandsEnvironmentUrl,
);
environmentTexture.mapping = THREE.EquirectangularReflectionMapping;
// scene.background = environmentTexture;
scene.environment = environmentTexture;
scene.environmentIntensity = 0.25;
scene.backgroundRotation.set(
  0,
  THREE.MathUtils.degToRad(-85),
  0,
);
scene.environmentRotation.copy(scene.backgroundRotation);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.castShadow = true;
directionalLight.shadow.radius = 20;
directionalLight.shadow.shadowNode = createPCSSShadowNode(directionalLight);
directionalLight.shadow.mapSize.set(2048, 2048);
directionalLight.shadow.camera.left = -5;
directionalLight.shadow.camera.right = 5;
directionalLight.shadow.camera.top = 5;
directionalLight.shadow.camera.bottom = -5;
directionalLight.shadow.camera.near = 0.01;
directionalLight.shadow.camera.far = 20;
scene.add(directionalLight, directionalLight.target);

const initialLightOrbitAngle = THREE.MathUtils.degToRad(-25);
directionalLight.position.set(
  Math.sin(initialLightOrbitAngle) * 3,
  3,
  Math.cos(initialLightOrbitAngle) * 3,
);
directionalLight.target.position.set(0, 0, 0);

const floorShadow = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new ShadowNodeMaterial({
    color: 0x3c3d57,
    opacity: 0.4,
  }),
);
floorShadow.rotation.x = -Math.PI / 2;
floorShadow.position.y = -0.005;
floorShadow.receiveShadow = true;
scene.add(floorShadow);

const portalDiffuse = await new THREE.TextureLoader().loadAsync(portalDiffuseUrl);
portalDiffuse.colorSpace = THREE.SRGBColorSpace;
portalDiffuse.flipY = false;

const stoneMaterial = new MeshStandardNodeMaterial({
  color: 0xeeeeee,
  map: portalDiffuse,
  roughness: 1,
  metalness: 0,
});
stoneMaterial.receivedShadowNode = Fn(([shadow]) =>
  shadow.mul(0.5).add(0.5),
);

const { scene: portal } = await new GLTFLoader().loadAsync(portalModelUrl);
const portalBounds = new THREE.Box3().setFromObject(portal);
const portalCenter = portalBounds.getCenter(new THREE.Vector3());

portal.position.sub(
  new THREE.Vector3(portalCenter.x, portalBounds.min.y, portalCenter.z),
);
portal.position.y = 0;
portal.position.z += 0.01;
portal.rotation.y = -Math.PI / 2;

portal.traverse((object) => {
  if (!object.isMesh) return;

  const materials = Array.isArray(object.material)
    ? object.material
    : [object.material];
  const usesGemstoneMaterial =
    object.name === "Gem" ||
    materials.some((material) => material?.name === "Gemstone");

  if (!usesGemstoneMaterial) {
    object.material = stoneMaterial;
  }

  object.castShadow = true;
  object.receiveShadow = true;
});

scene.add(portal);

const scenePass = pass(scene, camera);
scenePass.setMRT(
  mrt({
    output,
    normal: normalView,
    uv: vec4(uv(), 0, 1),
  }),
);
const sceneColor = scenePass.getTextureNode("output");
const sceneNormal = scenePass.getTextureNode("normal");
const sceneUV = scenePass.getTextureNode("uv");
const sceneDepth = scenePass.getTextureNode("depth");
const ambientOcclusion = ssao(sceneDepth, sceneNormal, camera);
ambientOcclusion.intensity.value = 2;
const ssaoEnabled = uniform(1);

// Gemstone bloom
// The bloom source is rendered separately so the stone geometry cannot
// contribute to the effect. The original gemstone remains in the main scene
// with its authored material; this scene is only a post-processing input.
portal.updateMatrixWorld(true);
const gemstone = portal.getObjectByName("Gem");
const gemstoneMaterial = gemstone.material;

// Use an unlit, HDR-colored material for the bloom source. Keeping this
// material separate makes bloom intensity independent from the gemstone's
// normal lighting while the main scene continues using its regular material.
gemstoneMaterial.color = new THREE.Color("#90EDFD");
const gemstoneBloomMaterial = new MeshBasicNodeMaterial({
  color: new THREE.Color("#90EDFD").multiplyScalar(gemstoneMaterial.emissiveIntensity ?? 1),
  toneMapped: false,
});

// Clone the mesh so the bloom scene shares the gemstone geometry but can use
// a different material. Copying matrixWorld keeps the clone aligned with the
// transformed gemstone in the main portal scene.
const gemstoneBloom = gemstone.clone();
gemstoneBloom.material = gemstoneBloomMaterial;
gemstoneBloom.matrixAutoUpdate = false;
gemstoneBloom.matrix.copy(gemstone.matrixWorld);

const gemstoneScene = new THREE.Scene();
gemstoneScene.add(gemstoneBloom);

const gemstonePass = pass(gemstoneScene, camera);
const gemstoneColor = gemstonePass.getTextureNode("output");

// The main scene already contains the original gemstone, so its depth is equal
// to the bloom clone wherever the gemstone is visible. Compare linear depths
// and include equal values; geometry closer to the camera still occludes the
// bloom source before it reaches BloomNode.
const gemstoneDepth = gemstonePass.getLinearDepthNode();
const sceneLinearDepth = scenePass.getLinearDepthNode();
const gemstoneVisible = gemstoneDepth.lessThanEqual(sceneLinearDepth);
const gemstoneBloomSource = gemstoneColor.mul(gemstoneVisible);

// BloomNode performs the thresholding and blur internally. Its radius is
// normalized to 0..1; the result is added to the scene before tone mapping so
// AgX can roll the HDR glow into the final display range.
const bloomPass = bloom(gemstoneBloomSource);
bloomPass.threshold.value = 0;
bloomPass.strength.value = 0.2;
bloomPass.radius.value = 0.5;

const renderPipeline = new RenderPipeline(renderer);
renderPipeline.outputNode = vec4(
  sceneColor.rgb.mul(
    ambientOcclusion.r.mul(ssaoEnabled).add(ssaoEnabled.oneMinus()),
  ).add(bloomPass.rgb),
  sceneColor.a,
);
createConfig(
  renderer,
  directionalLight,
  floorShadow.material,
  camera,
  scene,
  ssaoEnabled,
  bloomPass,
);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 0.65, 0);

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  controls.update();
  renderPipeline.render();
}

window.addEventListener("resize", onResize);
renderer.setAnimationLoop(animate);
