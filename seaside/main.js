import * as THREE from 'three'

const scene = new THREE.Scene()
scene.fog = new THREE.Fog(0xb8dfe4, 19, 34)

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.outputColorSpace = THREE.SRGBColorSpace
renderer.toneMapping = THREE.ACESFilmicToneMapping
renderer.toneMappingExposure = 1.15
document.body.appendChild(renderer.domElement)

const camera = new THREE.OrthographicCamera(-8, 8, 8, -8, 0.1, 100)
camera.position.set(0, 4.1, 18)
camera.lookAt(0, 4, 0)

scene.add(new THREE.HemisphereLight(0xdff7ff, 0x4a7b48, 2.4))
const sun = new THREE.DirectionalLight(0xffedc1, 3.2)
sun.position.set(-7, 11, 8)
scene.add(sun)

const clock = new THREE.Clock()
const animated = []
const rand = (min, max) => min + Math.random() * (max - min)

function makeMaterial(color, roughness = 1) {
  return new THREE.MeshStandardMaterial({ color, roughness, flatShading: true })
}

// Sky: a large softly colored plane keeps the illustration clean and bright.
const sky = new THREE.Mesh(
  new THREE.PlaneGeometry(60, 36),
  new THREE.MeshBasicMaterial({ color: 0xb8dfe4 })
)
sky.position.set(0, 9, -8)
scene.add(sky)

// Distant rolling hill.
const hill = new THREE.Mesh(
  new THREE.SphereGeometry(17, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2),
  makeMaterial(0x7db65a)
)
hill.scale.set(1.5, 0.25, 0.5)
hill.position.set(6, 1.5, -2.6)
scene.add(hill)

const ground = new THREE.Mesh(new THREE.PlaneGeometry(42, 28), makeMaterial(0x8fca5e))
ground.rotation.x = -Math.PI / 2
ground.position.set(0, -0.05, 0)
scene.add(ground)

// Painterly grass strokes: each blade is a tapered triangle with slight motion.
const grassGeometry = new THREE.ConeGeometry(0.055, 0.55, 3)
const grassMaterial = makeMaterial(0x5a9f49)
for (let i = 0; i < 170; i++) {
  const blade = new THREE.Mesh(grassGeometry, grassMaterial)
  blade.position.set(rand(-13, 13), 0.2, rand(-1.7, 4.8))
  blade.rotation.z = rand(-0.35, 0.35)
  blade.rotation.y = rand(0, Math.PI)
  blade.scale.y = rand(0.55, 1.7)
  blade.userData.phase = rand(0, Math.PI * 2)
  blade.userData.wind = rand(0.08, 0.24)
  animated.push(blade)
  scene.add(blade)
}

// Trunk assembled from low-poly tapered sections for a hand-shaped silhouette.
const trunkGroup = new THREE.Group()
trunkGroup.position.set(0, 0.1, 0.2)
scene.add(trunkGroup)
const trunkMaterial = makeMaterial(0x70452e)
const warmBark = makeMaterial(0x8e4b2f)

function branch(a, b, radius, material = trunkMaterial) {
  const direction = new THREE.Vector3().subVectors(b, a)
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.74, radius, direction.length(), 7), material)
  mesh.position.copy(a).add(b).multiplyScalar(0.5)
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize())
  trunkGroup.add(mesh)
}

branch(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.2, 4.2, 0), 0.48, trunkMaterial)
branch(new THREE.Vector3(0.12, 1.25, 0), new THREE.Vector3(-0.15, 3.15, 0), 0.32, warmBark)
branch(new THREE.Vector3(0.08, 2.6, 0), new THREE.Vector3(-1.6, 3.85, 0), 0.17, trunkMaterial)
branch(new THREE.Vector3(0.18, 2.8, 0), new THREE.Vector3(1.35, 4.15, 0), 0.22, warmBark)
branch(new THREE.Vector3(-0.12, 3.45, 0), new THREE.Vector3(-2.2, 4.2, 0), 0.10, trunkMaterial)
branch(new THREE.Vector3(-1.6, 3.85, 0), new THREE.Vector3(-2.8, 4.1, 0), 0.06, trunkMaterial)

