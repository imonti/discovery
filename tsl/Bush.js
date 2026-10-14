import * as THREE from "three";
import icosphereObj from "./models/icosphere.obj?raw";
import matcapTextureUrl from "./models/matcap2.png?url";
import leavesTextureUrl from "./models/leaves.png?url";
import noiseTextureUrl from "./models/perlinNoise.png?url";
import {
  Fn,
  matcapUV,
  normalFlat,
  normalGeometry,
  texture,
  uv,
  vec4,
} from "three/tsl";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import pointGrid from "./pointGrid";
import { MeshBasicNodeMaterial } from "three/webgpu";

const matcapTexture = new THREE.TextureLoader().load(matcapTextureUrl);
matcapTexture.colorSpace = THREE.SRGBColorSpace;
const leavesTexture = new THREE.TextureLoader().load(leavesTextureUrl);
leavesTexture.colorSpace = THREE.SRGBColorSpace;
const noiseTexture = new THREE.TextureLoader().load(noiseTextureUrl);

class Bush extends THREE.Mesh {
  constructor(volume) {
    const volume_centroid = new THREE.Vector3();
    if (!volume) {
      const scale = 0.3;
      const builtinVolume = new OBJLoader()
        .parse(icosphereObj)
        .children.find((child) => child.isMesh).geometry;
      const iScale = new THREE.Vector3(scale, scale, scale);
      const iTrans = new THREE.Vector3(0.0, -0.3, 0.0);
      const iRot = new THREE.Quaternion();
      const volumeMatrix = new THREE.Matrix4();
      volumeMatrix.compose(iTrans, iRot, iScale);
      builtinVolume.applyMatrix4(volumeMatrix);
      volume = builtinVolume;
    }
    volume.computeBoundingBox();
    volume.boundingBox.getCenter(volume_centroid);

    const points = pointGrid(volume, 4);
    const scrambler = new THREE.Vector3(0.0, 0.0, 0.0);
    const scrMax = new THREE.Vector3(1.0, 1.0, 1.0).multiplyScalar(0.2);
    const scrK = new THREE.Vector3(0.0, 0.0, 0.0);
    const rnd = Math.random;
    for (const point of points) {
      scrK.set(rnd(), rnd(), rnd());
      scrambler
        .copy(scrMax)
        .multiply(scrK)
        .sub(scrMax.clone().multiplyScalar(0.5));
      point.add(scrambler);
    }

    const spriteGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    const spriteTranslation = new THREE.Vector3(0.0, 0.5, 0.0);
    const spriteTransform = new THREE.Matrix4();
    spriteTransform.makeTranslation(spriteTranslation);
    spriteGeometry.applyMatrix4(spriteTransform);

    const geometryBatch = [];
    const instanceMatrix = new THREE.Matrix4();
    const instanceEuler = new THREE.Euler();
    const instanceQuaternion = new THREE.Quaternion();
    const instanceScale = new THREE.Vector3();
    const vPosition = new THREE.Vector3();
    const vNormal = new THREE.Vector3();
    const minScale = 1.0;
    const maxScale = 1.0;
    for (let i = 0; i < points.length; i++) {
      const xRotation = Math.PI * -0.25 + Math.random() * Math.PI * 0.5;
      const yRotation = Math.random() * Math.PI * 1.0;
      instanceEuler.set(xRotation, yRotation, 0.0);
      instanceQuaternion.setFromEuler(instanceEuler);
      instanceScale.setScalar((maxScale - minScale) * Math.random() + minScale);
      instanceMatrix.compose(points[i], instanceQuaternion, instanceScale);
      const instanceGeometry = spriteGeometry.clone();
      instanceGeometry.applyMatrix4(instanceMatrix);

      const ip = instanceGeometry.getAttribute("position");
      const instanceNormals = instanceGeometry.getAttribute("normal");
      for (let j = 0; j < ip.count; j++) {
        vPosition.set(ip.getX(j), ip.getY(j), ip.getZ(j));
        vNormal.copy(volume_centroid).sub(vPosition).normalize();
        instanceNormals.setXYZ(j, vNormal.x, vNormal.y, vNormal.z);
      }
      geometryBatch.push(instanceGeometry);
    }

    const geometry = mergeGeometries(geometryBatch);

    const material = new MeshBasicNodeMaterial();
    material.side = THREE.DoubleSide;
    material.alphaHash = true;
    material.alphaTest = 0.8;
    material.colorNode = Fn(() => {
      const normal = normalGeometry.mul(-0.5).add(0.5);
      const alpha = texture(leavesTexture, uv()).a;
      return vec4(texture(matcapTexture, normal).rgb, alpha);
    })();

    super(geometry, material);
  }
}

export { Bush };
