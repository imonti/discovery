import * as THREE from "three/webgpu";
import {
  abs,
  attribute,
  Break,
  cameraPosition,
  dot,
  float,
  Fn,
  fwidth,
  If,
  Loop,
  modelPosition,
  modelWorldMatrix,
  normalize,
  oneMinus,
  positionWorld,
  pow,
  select,
  smoothstep,
  sqrt,
  uniform,
  texture3D,
  vec3,
  vec4,
  vec2,
  length,
  deltaTime,
  time,
  fract,
  sub,
  max,
  not,
  Return,
  modelWorldMatrixInverse,
  Continue,
  min,
  EPSILON,
  sign,
  Discard,
  clamp,
  hash,
  uv,
  screenUV,
  screenCoordinate,
} from "three/tsl";

import { createNoiseTexture3D } from "../noise/noise3D";
import { pane, threshold } from "./config";
import { bayer16 } from 'three/addons/tsl/math/Bayer.js';

function createRaymarchCube(w, h, d, camera) {
  const delta = w * 0.5;
  const radius = float(delta);
  // epsilon
  const e = float(delta * 0.02);
  // max distance
  const MAX_D = float(delta * 2);
  const ex = vec3(e, 0.0, 0.0);
  const ey = vec3(0.0, e, 0.0);
  const ez = vec3(0.0, 0.0, e);
  const geometry = new THREE.BoxGeometry(w, h, d, 1, 1, 1);
  geometry.computeBoundingBox();

  const mn = geometry.boundingBox.min;
  const mx = geometry.boundingBox.max;
  const box_max = vec3(mx.x, mx.y, mx.z);
  const box_min = vec3(mn.x, mn.y, mn.z);
  const sz = geometry.boundingBox.getSize(new THREE.Vector3());
  const box_size = vec3(sz.x, sz.y, sz.z);
  const cx = sz.x * 0.5;
  const cy = sz.y * 0.5;
  const cz = sz.z * 0.5;
  const center = vec3(mn.x, mn.y, mn.z);

  // march step
  const ms = 0.01;
  const march_step = float(sz.length() * ms);
  const h_march_step = float(march_step.mul(0.5))
  const max_iterations = Math.ceil(sz.length() / ms);

  const white = vec3(1.0, 1.0, 1.0);
  const black = vec3(0.0, 0.0, 0.0);

  const material = new THREE.MeshBasicNodeMaterial();
  material.transparent = true;
  // build noise 3d
  const tSize = 32;
  const tPeriod = 4;
  const noiseTexture = createNoiseTexture3D(tSize, tPeriod, "3D Perlin");
  const nTexture = texture3D(noiseTexture);
  const th0 = uniform(threshold.min);
  const th1 = uniform(threshold.max);

  function updateThresholdUniforms() {
    th0.value = threshold.min;
    th1.value = threshold.max;
  }

  pane.on("change", updateThresholdUniforms);
  updateThresholdUniforms();

  const sdf = Fn(([p]) => {
    const p0 = float(modelPosition);
    return length(p.sub(p0)).sub(radius);
  });

  const easeOut = Fn(([x]) => {
    return float(1).sub(pow(float(1).sub(x), 2));
  });

  const gradientAt = Fn(([p]) => {
    // distance from the point to the center
    const gradient = length(p.sub(modelPosition));
    // normalize [0-1]
    gradient.divAssign(radius);
    // ease
    gradient.assign(easeOut(gradient));
    // invert
    gradient.assign(oneMinus(gradient));

    return gradient;
  });

  const computeDensityNormal = Fn(([uvw, p]) => {
    const u = float(1.0).div(float(tSize));

    const vx = vec3(u, 0, 0);
    const dx0 = sample_d(uvw.add(vx), p);
    const dx1 = sample_d(uvw.sub(vx), p);
    const dx = sub(dx0, dx1);

    const vy = vec3(0, u, 0);
    const dy0 = sample_d(uvw.add(vy), p);
    const dy1 = sample_d(uvw.sub(vy), p);
    const dy = sub(dy0, dy1);

    const vz = vec3(0, 0, u);
    const dz0 = sample_d(uvw.add(vz), p);
    const dz1 = sample_d(uvw.sub(vz), p);
    const dz = sub(dz0, dz1);

    return normalize(vec3(dx, dy, dz));
  });

  const computeSlabIntersection = Fn(([ro, rd, mn, mx]) => {
    const dir = vec3(rd.x, rd.y, rd.z);
    dir.x.addAssign(sign(dir.x).mul(EPSILON));
    dir.y.addAssign(sign(dir.y).mul(EPSILON));
    dir.z.addAssign(sign(dir.z).mul(EPSILON));

    const tx0 = float(mn.x).sub(ro.x).div(dir.x);
    const tx1 = float(mx.x).sub(ro.x).div(dir.x);
    const ty0 = float(mn.y).sub(ro.y).div(dir.y);
    const ty1 = float(mx.y).sub(ro.y).div(dir.y);
    const tz0 = float(mn.z).sub(ro.z).div(dir.z);
    const tz1 = float(mx.z).sub(ro.z).div(dir.z);

    const xMin = min(tx0, tx1);
    const xMax = max(tx0, tx1);
    const yMin = min(ty0, ty1);
    const yMax = max(ty0, ty1);
    const zMin = min(tz0, tz1);
    const zMax = max(tz0, tz1);

    const tEnter = max(xMin, yMin, zMin);
    const tExit = min(xMax, yMax, zMax);

    return vec2(tEnter, tExit);
  });

  material.colorNode = Fn(() => {

    const ro = modelWorldMatrixInverse.mul(cameraPosition);
    const pEnter = modelWorldMatrixInverse.mul(positionWorld);
    const rd = normalize(pEnter.sub(ro));
    const density = float(0.0);
    const hit = computeSlabIntersection(ro, rd, mn, mx);
    const tEnter = hit.x;
    const tExit = hit.y;
    const col = vec3(0.0)

    If(tEnter.greaterThan(tExit).or(tExit.lessThan(0.0)), () => {
      Discard();
    });

    const t = max(tEnter, 0).toVar();
    const jitter = bayer16(screenCoordinate).mul(march_step)
    t.addAssign(jitter)

    Loop(max_iterations, () => {
      const p = ro.add(rd.mul(t));
      const uvw = clamp(p.sub(box_min).div(box_size), 0.0, 1.0);
      col.addAssign(uvw);
      uvw.x.addAssign(time.mul(0.1));
      const sd = nTexture.sample(uvw).r;
      sd.assign(smoothstep(th0, th1, sd).mul(0.1));
      density.addAssign(oneMinus(density).mul(sd));
      // perform ray marching
      t.addAssign(march_step);

      If(t.greaterThan(tExit), () => {
        Break();
      });
    });

    col.divAssign(abs(tExit.sub(tEnter)).div(march_step))

    return vec4(vec3(col), density);
  })();

  const mesh = new THREE.Mesh(geometry, material);
  return mesh;
}

export { createRaymarchCube };