// Canopy clusters create the large triangular umbrella silhouette.
const foliagePalette = [0x2d7656, 0x347e4b, 0x4d9250, 0x64a454, 0x7fb65b, 0x28664f]
const foliageGeometry = new THREE.IcosahedronGeometry(1, 1)
const canopy = new THREE.Group()
canopy.position.set(0, 4.65, 0)
scene.add(canopy)

for (let i = 0; i < 64; i++) {
  const t = i / 63
  const width = 1.15 + t * 3.6
  const cluster = new THREE.Mesh(foliageGeometry, makeMaterial(foliagePalette[i % foliagePalette.length]))
  cluster.position.set(rand(-width, width), rand(-0.55, 2.7) - t * 1.4, rand(-0.55, 0.55))
  const scale = rand(0.72, 1.35) * (1.05 - t * 0.25)
  cluster.scale.set(scale * rand(0.8, 1.35), scale * rand(0.7, 1.3), scale * rand(0.65, 1.1))
  cluster.userData.phase = rand(0, Math.PI * 2)
  cluster.userData.wind = rand(0.015, 0.045)
  animated.push(cluster)
  canopy.add(cluster)
}

// Small warm highlights break up the canopy like brush dabs.
for (let i = 0; i < 55; i++) {
  const accent = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(0.08, 0.17), 0), makeMaterial(i % 3 ? 0x6fa95a : 0x94bd64))
  accent.position.set(rand(-4.1, 4.1), rand(-0.1, 2.4), rand(-0.75, 0.4))
  accent.scale.y = rand(0.5, 1.5)
  accent.userData.phase = rand(0, Math.PI * 2)
  accent.userData.wind = rand(0.02, 0.06)
  animated.push(accent)
  canopy.add(accent)
}

// Foreground wildflowers, deliberately sparse so the tree remains dominant.
const flowerColors = [0xf7f3df, 0xe9b9d8, 0xc8c4f1, 0xf5d47c]
for (let i = 0; i < 105; i++) {
  const flower = new THREE.Group()
  flower.position.set(rand(-10.5, 10.5), rand(0.05, 0.15), rand(1.1, 4.9))
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, rand(0.22, 0.48), 4), makeMaterial(0x4f9147))
  stem.position.y = 0.15
  flower.add(stem)
  const bloom = new THREE.Mesh(new THREE.SphereGeometry(rand(0.055, 0.1), 5, 4), makeMaterial(flowerColors[i % flowerColors.length]))
  bloom.position.y = rand(0.28, 0.5)
  bloom.scale.set(1, 0.55, 1)
  flower.add(bloom)
  flower.userData.phase = rand(0, Math.PI * 2)
  flower.userData.wind = rand(0.08, 0.2)
  animated.push(flower)
  scene.add(flower)
}

function resize() {
  const aspect = window.innerWidth / window.innerHeight
  const viewHeight = 10.5
  camera.top = viewHeight / 2
  camera.bottom = -viewHeight / 2
  camera.left = -viewHeight * aspect / 2
  camera.right = viewHeight * aspect / 2
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

window.addEventListener('resize', resize)
resize()

function animate() {
  requestAnimationFrame(animate)
  const elapsed = clock.getElapsedTime()
  for (const object of animated) {
    const { phase, wind } = object.userData
    object.rotation.z = Math.sin(elapsed * 1.2 + phase) * wind
    object.rotation.x = Math.cos(elapsed * 0.8 + phase) * wind * 0.45
  }
  camera.position.x = Math.sin(elapsed * 0.12) * 0.13
  camera.lookAt(0, 4, 0)
  renderer.render(scene, camera)
}

animate()
