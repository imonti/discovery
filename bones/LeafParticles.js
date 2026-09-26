import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  abs,
  color,
  cos,
  faceDirection,
  float,
  frontFacing,
  hash,
  hue,
  instanceIndex,
  instancedBufferAttribute,
  mix,
  mod,
  modelWorldMatrix,
  normalize,
  positionGeometry,
  sin,
  texture,
  uint,
  uniform,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { pane } from "./config.js";
import { minimalToneMap } from "./LeavesMaterial.js";
import { sampleIBLIrradiance } from "./utils/sampleIBLIrradiance.js";

// Port of the "Geometry Nodes" modifier in GnarledTree/particles.blend.
// The node graph only runs once per frame in Blender; here the per-point
// setup (Subdivide Mesh + random selection) runs once on the CPU and every
// time-dependent node runs per instance in the vertex shader. All values are
// in the modifier's object space, which is Blender's Z-up basis.
const DEFAULTS = {
  // Input mesh: three orthogonal planes spanning +/- halfSize (Cube object).
  halfSize: 4.662,
  // Subdivide Mesh level 2 on 2x2 quads -> 8x8 quads per plane.
  subdivisions: 8,
  // Random Value > 0.95 selects roughly 5% of the subdivided vertices.
  selectionThreshold: 0.95,
  // Grid size (Value node) of the instanced leaf quad.
  leafSize: 0.5,
  // Spread Ratio: bounding-box diagonal multiplier for the random offset.
  spreadRatio: 0.23,
  // Scrambled Position scales the source point before adding the offset.
  positionScale: 0.8,
  gravityDirectionMin: new THREE.Vector3(0, 0, 0.8),
  gravityDirectionMax: new THREE.Vector3(0.5, 0.5, 1),
  gravitySpeedMin: 0.025,
  gravitySpeedMax: 0.075,
  spinSpeedMin: 0.025,
  spinSpeedMax: 0.1,
  scaleMin: 0.5,
  scaleMax: 1.5,
  hueMin: 0.45,
  hueMax: 0.5,
  frontColor: new THREE.Color(0.1009, 1, 0.0699),
  backColor: new THREE.Color(0.0597, 0.2632, 0.043),
  // Scene render settings from the .blend file.
  fps: 60,
  startFrame: 1,
};

// Each Random Value node gets its own stream so the per-leaf values are
// independent, mirroring the separate nodes in the graph.
const SEED = {
  selection: 0,
  spread: 1,
  gravityDirection: 4,
  gravitySpeed: 7,
  rotation: 8,
  spin: 11,
  scale: 12,
  hue: 13,
};

// Vector Curves node (clipped to [-1, 1]) sampled on the [0, 1] range it
// receives here. A per-channel quadratic reproduces Blender's AUTO-handle
// curve to within 0.006.
const CURVE_A = vec3(0.2816, 0.2901, 0.3141);
const CURVE_B = vec3(0.8816, 0.8741, 0.8593);
const CURVE_C = vec3(-0.1632, -0.1642, -0.1734);

class LeafParticles extends THREE.InstancedMesh {
  elapsed = 0;
  settings = { timeScale: 1 };

  constructor({ texture: leafTexture, environmentTexture, options = {} }) {
    const config = { ...DEFAULTS, ...options };
    const restPositions = createSourcePoints(config);
    const count = restPositions.length / 3;

    // Grid (2x2 vertices) followed by Transform Geometry rotating it 90
    // degrees around X, so the quad lies in the XZ plane facing -Y.
    const geometry = new THREE.PlaneGeometry(config.leafSize, config.leafSize);
    geometry.rotateX(Math.PI / 2);

    leafTexture.colorSpace = THREE.SRGBColorSpace;

    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    material.name = "LeafParticlesMaterial";
    material.lights = false;

    super(geometry, material, count);

    this.name = "LeafParticles";
    // Leaves are displaced on the GPU, so CPU bounds do not apply.
    this.frustumCulled = false;
    // The Blender object carries a 180 degree Y rotation, which turns the
    // node graph's +Z "gravity" into a downward fall in world space.
    this.rotation.set(0, Math.PI, 0);

    this.config = config;
    this.frameUniform = uniform(config.startFrame);
    this.toneMappingExposureUniform = uniform(0.5);
    this.toneMappingWhitePointUniform = uniform(2.5);

    this.buildNodes(
      new THREE.InstancedBufferAttribute(restPositions, 3),
      leafTexture,
      environmentTexture,
    );
    this.enableConfig();
  }

