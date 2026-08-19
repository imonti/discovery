import {
  AmbientLight,
  Color,
  DirectionalLight,
  PerspectiveCamera,
  Scene,
} from "three";
import * as THREE from "three";
import { WebGPURenderer } from "three/webgpu";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { Grid } from "./Grid.js";
import { TreeScene } from "./TreeScene.js";

const scene = new Scene();
scene.background = new Color(0x18181b);

const camera = new PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
);
camera.position.set(3, 1, 3);

const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const timer = new THREE.Timer();

const grid = new Grid();
scene.add(grid);

scene.add(new AmbientLight(0xffffff, 1.5));

const keyLight = new DirectionalLight(0xffffff, 3);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);

const tree = new TreeScene();
scene.add(tree)
tree.load()

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
