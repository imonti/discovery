import { createNoise2D, createNoise4D } from "simplex-noise";
import * as THREE from "three";

function tilable1DSample(u) {
  const noise2D = createNoise2D();
  const theta = 2 * Math.PI * u;
  return noise2D(Math.cos(theta), Math.sin(theta));
}

function tilable2DSample(u, v) {
  const noise4D = createNoise4D();
  const theta = 2 * Math.PI * u;
  const phi = 2 * Math.PI * v;
  return noise4D(
    Math.cos(theta),
    Math.sin(theta),
    Math.cos(phi),
    Math.sin(phi),
  );
}

const samplerByName = {
  //   "1D Simplex": tilable1DSample,
  //   "2D Simplex": tilable2DSample,
  "2D Perlin": createPerlinSampler,
  "2D Simplex": createSimplexSampler,
};

function createNoiseTexture2D(textureSize, latticeSize, method) {
  const pixelData = new Uint8Array(textureSize * textureSize);

  const sampler = samplerByName[method](latticeSize);

  let min_v = Infinity;
  let max_v = -Infinity;

  for (let y = 0; y < textureSize; y++) {
    for (let x = 0; x < textureSize; x++) {
      const u = x / textureSize;
      const v = y / textureSize;
      const sample = sampler(u, v);
      // const value = Math.round(((sample + 1) / 2) * 255);
      const value = Math.round(((sample + 2) / 4) * 255);
      // if (sample > max_v) {
      //   max_v = sample;
      // }
      // if (sample < min_v) {
      //   min_v = sample;
      // }

      // const value = sample * 255;
      const offset = y * textureSize + x;
      pixelData[offset] = value;
    }
  }

  // console.log(min_v, max_v);

  const texture = new THREE.DataTexture(
    pixelData,
    textureSize,
    textureSize,
    THREE.RedFormat,
    THREE.UnsignedByteType,
  );
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.needsUpdate = true;

  return texture;
}

function createPerlinLattice(size) {
  const lattice = new Float32Array(size * size * 2);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const angle = Math.random() * 2 * Math.PI;
      const gx = Math.cos(angle);
      const gy = Math.sin(angle);
      const index = (y * size + x) * 2;
      lattice[index] = gx;
      lattice[index + 1] = gy;
    }
  }
  return lattice;
}

function createPerlinSampler(size) {
  const lattice = createPerlinLattice(size);
  /** create helper methods */
  function readLatticeValue(x, y, output) {
    x = ((x % size) + size) % size;
    y = ((y % size) + size) % size;
    const index = (y * size + x) * 2;
    const gnx = lattice[index];
    const gny = lattice[index + 1];
    output.set(gnx, gny);
  }
  // linear interpolation
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }
  // Perlin's fade curve
  function fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  const g00 = new THREE.Vector2();
  const g10 = new THREE.Vector2();
  const g01 = new THREE.Vector2();
  const g11 = new THREE.Vector2();

  const d00 = new THREE.Vector2();
  const d10 = new THREE.Vector2();
  const d01 = new THREE.Vector2();
  const d11 = new THREE.Vector2();

  const sampler = (u, v) => {
    const x = u * size;
    const y = v * size;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const x1 = x0 + 1;
    const y1 = y0 + 1;

    readLatticeValue(x0, y0, g00);
    readLatticeValue(x1, y0, g10);
    readLatticeValue(x0, y1, g01);
    readLatticeValue(x1, y1, g11);

    d00.set(x - x0, y - y0);
    d10.set(x - x1, y - y0);
    d01.set(x - x0, y - y1);
    d11.set(x - x1, y - y1);

    const v00 = g00.dot(d00);
    const v10 = g10.dot(d10);
    const v01 = g01.dot(d01);
    const v11 = g11.dot(d11);

    const tx = (x - x0) / (x1 - x0);
    const ty = (y - y0) / (y1 - y0);

    const sx = fade(tx);
    const sy = fade(ty);

    const ix0 = lerp(v00, v10, sx);
    const ix1 = lerp(v01, v11, sx);
    const value = lerp(ix0, ix1, sy);

    return value;
  };

  return sampler;
}

function createSimplexLattice(size) {
  const lattice = new Float32Array(size * size * 2);
  function setValue(i, j, x, y) {
    const index = (j * size + i) * 2;
    lattice[index] = x;
    lattice[index + 1] = y;
  }

  function getValue(i, j) {
    const index = (j * size + i) * 2;
    return [lattice[index], lattice[index + 1]];
  }

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const angle = Math.random() * Math.PI * 2;
      const index = (j * size + i) * 2;
      lattice[index] = Math.cos(angle);
      lattice[index + 1] = Math.sin(angle);
    }
  }

  return lattice;
}

function createSimplexSampler(size) {
  const lattice = createSimplexLattice(size);

  function con(g, d) {
    const t = 0.5 - d.dot(d);
    if (t <= 0) {
      return 0;
    }
    return t * t * t * t * g.dot(d) * 70;
  }

  function readLatticeValue(i, j, output) {
    const iw = ((i % size) + size) % size;
    const jw = ((j % size) + size) % size;
    const index = (jw * size + iw) * 2;
    output.set(lattice[index], lattice[index + 1]);
    return output;
  }

  function sample(u, v) {
    const p = new THREE.Vector2();
    p.set(u * size, v * size);

    const i = Math.floor(p.x);
    const j = Math.floor(p.y);

    const dx = p.x - i;
    const dy = p.y - j;
    const lower = dx + dy < 1;

    let c0, c1, c2;

    if (lower) {
      c0 = new THREE.Vector2(i, j);
      c1 = new THREE.Vector2(i + 1, j);
      c2 = new THREE.Vector2(i, j + 1);
    } else {
      c0 = new THREE.Vector2(i + 1, j);
      c1 = new THREE.Vector2(i, j + 1);
      c2 = new THREE.Vector2(i + 1, j + 1);
    }

    const g0 = readLatticeValue(c0.x, c0.y, new THREE.Vector2());
    const g1 = readLatticeValue(c1.x, c1.y, new THREE.Vector2());
    const g2 = readLatticeValue(c2.x, c2.y, new THREE.Vector2());

    const d0 = p.clone().sub(c0);
    const d1 = p.clone().sub(c1);
    const d2 = p.clone().sub(c2);

    return con(g0, d0) + con(g1, d1) + con(g2, d2);
  }

  return sample;
}

export { createNoiseTexture2D, createPerlinSampler };
