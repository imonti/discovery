import {
  Color,
  DataTexture,
  BoxGeometry,
  Mesh,
  MeshBasicNodeMaterial,
  PerspectiveCamera,
  MirroredRepeatWrapping,
  NearestFilter,
  RGBAFormat,
  Scene,
  UnsignedByteType,
  Vector2,
  WebGPURenderer,
} from "three/webgpu";

import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  texture,
  texture3D,
  uv,
  uniform,
  Fn,
  vec4,
  pow3,
  add,
  attribute,
} from "three/tsl";
import * as THREE from "three";
import { createNoiseTexture3D } from "./noise3D";
import { createNoiseTexture2D } from "./noise2D";
import { coordParams, settings, textureParams } from "./config";
const scene = new Scene();
scene.background = new Color("#111111");

const aspectRatio = window.innerWidth / window.innerHeight;
const camera = new PerspectiveCamera(50, aspectRatio, 0.1, 10);
camera.position.x = 2;
camera.position.y = 2;
camera.position.z = 3;

const renderer = new WebGPURenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
document.controls = controls;

const material = new MeshBasicNodeMaterial();
const geometry = new BoxGeometry(1.5, 1.5, 1.5, 1, 1, 1);
// construct uvw attribute
const uvs = geometry.getAttribute("uv");
const pos = geometry.getAttribute("position");
geometry.computeBoundingSphere()
const geometrySize = geometry.boundingSphere.radius * 2
const uvw_data = new Float32Array(uvs.count * 3);
const uvwBuffer = new THREE.BufferAttribute(uvw_data, 3);
for (let i = 0; i < uvs.count; i++) {
  const x = pos.getX(i);
  const y = pos.getY(i);
  const z = pos.getZ(i);
  const nx = x / geometrySize
  const ny = y / geometrySize
  const nz = z / geometrySize
  uvwBuffer.setXYZ(i, nx, ny, nz)
}
geometry.setAttribute("uvw", uvwBuffer);
const mesh = new Mesh(geometry, material);
scene.add(mesh);

let currentTexture = null;
// Define custom uniforms and attributes
const uvwOffset = uniform(
  new THREE.Vector3(settings.u, settings.v, settings.w),
);

function onTextureParamsChange(ev) {
  if (ev && !ev.last) return;
  /** dispose previous texture if any */
  if (currentTexture !== null) {
    currentTexture.dispose();
  }

  const { textureSize, noiseScale, noiseType } = settings;
  const isNoise2D = noiseType.includes("2D");
  const isNoise3D = noiseType.includes("3D");
  /** Decide which type of texture we're creating */
  if (isNoise2D) {
    /** Create a 2D noise texture */
    currentTexture = createNoiseTexture2D(textureSize, noiseScale, noiseType);
    /** Update the material */
    material.colorNode = Fn(() => {
      const uv_offset = uv().add(uvwOffset.xy);
      const c = texture(currentTexture, uv_offset).r;
      return vec4(c, c, c, 1.0);
    })();
  } else if (isNoise3D) {
    const ts = Math.min(128, textureSize);
    currentTexture = createNoiseTexture3D(ts, noiseScale, noiseType);
    /** Update the material */
    material.colorNode = Fn(() => {
      const uvw = attribute("uvw", "vec3");
      const uvw_offset = uvw.add(uvwOffset);
      const c = texture3D(currentTexture, uvw_offset).r;
      return vec4(c, c, c, 1.0);
    })();
  }

  material.needsUpdate = true;
}

function updateTextureCoords() {
  const { u, v, w } = settings;
  uvwOffset.value.set(u, v, w);
}

function updateCamera() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}

function render() {
  controls.update();
  renderer.render(scene, camera);
}

function animate() {
  requestAnimationFrame(animate);
  render();
}

function onResize() {
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight);
  updateCamera();
}

window.addEventListener("resize", onResize);

textureParams.on("change", onTextureParamsChange);
coordParams.on("change", updateTextureCoords);

await renderer.init();
onTextureParamsChange();
updateCamera();
animate();