  buildNodes(restAttribute, leafTexture, environmentTexture) {
    const config = this.config;
    const material = this.material;
    const frame = this.frameUniform;

    const boundsMin = vec3(-config.halfSize);
    const boundsSize = vec3(config.halfSize * 2);

    const random = (seed) => hash(instanceIndex.add(uint(seed * 4096)));
    const randomVector = (seed) =>
      vec3(random(seed), random(seed + 1), random(seed + 2));

    // Point Generation: the subdivided vertex surviving the selection.
    const sourcePosition = instancedBufferAttribute(restAttribute);

    // Initial Random Spread + Initial Scrambled Position.
    const spread = boundsSize.length().mul(config.spreadRatio);
    const scrambledPosition = sourcePosition
      .mul(config.positionScale)
      .add(randomVector(SEED.spread).mul(spread));

    // Gravity Offset: each leaf drifts along its own direction at its own
    // speed, scaled by the current scene frame.
    const gravityDirection = normalize(
      mix(
        vec3(...config.gravityDirectionMin.toArray()),
        vec3(...config.gravityDirectionMax.toArray()),
        randomVector(SEED.gravityDirection),
      ),
    );
    const gravitySpeed = mix(
      config.gravitySpeedMin,
      config.gravitySpeedMax,
      random(SEED.gravitySpeed),
    );
    const fallingPosition = scrambledPosition.add(
      gravityDirection.mul(frame.mul(gravitySpeed)),
    );

    // Modulo Position wraps every leaf back inside the bounding box.
    const leafPosition = boundsMin.add(
      mod(fallingPosition.sub(boundsMin), boundsSize),
    );

    // "uvw" instance attribute: 1 at the box centre falling to 0 at its
    // faces, shaped by the Vector Curves node. Fades leaves before they wrap.
    const normalizedPosition = leafPosition.sub(boundsMin).div(boundsSize);
    const edgeFactor = float(1).sub(
      abs(normalizedPosition.sub(0.5).mul(2)),
    );
    const edgeFade = CURVE_A.add(
      edgeFactor.mul(CURVE_B.add(edgeFactor.mul(CURVE_C))),
    );

    // Rotate Instances (random Euler XYZ in [0, 2pi]), then Rotate
    // Instances.001 spinning around the local Z axis over time, then Scale
    // Instances. Local-space rotations compose as R_initial * R_spin.
    const initialRotation = randomVector(SEED.rotation).mul(Math.PI * 2);
    const spin = frame.mul(
      mix(config.spinSpeedMin, config.spinSpeedMax, random(SEED.spin)),
    );
    const scale = mix(config.scaleMin, config.scaleMax, random(SEED.scale));
    const orient = (vector) =>
      rotateEulerXYZ(rotateZ(vector, spin), initialRotation);

    material.positionNode = leafPosition.add(
      orient(positionGeometry.mul(scale)),
    );

    // Diffuse shading uses the leaf normal in world space; the modifier's
    // object transform is applied here because positionNode is local.
    const leafNormal = orient(vec3(0, -1, 0));
    const worldNormal = varying(
      normalize(modelWorldMatrix.mul(vec4(leafNormal, 0)).xyz),
    );
    const leafHue = varying(
      mix(config.hueMin, config.hueMax, random(SEED.hue)),
    );
    const fade = varying(edgeFade);

    const shadingNormal = worldNormal.mul(faceDirection);
    const baseColor = mix(
      color(config.backColor),
      color(config.frontColor),
      float(frontFacing),
    );
    // Blender's Hue input is centred on 0.5; the offset is a fraction of a
    // full turn around the colour wheel.
    const shiftedColor = hue(baseColor, leafHue.sub(0.5).mul(Math.PI * 2));
    const irradiance = sampleIBLIrradiance(environmentTexture, shadingNormal);
    const toneMappedColor = minimalToneMap(
      irradiance.mul(shiftedColor),
      this.toneMappingExposureUniform,
      this.toneMappingWhitePointUniform,
    );

    material.colorNode = vec4(toneMappedColor, 1);
    material.opacityNode = texture(leafTexture).a.mul(
      fade.x.mul(fade.y).mul(fade.z),
    );
  }

