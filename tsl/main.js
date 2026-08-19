import * as THREE from "three";
import { WebGPURenderer, MeshBasicNodeMaterial } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Grid } from "./Grid";
import { Bush } from "./Bush";
import { distributePointsOnSurface } from "./distributePointsOnPlane";
import perlinNoiseUrl from "./models/perlinNoise.png?url";
import { add, positionLocal, positionWorld, texture, uniform, uv, vec3 } from "three/tsl";
import { pane } from './pane'

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x18181b);

const grid = new Grid();
scene.add(grid);

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(20, 5, 20);

const renderer = new WebGPURenderer({ antialias: true });
await renderer.init();
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 1, 0);
controls.update();

const bush = new Bush();
const bushGeometry = bush.geometry;
const bushMaterial = bush.material;
const bushCount = 1;
const bushRange = 30;
const bushPositions = [];
const instanceTransform = new THREE.Matrix4();
const bushIdentity = new THREE.Quaternion();
const bushScale = new THREE.Vector3(1, 1, 1).multiplyScalar(2.0);
const bushMaxScale = 1.5;
const rotationAxis = new THREE.Vector3(0, 1, 0);

// distributePointsOnSurface(bushRange, bushRange, bushCount).forEach((point) => {
//   const bp = new THREE.Vector3();
//   bp.setX(point.x - bushRange * 0.5);
//   bp.setZ(point.y - bushRange * 0.5);
//   bushPositions.push(bp);
// });
bushPositions.push(new THREE.Vector3())

const bushInstances = new THREE.InstancedMesh(
  bushGeometry,
  bushMaterial,
  bushCount,
);

const perlinNoiseTexture = await new THREE.TextureLoader().loadAsync(perlinNoiseUrl);
perlinNoiseTexture.wrapS = THREE.RepeatWrapping;
perlinNoiseTexture.wrapT = THREE.RepeatWrapping;

const u_time = uniform(0.0)
const perlinUv = positionWorld.xz.mul(1.0).add(u_time.mul(0.1))
const perlinColor = texture(perlinNoiseTexture, perlinUv).sub(0.5).mul(positionWorld.y)
// bushMaterial.positionNode = add(vec3(perlinColor.r, 0.0, 0.0))

const noisePlaneGeometry = new THREE.PlaneGeometry(bushRange, bushRange);
noisePlaneGeometry.applyMatrix4(
  new THREE.Matrix4().makeRotationX(Math.PI * 0.5),
);
const noisePlaneMaterial = new MeshBasicNodeMaterial();
noisePlaneMaterial.side = THREE.DoubleSide;
const uv_offset = uniform(new THREE.Vector2(0, 0));
noisePlaneMaterial.colorNode = texture(perlinNoiseTexture, uv().add(uv_offset));
const noisePlane = new THREE.Mesh(noisePlaneGeometry, noisePlaneMaterial);
noisePlane.position.y = -0.1;
scene.add(noisePlane);

for (let i = 0; i < bushCount; i++) {
  bushIdentity.setFromAxisAngle(rotationAxis, Math.random() * Math.PI * 2);
  // bushScale.setScalar(0.5 + Math.random() * bushMaxScale);
  instanceTransform.compose(bushPositions[i], bushIdentity, bushScale);
  bushInstances.setMatrixAt(i, instanceTransform);
}

bushInstances.instanceMatrix.needsUpdate = true;
scene.add(bushInstances);

const timer = new THREE.Timer();
timer.connect(document);

function animate(timestamp) {
  timer.update(timestamp);
  uv_offset.value.y += timer.getDelta() * 0.25;
  u_time.value += timer.getDelta()
  controls.update();
  renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
});

document.controls = controls;
