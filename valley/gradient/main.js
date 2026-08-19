import * as THREE from 'three'

const quality = 1024
var canvas = document.createElement('canvas')
canvas.width = quality
canvas.height = 1
var ctx = canvas.getContext("2d", {
    antialias: true,
    willReadFrequently: true,
    alpha: true
})
// document.body.appendChild(canvas)

export function createRadialGradientMaterial(radialGradient) {
    const [cx, cy, r] = getAttributes(radialGradient, ['cx', 'cy', 'r'])
    const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, quality)
    for (let child of radialGradient.childNodes) {
        if (child.nodeName === 'stop') {
            const stop = child
            const offset = stop.getAttribute('offset')
            let stopOpacity = 'FF'
            if (stop.hasAttribute('stop-opacity')) {
                stopOpacity = numHex(parseInt(parseFloat(stop.getAttribute('stop-opacity')) * 255))
            }
            const color = stop.getAttribute('stop-color') + stopOpacity
            grad.addColorStop(offset, color)
        }
    }
    ctx.clearRect(0, 0, quality, 1)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, quality, 1)
    const imageData = ctx.getImageData(0, 0, quality, 1)
    const rampTexture = new THREE.DataTexture(imageData.data, quality, 1)
    const transform = new THREE.Matrix3().identity()
    if (radialGradient.hasAttribute('gradientTransform')) {
        const gradientTransform = radialGradient.getAttribute('gradientTransform')
        if (gradientTransform.indexOf('translate') !== -1) {
            const [tx, ty] = gradientTransform.match(/(?<=translate\()(.+)(?=\))/g)[0].split(' ').map(n => parseFloat(n))
            transform.translate(tx, ty)
        } else if (gradientTransform.indexOf('matrix') !== -1) {
            const [a, b, c, d, e, f] = gradientTransform.match(/(?<=matrix\()(.+)(?=\))/g)[0].split(' ').map(n => parseFloat(n))
            transform.scale(a, d)
            transform.translate(e, f)
        }
    }
    const gradientCenter = new THREE.Vector2(cx, cy).applyMatrix3(transform)
    rampTexture.needsUpdate = true
    const material = new THREE.ShaderMaterial({
        uniforms: {
            center: { value: gradientCenter },
            r: { value: r },
            ramp: { value: rampTexture },
            opacity: { value: 1.0 }
        },
        vertexShader: `
            precision highp float;
            varying vec2 vUv;
            void main(){
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                vUv = uv;
            }`,
        fragmentShader: `
            precision highp float;
            uniform vec2 center;
            uniform float r;
            uniform sampler2D ramp;
            uniform float opacity;
            varying vec2 vUv;
            void main() {
                vec2 dist = vUv - center;
                float gradU = length(vUv - center) / r;
                vec4 sampled = texture2D(ramp, vec2(gradU, 0.0));
                gl_FragColor = vec4(sampled.rgb, sampled.a * opacity);
            }`,
        side: THREE.DoubleSide
    })
    return material
}

export function createLinearGradientMaterial(linearGradient) {
    const [x1, y1, x2, y2] = getAttributes(linearGradient, ['x1', 'y1', 'x2', 'y2'])
    const grad = ctx.createLinearGradient(0, 0, quality, 0)
    for (let child of linearGradient.childNodes) {
        if (child.nodeName === 'stop') {
            const stop = child
            const offset = stop.getAttribute('offset')
            const color = stop.getAttribute('stop-color')
            grad.addColorStop(offset, color)
        }
    }
    ctx.clearRect(0, 0, quality, 1)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, quality, 1)
    const imageData = ctx.getImageData(0, 0, quality, 1)
    const rampTexture = new THREE.DataTexture(imageData.data, quality, 1)
    const transform = new THREE.Matrix3().identity()
    if (linearGradient.hasAttribute('gradientTransform')) {
        const gradientTransform = linearGradient.getAttribute('gradientTransform')
        if (gradientTransform.indexOf('translate') !== -1) {
            const [tx, ty] = gradientTransform.match(/(?<=translate\()(.+)(?=\))/g)[0].split(' ').map(n => parseFloat(n))
            transform.translate(tx, ty)
        } else if (gradientTransform.indexOf('matrix') !== -1) {
            const [a, b, c, d, e, f] = gradientTransform.match(/(?<=matrix\()(.+)(?=\))/g)[0].split(' ').map(n => parseFloat(n))
            transform.set(a, b, e, c, d, f, 0, 0, 0)
        }
    }
    rampTexture.needsUpdate = true
    const v1 = new THREE.Vector2(x1, y1).applyMatrix3(transform)
    const v2 = new THREE.Vector2(x2, y2).applyMatrix3(transform)

    const material = new THREE.ShaderMaterial({
        uniforms: {
            v1: { value: v1 },
            v2: { value: v2 },
            ramp: { value: rampTexture },
            opacity: { value: 1.0 }
        },
        vertexShader: `
            precision highp float;
            varying vec2 vUv;
            void main(){
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                vUv = uv;
            }`,
        fragmentShader: `
            precision highp float;
            uniform vec2 v1;
            uniform vec2 v2;
            uniform sampler2D ramp;
            uniform float opacity;
            varying vec2 vUv;
            void main() {
                vec2 a = v2 - v1;
                vec2 b = vUv - v1;
                float c = dot(b, normalize(a));
                float r = c / length(a);
                vec4 sampled = texture2D(ramp, vec2(r, 0.5));
                gl_FragColor = vec4(sampled.rgb, sampled.a * opacity);
            }`,
        side: THREE.DoubleSide
    })
    return material
}

function getAttributes(element, attributes) {
    const result = []
    for (let attribute of attributes) {
        result.push(element.getAttribute(attribute))
    }
    return result
}

function numHex(s) {
    var a = s.toString(16);
    if ((a.length % 2) > 0) {
        a = "0" + a;
    }
    return a;
}