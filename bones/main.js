import { Color, PerspectiveCamera, Scene } from "three";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Grid } from "./Grid.js";
import { TreeScene } from "./TreeScene.js";

const scene = new Scene();
scene.background = new Color(0xFFFFFF);

const camera = new PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
// Match the Blender authoring view: +X comes toward the camera, +Y is
// screen-right, and +Z is screen-up.
camera.position.set(3, -1, 1);
camera.up.set(0, 0, 1);

const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, -0.25, 0.5);
controls.update();
const timer = new THREE.Timer();

// const grid = new Grid();
// scene.add(grid);

const tree = new TreeScene();
scene.add(tree);
tree.load();

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  timer.update(timestamp);
  tree.update(timer.getDelta());
  controls.update();
  renderer.render(scene, camera);
}

window.addEventListener("resize", onResize);

await renderer.init();

animate();