  enableConfig() {
    const folder = pane.addFolder({ title: "falling leaves" });
    folder.addBinding(this.settings, "timeScale", {
      label: "time scale",
      min: 0,
      max: 4,
      step: 0.01,
    });
    folder.addBinding(this.toneMappingExposureUniform, "value", {
      label: "tone exposure",
      min: 0,
      max: 5,
      step: 0.01,
    });
    folder.addBinding(this.toneMappingWhitePointUniform, "value", {
      label: "tone white point",
      min: 0.01,
      max: 10,
      step: 0.01,
    });
  }

  update(deltaTime = 0) {
    this.elapsed += deltaTime * this.settings.timeScale;
    // Scene Time.Frame: the graph is driven by frame number, not seconds.
    this.frameUniform.value =
      this.config.startFrame + this.elapsed * this.config.fps;
  }
}

export { LeafParticles };

const rotateX = (vector, angle) => {
  const c = cos(angle);
  const s = sin(angle);
  return vec3(
    vector.x,
    vector.y.mul(c).sub(vector.z.mul(s)),
    vector.y.mul(s).add(vector.z.mul(c)),
  );
};

const rotateY = (vector, angle) => {
  const c = cos(angle);
  const s = sin(angle);
  return vec3(
    vector.x.mul(c).add(vector.z.mul(s)),
    vector.y,
    vector.z.mul(c).sub(vector.x.mul(s)),
  );
};

const rotateZ = (vector, angle) => {
  const c = cos(angle);
  const s = sin(angle);
  return vec3(
    vector.x.mul(c).sub(vector.y.mul(s)),
    vector.x.mul(s).add(vector.y.mul(c)),
    vector.z,
  );
};

// Blender's XYZ Euler order applies X first, then Y, then Z.
const rotateEulerXYZ = Fn(([vector, euler]) =>
  rotateZ(rotateY(rotateX(vector, euler.x), euler.y), euler.z),
);

// Subdivided input mesh vertices that pass the Random Value > threshold
// selection. The Cube mesh is three orthogonal planes, so its subdivided
// vertices are the lattice points with at least one coordinate at the centre.
function createSourcePoints({ halfSize, subdivisions, selectionThreshold }) {
  const center = subdivisions / 2;
  const step = (halfSize * 2) / subdivisions;
  const points = [];
  let index = 0;

  for (let i = 0; i <= subdivisions; i += 1) {
    for (let j = 0; j <= subdivisions; j += 1) {
      for (let k = 0; k <= subdivisions; k += 1) {
        if (i !== center && j !== center && k !== center) continue;
        const selected =
          pcgHash(index + SEED.selection * 4096) > selectionThreshold;
        index += 1;
        if (!selected) continue;
        points.push(
          -halfSize + i * step,
          -halfSize + j * step,
          -halfSize + k * step,
        );
      }
    }
  }

  return new Float32Array(points);
}

// CPU copy of three/tsl `hash` (PCG) so selection matches the GPU streams.
function pcgHash(seed) {
  const state = (Math.imul(seed >>> 0, 747796405) + 2891336453) >>> 0;
  const word = Math.imul(
    ((state >>> ((state >>> 28) + 4)) ^ state) >>> 0,
    277803737,
  ) >>> 0;
  return (((word >>> 22) ^ word) >>> 0) / 2 ** 32;
}
