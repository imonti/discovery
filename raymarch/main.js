import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import Stats from "stats-gl";
import { createRaymarchCube } from "./raymarchCube";
import * as THREE from "three/webgpu";

const scene = new THREE.Scene();
scene.background = new THREE.Color("#333333");

const aspectRatio = window.innerWidth / window.innerHeight;
const camera = new THREE.PerspectiveCamera(50, aspectRatio, 0.1, 10);
camera.position.x = 1;
camera.position.y = 1;
camera.position.z = 1.5;

const renderer = new THREE.WebGPURenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
await renderer.init();

const stats = new Stats({ trackGPU: true });
stats.init(renderer);
document.body.appendChild(stats.dom);


const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
document.controls = controls;

const raymarchCube = createRaymarchCube(1, 1, 1, camera);
document.raymarchCube = raymarchCube;
raymarchCube.rotateX(1);
scene.add(raymarchCube);

function updateCamera() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function onResize() {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCamera();
}

window.addEventListener("resize", onResize);

updateCamera();

renderer.setAnimationLoop(() => {
  controls.update();
  renderer.render(scene, camera);
  renderer.resolveTimestampsAsync(THREE.TimestampQuery.RENDER)
  stats.update();
});
