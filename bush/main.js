import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EXRLoader } from 'three/addons/loaders/EXRLoader.js'
import { MeshStandardNodeMaterial, WebGPURenderer } from 'three/webgpu'
import {
  abs,
  cameraFar,
  cameraNear,
  cameraViewMatrix,
  clamp,
  instancedBufferAttribute,
  materialColor,
  mix,
  normalize,
  output,
  positionView,
  select,
  texture,
  transformNormalByViewMatrix,
  uniform,
  uv,
  vec3,
  vec4,
  viewZToPerspectiveDepth,
} from 'three/tsl'
import pointGrid from '../tsl/pointGrid.js'
import { createConfig } from './config.js'
import { instancedBillboarding } from './instancedBillboarding.js'
import depthMapUrl from './assets/leaves_cluster_depth.png?url'
import environmentMapUrl from './assets/autumn_field_puresky_1k.exr?url'
import normalMapUrl from './assets/leaves_cluster_normal.png?url'
import opacityMapUrl from './assets/leaves_cluster_opacity.png?url'

const loadingManager = new THREE.LoadingManager()
const textureLoader = new THREE.TextureLoader(loadingManager)
const exrLoader = new EXRLoader(loadingManager)
exrLoader.setDataType(THREE.FloatType)

function loadTexture(url) {
  return new Promise((resolve, reject) => {
    textureLoader.load(url, resolve, undefined, reject)
  })
}

function loadEnvironment(url) {
  return new Promise((resolve, reject) => {
    exrLoader.load(url, resolve, undefined, reject)
  })
}

async function loadAssets() {
  const [normalMap, opacityMap, depthMap, environmentMap] = await Promise.all([
    loadTexture(normalMapUrl),
    loadTexture(opacityMapUrl),
    loadTexture(depthMapUrl),
    loadEnvironment(environmentMapUrl),
  ])

  normalMap.colorSpace = THREE.NoColorSpace
  opacityMap.colorSpace = THREE.NoColorSpace
  depthMap.colorSpace = THREE.NoColorSpace
  environmentMap.mapping = THREE.EquirectangularReflectionMapping

  return { normalMap, opacityMap, depthMap, environmentMap }
}

async function init() {
  const { normalMap, opacityMap, depthMap, environmentMap } = await loadAssets()

  // These maps are loaded now and will be used by later shading passes.
  void depthMap

const scene = new THREE.Scene()
scene.background = environmentMap
scene.environment = environmentMap

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  100,
)
camera.position.set(2.8, 2.4, 4.2)

const renderer = new WebGPURenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.0
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.target.set(0, 0, 0)
controls.enableDamping = true
controls.minDistance = 2.2
controls.maxDistance = 10
controls.update()

const icosphereGeometry = new THREE.IcosahedronGeometry(1, 2)
icosphereGeometry.computeBoundingBox()
const points = pointGrid(icosphereGeometry, 5)
const geometryCenter = new THREE.Vector3()
icosphereGeometry.boundingBox.getCenter(geometryCenter)
const geometryCenterUniform = uniform(geometryCenter)
const normalVariation = uniform(0.5)
const depthDistance = uniform(0.02)
const leafLightContrast = uniform(0.75)
createConfig(normalVariation, leafLightContrast)

const planeGeometry = new THREE.PlaneGeometry(1.0, 1.0)
const planeMaterial = new MeshStandardNodeMaterial({
  color: "#74B06C",
  alphaMap: opacityMap,
  alphaTest: 0.65,
  alphaHash: true,
  transparent: false,
  side: THREE.DoubleSide,
  roughness: 1,
  envMapIntensity: 1.0,
})

// Reduce contrast after environment lighting: bright fragments are pulled
// down and dark fragments are lifted toward the original material color.
planeMaterial.outputNode = vec4(
  mix(materialColor.rgb, output.rgb, leafLightContrast),
  output.a,
)

