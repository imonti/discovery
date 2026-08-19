import * as THREE from 'three'

export function remapUVs(geometry) {

    const pos = geometry.getAttribute('position').array

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity

    for (let i = 0; i < pos.length; i += 3) {
        let x = pos[i]
        if (x < minX) {
            minX = x
        }
        if (x > maxX) {
            maxX = x
        }
        let y = pos[i + 1]
        if (y < minY) {
            minY = y
        }
        if (y > maxY) {
            maxY = y
        }
    }

    const width = maxX - minX
    const height = maxY - minY

    const uvs = geometry.getAttribute('uv').array

    for (let i = 0; i < uvs.length; i += 2) {
        uvs[i] = (uvs[i] - minX) / width
        uvs[i + 1] = 1.0 - ((uvs[i + 1] - minY) / height)
    }

}