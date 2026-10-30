import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import {
  attribute,
  cross,
  float,
  Fn,
  positionGeometry,
  step,
  texture as textureNode,
  time,
  uniform,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import { configFolder } from "./config.js";
import { mulberry32 } from "../utils/Mulberry32.js";
import { sampleIBLIrradiance } from "./utils/sampleIBLIrradiance.js";
import { minimalToneMap } from "./utils/minimalToneMap.js";

const opacityCurve = Fn(([f]) => f.oneMinus().pow(3).oneMinus());

/**
 * A collection of leaf planes distributed through a subdivided bounding box.
 *
 * The planes retain their object-space orientation. They are intentionally
 * not billboards, so their orientation can be changed by the owning scene.
 */
class LeafParticles extends THREE.Group {
  constructor({
    size = { width: 1, height: 2, length: 1 },
    subdivisions = 3,
    spreadRatio = 1,
    environmentTexture,
    seed = 0x1eaf,
    texture = null,
  } = {}) {
    super();

    this.settings = {
      minSize: 0.04,
      maxSize: 0.06,
      opacityThreshold: 0.8,
      toneMappingExposure: 0.5,
      toneMappingWhitePoint: 2.5,
      minVelocity: 0.2,
      maxVelocity: 0.4,
      directionMin: { x: 0, y: -0.1, z: -1 },
      directionMax: { x: 0.2, y: -1.0, z: -0.8 },
      color: "#92AD2A",
      showBoundingBox: false,
    };

    const count = subdivisions ** 3;
    const geometry = new THREE.InstancedBufferGeometry().copy(
      new THREE.PlaneGeometry(1, 1),
    );
    geometry.instanceCount = count;
    this.scaleAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(count),
      1,
    ).setUsage(THREE.DynamicDrawUsage);
    this.positionAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3,
    );
    this.directionAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 3),
      3,
    );
    this.velocityFactorAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(count),
      1,
    ).setUsage(THREE.DynamicDrawUsage);
    // Unit quaternions stored as (x, y, z, w).
    this.rotationAttribute = new THREE.InstancedBufferAttribute(
      new Float32Array(count * 4),
      4,
    );
    geometry.setAttribute("particleScale", this.scaleAttribute);
    geometry.setAttribute("particlePosition", this.positionAttribute);
    geometry.setAttribute("direction", this.directionAttribute);
    geometry.setAttribute("velocityFactor", this.velocityFactorAttribute);
    geometry.setAttribute("particleRotation", this.rotationAttribute);
    const distanceToEdge = varying(float());
    const material = new MeshBasicNodeMaterial({
      alphaTest: 0.5,
      alphaHash: true,
      side: THREE.DoubleSide,
    });
    this.opacityThresholdUniform = uniform(this.settings.opacityThreshold);
    this.toneMappingExposureUniform = uniform(this.settings.toneMappingExposure);
    this.toneMappingWhitePointUniform = uniform(this.settings.toneMappingWhitePoint);
    material.positionNode = Fn(() => {
      const scale = attribute("particleScale", "float");
      const position = attribute("particlePosition", "vec3");
      const direction = attribute("direction", "vec3")
        .mul(attribute("velocityFactor", "float"))
        .mul(time);
      const currentPosition = position.add(direction);
      const bounds = vec3(size.width, size.height, size.length);
      const wrappedPosition = currentPosition.mod(bounds);
      // Normalize the wrapped instance position into bbox UVW coordinates:
      // (0, 0, 0) is the local minimum and (1, 1, 1) is the local maximum.
      const normalizedPosition = wrappedPosition.div(bounds).toVar();
      // Convert normalized coordinates into center distance: edges are 0 and
      // the bbox center is 1 on each axis.
      const uvw = normalizedPosition
        .min(vec3(1).sub(normalizedPosition))
        .mul(2)
        .toVar();
      distanceToEdge.assign(uvw.x.min(uvw.y).min(uvw.z));
      const initialRotation = attribute("particleRotation", "vec4");
      // q^(1 + elapsed seconds): preserve the initial axis and advance its angle.
      const axis = initialRotation.xyz.div(
        initialRotation.xyz.length().max(1e-8),
      );
      const halfAngle = initialRotation.w
        .clamp(-1, 1)
        .acos()
        .mul(time.add(1))
        .toVar();
      const rotation = vec4(axis.mul(halfAngle.sin()), halfAngle.cos()).toVar();
      const scaled = positionGeometry.mul(scale).toVar();
      const t = cross(rotation.xyz, scaled).mul(2).toVar();
      const rotated = scaled.add(t.mul(rotation.w)).add(cross(rotation.xyz, t));
      return rotated.add(wrappedPosition);
    })();
    this.particleColorUniform = uniform(new THREE.Color(this.settings.color));

    const sample = textureNode(texture);
    // Particle planes use their local +Z normal for environment irradiance.
    const irradiance = sampleIBLIrradiance(
      environmentTexture,
      vec3(0, 0, 1),
    );
    const toneMappedColor = minimalToneMap(
      this.particleColorUniform.mul(irradiance),
      this.toneMappingExposureUniform,
      this.toneMappingWhitePointUniform,
    );
    material.colorNode = vec4(
      toneMappedColor,
      sample.a.mul(
        opacityCurve(distanceToEdge).max(
          step(this.opacityThresholdUniform, opacityCurve(distanceToEdge)),
        ),
      ),
    );

    const mesh = new THREE.Mesh(geometry, material);
    // Instance transforms live in shader attributes, outside CPU geometry bounds.
    mesh.frustumCulled = false;
    this.random = mulberry32(seed);
    const random = () => this.random();
    const cellSize = {
      x: size.width / subdivisions,
      y: size.height / subdivisions,
      z: size.length / subdivisions,
    };

    let instance = 0;
    for (let x = 0; x < subdivisions; x += 1) {
      for (let y = 0; y < subdivisions; y += 1) {
        for (let z = 0; z < subdivisions; z += 1) {
          const ox = x * cellSize.x + random() * spreadRatio;
          const oy = y * cellSize.y + random() * spreadRatio;
          const oz = z * cellSize.z + random() * spreadRatio;

          this.positionAttribute.setXYZ(instance, ox, oy, oz);
          instance += 1;
        }
      }
    }

    // Sample unit quaternions uniformly, after placement to preserve its sequence.
    for (let i = 0; i < count; i += 1) {
      const u = random();
      const angle1 = 2 * Math.PI * random();
      const angle2 = 2 * Math.PI * random();
      const radius1 = Math.sqrt(1 - u);
      const radius2 = Math.sqrt(u);
      this.rotationAttribute.setXYZW(
        i,
        radius1 * Math.sin(angle1),
        radius1 * Math.cos(angle1),
        radius2 * Math.sin(angle2),
        radius2 * Math.cos(angle2),
      );
    }

    // Sample after positions and rotations to preserve their seeded sequences.
    this.#repopulateDirections();
    this.#regenerateVelocityFactors();
    this.#regenerateScales();

    mesh.name = "LeafParticleInstances";
    this.name = "LeafParticles";
    this.mesh = mesh;
    this.add(mesh);

    this.boundingBox = new THREE.Box3(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(size.width, size.height, size.length),
    );
    this.boundingBoxHelper = new THREE.Box3Helper(this.boundingBox, 0x38bdf8);
    this.boundingBoxHelper.name = "LeafParticleBoundingBox";
    this.boundingBoxHelper.visible = this.settings.showBoundingBox;
    this.add(this.boundingBoxHelper);

    const particlesFolder = configFolder.addFolder({ title: "particles", expanded: false });
    particlesFolder
      .addBinding(this.settings, "showBoundingBox", {
        label: "bounding box",
      })
      .on("change", () => {
        this.boundingBoxHelper.visible = this.settings.showBoundingBox;
      });
    const sizeFolder = particlesFolder.addFolder({ title: "size", expanded: false });
    const minSizeBinding = sizeFolder.addBinding(this.settings, "minSize", {
      label: "min",
      min: 0,
      max: 5,
      step: 0.01,
    });
    const maxSizeBinding = sizeFolder.addBinding(this.settings, "maxSize", {
      label: "max",
      min: 0,
      max: 5,
      step: 0.01,
    });
    const colorBinding = particlesFolder.addBinding(this.settings, "color", {
      label: "color",
      view: "color",
    });
    const opacityThresholdBinding = particlesFolder.addBinding(
      this.settings,
      "opacityThreshold",
      { label: "opacity threshold", min: 0, max: 1, step: 0.02 },
    );
    const toneExposureBinding = particlesFolder.addBinding(this.settings, "toneMappingExposure", {
      label: "tone exposure",
      min: 0,
      max: 5,
      step: 0.01,
    });
    const toneWhitePointBinding = particlesFolder.addBinding(this.settings, "toneMappingWhitePoint", {
      label: "tone white point",
      min: 0.01,
      max: 10,
      step: 0.01,
    });
    const minVelocityBinding = particlesFolder.addBinding(
      this.settings,
      "minVelocity",
      { label: "min vel", min: 0, max: 1, step: 0.02 },
    );
    const maxVelocityBinding = particlesFolder.addBinding(
      this.settings,
      "maxVelocity",
      { label: "max vel", min: 0, max: 1, step: 0.02 },
    );
    const directionBindings = [
      ["directionMin", "lower direction"],
      ["directionMax", "upper direction"],
    ].flatMap(([key, title]) => {
      const folder = particlesFolder.addFolder({ title, expanded: false });
      return ["x", "y", "z"].map((axis) =>
        folder.addBinding(this.settings[key], axis, {
          label: axis,
          min: -1,
          max: 1,
          step: 0.02,
        }),
      );
    });

    minSizeBinding.on("change", () => this.#regenerateScales());
    maxSizeBinding.on("change", () => this.#regenerateScales());
    colorBinding.on("change", () => {
      this.particleColorUniform.value.set(this.settings.color);
    });
    opacityThresholdBinding.on("change", () => {
      this.opacityThresholdUniform.value = this.settings.opacityThreshold;
    });
    toneExposureBinding.on("change", () => {
      this.toneMappingExposureUniform.value = this.settings.toneMappingExposure;
    });
    toneWhitePointBinding.on("change", () => {
      this.toneMappingWhitePointUniform.value = this.settings.toneMappingWhitePoint;
    });
    minVelocityBinding.on("change", () => this.#regenerateVelocityFactors());
    maxVelocityBinding.on("change", () => this.#regenerateVelocityFactors());
    directionBindings.forEach((binding) =>
      binding.on("change", () => this.#repopulateDirections()),
    );
  }

  getDirection() {
    const { directionMin, directionMax } = this.settings;
    return new THREE.Vector3(
      directionMin.x + this.random() * (directionMax.x - directionMin.x),
      directionMin.y + this.random() * (directionMax.y - directionMin.y),
      directionMin.z + this.random() * (directionMax.z - directionMin.z),
    ).normalize();
  }

  #repopulateDirections() {
    for (let i = 0; i < this.directionAttribute.count; i += 1) {
      const direction = this.getDirection();
      this.directionAttribute.setXYZ(i, direction.x, direction.y, direction.z);
    }
    this.directionAttribute.needsUpdate = true;
  }

  #regenerateVelocityFactors() {
    const minimum = this.settings.minVelocity;
    const range = this.settings.maxVelocity - minimum;
    for (let i = 0; i < this.velocityFactorAttribute.count; i += 1) {
      this.velocityFactorAttribute.setX(i, minimum + this.random() * range);
    }
    this.velocityFactorAttribute.needsUpdate = true;
  }

  #regenerateScales() {
    const minimum = this.settings.minSize;
    const range = this.settings.maxSize - minimum;
    for (let i = 0; i < this.scaleAttribute.count; i += 1) {
      this.scaleAttribute.setX(i, minimum + this.random() * range);
    }
    this.scaleAttribute.needsUpdate = true;
  }

  update() {}
}

export { LeafParticles };
