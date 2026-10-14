import * as THREE from 'three'
// import { SVGLoader } from 'three/addons/loaders/SVGLoader.js'
import { SVGLoader } from './SVGLoader.js'
import { createRadialGradientMaterial, createLinearGradientMaterial } from './gradient/main.js'
import { WaterMaterial } from './materials/wavesMaterial.js'
import { remapUVs } from './utils/remapUvs.js'
import valleySVG from './assets/valley.svg?url'

const sceneWidthPx = 1400
const sceneHeightPx = 597
const windowAspectRatio = window.innerWidth / window.innerHeight
const cameraHeight = sceneHeightPx
const cameraWidth = sceneHeightPx * windowAspectRatio
const half_height = cameraHeight / 2.0
const half_width = cameraWidth / 2.0
const far = 1.0
const spread = 0.01

const scene = new THREE.Scene()
const camera = new THREE.OrthographicCamera(-half_width, half_width, -half_height, half_height, 0.0, far)
camera.position.x = sceneWidthPx / 2.0
camera.position.y = sceneHeightPx / 2.0

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setSize(window.innerWidth, window.innerHeight)
document.body.appendChild(renderer.domElement)

function animate() {
    requestAnimationFrame(animate)
    renderer.render(scene, camera)
}

animate()

// instantiate a loader
const loader = new SVGLoader()

function onLoaded(data) {
    const doc = styleToAttrib(data.xml)
    const paths = data.paths
    for (let i = 0; i < paths.length; i++) {
        const path = paths[i]
        const node = path.userData.node
        const id = node.getAttribute('id')
        const opacity = parseFloat(node.getAttribute('opacity') ?? '1.0')
        const transparent = true //opacity < 1.0
        let material = null
        if (id !== null && id.indexOf('fx') !== -1) {
            if (id === 'fxWaves') {
                material = new WaterMaterial(2.0, new THREE.Vector2(0.0, 0.0001))
            }
        } else {
            const fill = node.getAttribute('fill')
            const complexFill = fill.match(/(?<=url\()(#.+)(?=\))/g)
            if (complexFill) {
                const fillId = complexFill[0]
                const fillDefinition = doc.querySelector(fillId)
                if (fillDefinition.tagName === "radialGradient") {
                    material = createRadialGradientMaterial(fillDefinition)
                    material.uniforms.opacity.value = opacity
                    material.transparent = transparent
                    material.side = THREE.DoubleSide
                } else if (fillDefinition.tagName === "linearGradient") {
                    material = createLinearGradientMaterial(fillDefinition)
                    material.side = THREE.DoubleSide
                    material.uniforms.opacity.value = opacity
                    material.transparent = transparent
                } else {
                    material = new THREE.MeshBasicMaterial({
                        color: new THREE.Color('#FF0000'),
                        side: THREE.DoubleSide,
                        opacity,
                        transparent
                    })
                }
            } else {
                material = new THREE.MeshBasicMaterial({
                    color: fill,
                    side: THREE.DoubleSide,
                    opacity,
                    transparent
                })
            }
        }

        const shapes = SVGLoader.createShapes(path)
        const z = (i * spread) - far
        for (let i = 0; i < shapes.length; i++) {
            const shape = shapes[i]
            const geometry = new THREE.ShapeGeometry(shape)
            if (id !== null && id.indexOf('fx') !== -1) {
                // console.log(geometry)
                remapUVs(geometry)
            }
            const mesh = new THREE.Mesh(geometry, material)
            mesh.position.z = z
            scene.add(mesh)
        }
    }

}

function onProgress(xhr) {
    console.log((xhr.loaded / xhr.total * 100) + '% loaded')
}

function onError(error) {
    console.error(error)
}

// load a SVG resource
loader.load(valleySVG, onLoaded, onProgress, onError)

export function styleToAttrib(document) {
    const nodesWithStyle = document.querySelectorAll('[style]')
    nodesWithStyle.forEach((node) => {
        const style = node.getAttribute('style')
        if (!style || !style.trim()) {
            return
        }
        const rules = style.split(';')
        rules.forEach((ruleDefinition) => {
            const rule = ruleDefinition.split(':')
            if (rule.length !== 2) {
                return
            }
            const directive = rule[0].trim()
            const value = rule[1].trim()
            if (!node.hasAttribute(directive)) {
                node.setAttribute(directive, value)
            }

        })
        node.removeAttribute('style')
    })
    return document
}