const planes = new THREE.InstancedMesh(planeGeometry, planeMaterial, points.length)
const instanceMatrix = new THREE.Matrix4()
const instanceQuaternion = new THREE.Quaternion()
const instanceScale = new THREE.Vector3()
const instancePosition = new THREE.Vector3()
const instanceCenterAttribute = new THREE.InstancedBufferAttribute(
  new Float32Array(points.length * 3),
  3,
)
const instanceScaleAttribute = new THREE.InstancedBufferAttribute(
  new Float32Array(points.length),
  1,
)
const instanceRotationAttribute = new THREE.InstancedBufferAttribute(
  new Float32Array(points.length),
  1,
)
const scaleSeeds = points.map(() => Math.random())
const offsetSeeds = points.map(() => new THREE.Vector3(
  Math.random(),
  Math.random(),
  Math.random(),
))

const scaleMin = 1.5
const scaleMax = 2
const range = 0.2
const offsetMin = new THREE.Vector3(-range, -range, -range)
const offsetMax = new THREE.Vector3(range, range, range)

for (let i = 0; i < points.length; i++) {
  instancePosition.copy(points[i])
  instancePosition.x += THREE.MathUtils.lerp(offsetMin.x, offsetMax.x, offsetSeeds[i].x)
  instancePosition.y += THREE.MathUtils.lerp(offsetMin.y, offsetMax.y, offsetSeeds[i].y)
  instancePosition.z += THREE.MathUtils.lerp(offsetMin.z, offsetMax.z, offsetSeeds[i].z)

  instanceScale.setScalar(THREE.MathUtils.lerp(scaleMin, scaleMax, scaleSeeds[i]))
  instanceCenterAttribute.setXYZ(
    i,
    instancePosition.x,
    instancePosition.y,
    instancePosition.z,
  )
  instanceScaleAttribute.setX(i, instanceScale.x)
  instanceRotationAttribute.setX(i, Math.random() * Math.PI * 2)
  instanceMatrix.compose(
    instancePosition,
    instanceQuaternion,
    new THREE.Vector3(1, 1, 1),
  )
  planes.setMatrixAt(i, instanceMatrix)
}

planes.instanceMatrix.needsUpdate = true
instanceCenterAttribute.needsUpdate = true
instanceScaleAttribute.needsUpdate = true
instanceRotationAttribute.needsUpdate = true
planes.computeBoundingBox()
planes.computeBoundingSphere()

const instanceCenter = instancedBufferAttribute(instanceCenterAttribute)
const instanceScaleNode = instancedBufferAttribute(instanceScaleAttribute, 'float')
const instanceRotationNode = instancedBufferAttribute(instanceRotationAttribute, 'float')
planeMaterial.vertexNode = instancedBillboarding(
  instanceCenter,
  instanceScaleNode,
  instanceRotationNode,
)

const instanceNormal = normalize(instanceCenter.sub(geometryCenterUniform))
const worldUp = vec3(0, 1, 0)
const fallbackAxis = vec3(1, 0, 0)
const referenceAxis = select(
  abs(instanceNormal.dot(worldUp)).greaterThan(0.999),
  fallbackAxis,
  worldUp,
)
const tangent = normalize(referenceAxis.cross(instanceNormal))
const bitangent = normalize(instanceNormal.cross(tangent))
const encodedNoiseNormal = normalize(texture(normalMap, uv()).xyz)
const tangentSpaceNormalNode = normalize(
  tangent.mul(encodedNoiseNormal.x)
    .add(bitangent.mul(encodedNoiseNormal.y))
    .add(instanceNormal.mul(encodedNoiseNormal.z)),
)
const finalNormal = normalize(mix(instanceNormal, tangentSpaceNormalNode, normalVariation))
planeMaterial.normalNode = transformNormalByViewMatrix(finalNormal, cameraViewMatrix)

const signedDepthOffset = texture(depthMap, uv()).r.mul(2).sub(1)
const adjustedViewZ = positionView.z.sub(signedDepthOffset.mul(depthDistance))
planeMaterial.depthNode = clamp(
  viewZToPerspectiveDepth(adjustedViewZ, cameraNear, cameraFar),
  0,
  1,
)

scene.add(planes)

function resize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

window.addEventListener('resize', resize)

function animate() {
  requestAnimationFrame(animate)
  controls.update()
  renderer.render(scene, camera)
}

await renderer.init()
resize()
animate()

}

await init()
