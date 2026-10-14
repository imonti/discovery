import * as THREE from 'three'
import ripplesAlphaUrl from '../assets/ripples_alpha.png?url'
import ripplesStencilUrl from '../assets/ripples_stencil.png?url'

export class WaterMaterial extends THREE.ShaderMaterial {

    constructor(opacity = 1.0, speed = new THREE.Vector2(0.0, 0.0)) {

        const ripples_alpha = new THREE.TextureLoader().load(ripplesAlphaUrl)
        ripples_alpha.wrapS = THREE.RepeatWrapping
        ripples_alpha.wrapT = THREE.RepeatWrapping
        const ripples_stencil = new THREE.TextureLoader().load(ripplesStencilUrl)
        super({
            uniforms: {
                alpha_texture: { value: ripples_alpha },
                stencil_texture: { value: ripples_stencil },
                time: { value: 0.0 },
                opacity: { value: opacity },
                speed: { value: new THREE.Vector2(1.0 + speed.x, 1.0 + speed.y) }
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
            uniform sampler2D alpha_texture;
            uniform sampler2D stencil_texture;
            uniform vec2 speed;
            uniform float time;
            uniform float opacity;
            varying vec2 vUv;
            void main() {
                float stencil = texture2D(stencil_texture, vUv).r;
                float alpha = texture2D(alpha_texture, vUv + (speed * time)).r;
                float a = clamp(stencil * alpha * opacity, 0.0, 1.0);
                gl_FragColor = vec4(1.0, 1.0, 1.0, a);
            }`,
            transparent: true,
            side: THREE.DoubleSide
        })

        let t = Date.now()
        this.onBeforeRender = () => {
            t = Date.now() - t
            this.uniforms.time.value = parseFloat(t)
        }
    }

}
