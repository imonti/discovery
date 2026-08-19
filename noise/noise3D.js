import * as THREE from "three";
import { lerp } from "three/src/math/MathUtils.js";

const samplerByName = {
  "3D Value": valueNoiseSampler,
  "3D Perlin": perlinNoiseSampler,
};

function valueNoiseSampler(size = 8) {
  /** Create the lattice */
  const lattice = new Float32Array(size * size * size);
  for (let z = 0; z < size; z++) {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const value = Math.random();
        let i = 0;
        i += z * size * size;
        i += y * size;
        i += x;
        lattice[i] = value;
      }
    }
  }
  /** create helper methods */
  function latticeValue(x, y, z) {
    x = ((x % size) + size) % size;
    y = ((y % size) + size) % size;
    z = ((z % size) + size) % size;
    return lattice[x + y * size + z * size * size];
  }

  // linear interpolation
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  // Perlin's fade curve
  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  /** create the noise sampler method */
  function sampler(x, y, z) {
    x = x * size;
    y = y * size;
    z = z * size;
    /* Find the containing voxel */
    /**
     * Find the containing voxel
     * x0, y0, z0 are the integer coordinates of the "lower" corner of the voxel
     * x1, y1, z1 are the integer coordinates of the "upper" corner of the voxel
     */
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const z0 = Math.floor(z);

    const x1 = x0 + 1;
    const y1 = y0 + 1;
    const z1 = z0 + 1;

    /**
     * fx, fy and fz are the local coordinates of the point within the voxel, ranging from 0 to 1
     * the fade function is applied to these local coordinates to smooth the interpolation
     */
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const fz = fade(z - z0);

    /**
     * Fetch the 8 corner values of the voxel from the lattice
     */
    const v000 = latticeValue(x0, y0, z0);
    const v100 = latticeValue(x1, y0, z0);

    const v010 = latticeValue(x0, y1, z0);
    const v110 = latticeValue(x1, y1, z0);

    const v001 = latticeValue(x0, y0, z1);
    const v101 = latticeValue(x1, y0, z1);

    const v011 = latticeValue(x0, y1, z1);
    const v111 = latticeValue(x1, y1, z1);

    /**
     * Interpolate along the x-axis for the four pairs of corners
     * Starting from the bottom face of the voxel (z0)
     */
    const x00 = lerp(v000, v100, fx);
    const x10 = lerp(v010, v110, fx);

    /**
     * And then the top face of the voxel (z1)
     */
    const x01 = lerp(v001, v101, fx);
    const x11 = lerp(v011, v111, fx);

    const y0v = lerp(x00, x10, fy);
    const y1v = lerp(x01, x11, fy);

    return lerp(y0v, y1v, fz);
  }

  return sampler;
}

function perlinNoiseSampler(size = 8) {
  const gradients = [
    new THREE.Vector3(1, 1, 0),
    new THREE.Vector3(-1, 1, 0),
    new THREE.Vector3(1, -1, 0),
    new THREE.Vector3(-1, -1, 0),
    new THREE.Vector3(1, 0, 1),
    new THREE.Vector3(-1, 0, 1),
    new THREE.Vector3(1, 0, -1),
    new THREE.Vector3(-1, 0, -1),
    new THREE.Vector3(0, 1, 1),
    new THREE.Vector3(0, -1, 1),
    new THREE.Vector3(0, 1, -1),
    new THREE.Vector3(0, -1, -1),
  ];

  const corners = [
    // z=0
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(1, 1, 0),
    // z=1
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(1, 0, 1),
    new THREE.Vector3(0, 1, 1),
    new THREE.Vector3(1, 1, 1),
  ];

  function wrap(i) {
    return ((i % size) + size) % size;
  }

  function getGradient(ix, iy, iz) {
    const h = hash(ix, iy, iz);
    return gradients[h % 12];
  }

  function hash(x, y, z) {
    let h = x * 374761393 + y * 668265263 + z * 2147483647;
    h = (h ^ (h >> 13)) * 1274126177;
    return h ^ (h >> 16);
  }

  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function sample(u, v, w) {
    const p = new THREE.Vector3(u, v, w);
    p.multiplyScalar(size);
    const i0 = Math.floor(p.x);
    const j0 = Math.floor(p.y);
    const k0 = Math.floor(p.z);
    const c0 = new THREE.Vector3(i0, j0, k0);
    const c = corners.map((e) => c0.clone().add(e));
    const d = c.map((corner) => p.clone().sub(corner));
    const g = c.map((corner) => {
      const wx = wrap(corner.x);
      const wy = wrap(corner.y);
      const wz = wrap(corner.z);
      return getGradient(wx, wy, wz);
    });
    const cont = d.map((dist, i) => g[i].dot(dist));
    // compute blending factors
    const bx = fade(d[0].x);
    const by = fade(d[0].y);
    const bz = fade(d[0].z);
    // perform trilinear interpolation
    const v000 = cont[0];
    const v100 = cont[1];
    const v010 = cont[2];
    const v110 = cont[3];
    const v001 = cont[4];
    const v101 = cont[5];
    const v011 = cont[6];
    const v111 = cont[7];

    const x00 = lerp(v000, v100, bx);
    const x10 = lerp(v010, v110, bx);
    const x01 = lerp(v001, v101, bx);
    const x11 = lerp(v011, v111, bx);

    const y0 = lerp(x00, x10, by);
    const y1 = lerp(x01, x11, by);

    const result = lerp(y0, y1, bz);

    return result;
  }

  return sample;
}

function createNoiseTexture3D(textureSize, noiseScale, noiseType = "3D Value") {
  const noiseSampler = samplerByName[noiseType](noiseScale);

  const pixelData = new Uint8Array(textureSize * textureSize * textureSize);
  for (let y = 0; y < textureSize; y++) {
    for (let x = 0; x < textureSize; x++) {
      for (let z = 0; z < textureSize; z++) {
        const u = x / textureSize;
        const v = y / textureSize;
        const w = z / textureSize;
        const sample = noiseSampler(u, v, w);
        const value = Math.round(((sample + 1) / 2) * 255);
        const offset = z * textureSize * textureSize + y * textureSize + x;
        pixelData[offset] = value;
      }
    }
  }

  const texture = new THREE.Data3DTexture(
    pixelData,
    textureSize,
    textureSize,
    textureSize,
  );
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.wrapR = THREE.RepeatWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export { createNoiseTexture3D };
