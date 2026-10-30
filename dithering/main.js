import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { HorizontalBlurShader } from 'three/addons/shaders/HorizontalBlurShader.js'
import { VerticalBlurShader } from 'three/addons/shaders/VerticalBlurShader.js'
import { createProjectPane } from '../utils/createProjectPane.js'
import smokeTextureUrl from './assets/smoke.png?url'
import whiteTextureUrl64 from './assets/noiseTexture/white64.png?url'
import whiteTextureUrl128 from './assets/noiseTexture/white128.png?url'
import whiteTextureUrl256 from './assets/noiseTexture/white256.png?url'
import blueTextureUrl64 from './assets/noiseTexture/blue64.png?url'
import blueTextureUrl128 from './assets/noiseTexture/blue128.png?url'
import blueTextureUrl256 from './assets/noiseTexture/blue256.png?url'
import vertexShader from './shaders/noise/vertex.glsl?raw'
import fragmentShader from './shaders/noise/frag.glsl?raw'

const scene = new THREE.Scene()

const camera = new THREE.PerspectiveCamera(
  45,
  window.innerWidth / window.innerHeight,
  0.1,
  10,
)
camera.position.z = 2

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
renderer.setClearColor(0x000000, 0)
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
document.body.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(0, 0, 0)
controls.update()

const { configFolder } = createProjectPane('Dithering', {
  description: 'Compare dithering patterns, opacity thresholds, and blur.',
})
const ditherDirective = [
  "",
  "BAYER_4",
  "BAYER_8",
  "WHITE_NOISE_64",
  "WHITE_NOISE_128",
  "WHITE_NOISE_256",
  "BLUE_NOISE_64",
  "BLUE_NOISE_128",
  "BLUE_NOISE_256"
]
const ditheringTextures = {
  WHITE_NOISE_64: whiteTextureUrl64,
  WHITE_NOISE_128: whiteTextureUrl128,
  WHITE_NOISE_256: whiteTextureUrl256,
  BLUE_NOISE_64: blueTextureUrl64,
  BLUE_NOISE_128: blueTextureUrl128,
  BLUE_NOISE_256: blueTextureUrl256,
}
const ditherOptions = Object.fromEntries(ditherDirective.map(v => [v, v]));

const ditherState = {
  dither: ditherOptions.BLUE_NOISE_64,
}

const ditherBinding = configFolder.addBinding(ditherState, 'dither', {
  options: ditherOptions,
})

const thresholdFolder = configFolder.addFolder({
  title: 'threshold',
})

const thresholdState = {
  lower: 0,
  upper: 0.3,
  clipThreshold: 0.01,
}

const blurState = {
  blurRes: 1.0,
}

const lowerBinding = thresholdFolder.addBinding(thresholdState, 'lower', {
  min: 0.01,
  max: 1,
  step: 0.01,
})

const upperBinding = thresholdFolder.addBinding(thresholdState, 'upper', {
  min: 0.01,
  max: 1,
  step: 0.01,
})

const clipThresholdBinding = thresholdFolder.addBinding(thresholdState, 'clipThreshold', {
  min: 0.01,
  max: 1,
  step: 0.01,
})

const blurBinding = configFolder.addBinding(blurState, 'blurRes', {
  min: 0.01,
  max: 10,
  step: 0.01,
})

const textureLoader = new THREE.TextureLoader()
const smokeTexture = textureLoader.load(smokeTextureUrl)
smokeTexture.colorSpace = THREE.SRGBColorSpace
const whiteTexture64 = textureLoader.load(whiteTextureUrl64)
whiteTexture64.colorSpace = THREE.SRGBColorSpace
const whiteTexture128 = textureLoader.load(whiteTextureUrl128)
whiteTexture128.colorSpace = THREE.SRGBColorSpace
const whiteTexture256 = textureLoader.load(whiteTextureUrl256)
whiteTexture256.colorSpace = THREE.SRGBColorSpace
const blueTexture64 = textureLoader.load(blueTextureUrl64)
blueTexture64.colorSpace = THREE.SRGBColorSpace
const blueTexture128 = textureLoader.load(blueTextureUrl128)
blueTexture128.colorSpace = THREE.SRGBColorSpace
const blueTexture256 = textureLoader.load(blueTextureUrl256)
blueTexture256.colorSpace = THREE.SRGBColorSpace

const composer = new EffectComposer(renderer)
composer.addPass(new RenderPass(scene, camera))
const horizontalBlurPass = new ShaderPass(HorizontalBlurShader)
horizontalBlurPass.uniforms.h.value = blurState.blurRes / window.innerWidth
composer.addPass(horizontalBlurPass)
const verticalBlurPass = new ShaderPass(VerticalBlurShader)
verticalBlurPass.uniforms.v.value = blurState.blurRes / window.innerHeight
composer.addPass(verticalBlurPass)
composer.addPass(new OutputPass())

const noiseMaterial = new THREE.ShaderMaterial({
  glslVersion: THREE.GLSL3,
  side: THREE.DoubleSide,
  uniforms: {
    uTexture: { value: smokeTexture },
    noiseTexture: { value: blueTexture64 },
    smoothstepThreshold: { value: new THREE.Vector2(thresholdState.lower, thresholdState.upper) },
    clipThreshold: { value: thresholdState.clipThreshold },
    noiseTextureSize: { value: 64.0 },
  },
  vertexShader,
  fragmentShader,
  transparent: false
})

noiseMaterial.defines.DITHER_MODE = ditherDirective.indexOf(ditherState.dither)


ditherBinding.on('change', ({ value }) => {
  noiseMaterial.defines.DITHER_MODE = ditherDirective.indexOf(value)
  console.log(`Updating shader defines to DITHER_MODE = ${value}`)
  if (ditheringTextures[value]) {
    noiseMaterial.uniforms.noiseTexture.value = textureLoader.load(ditheringTextures[value])
    const noiseTextureSize = parseFloat(value.split('_').pop())
    noiseMaterial.uniforms.noiseTextureSize.value = noiseTextureSize
    console.log(`Updating textureSize to ${noiseTextureSize}`)
  }
  
  noiseMaterial.needsUpdate = true
})

lowerBinding.on('change', ({ value }) => {
  noiseMaterial.uniforms.smoothstepThreshold.value.x = value
})

upperBinding.on('change', ({ value }) => {
  noiseMaterial.uniforms.smoothstepThreshold.value.y = value
})

clipThresholdBinding.on('change', ({ value }) => {
  noiseMaterial.uniforms.clipThreshold.value = value
})

blurBinding.on('change', ({ value }) => {
  horizontalBlurPass.uniforms.h.value = value / window.innerWidth
  verticalBlurPass.uniforms.v.value = value / window.innerHeight
})

const plane = new THREE.Mesh(
  new THREE.PlaneGeometry(1.4, 1.4),
  noiseMaterial,
)

scene.add(plane)

function animate() {
  controls.update()
  composer.render()
  requestAnimationFrame(animate)
}

animate()

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
  composer.setSize(window.innerWidth, window.innerHeight)
  renderer.setPixelRatio(window.devicePixelRatio)
  composer.setPixelRatio(window.devicePixelRatio)
  horizontalBlurPass.uniforms.h.value = blurState.blurRes / window.innerWidth
  verticalBlurPass.uniforms.v.value = blurState.blurRes / window.innerHeight
})
