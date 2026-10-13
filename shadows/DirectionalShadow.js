import * as THREE from "three";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { depthPass, uniform } from "three/tsl";

export class DirectionalShadow {
  constructor(renderer, scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.shadowCamera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.01, 20);
    this.shadowCamera.coordinateSystem = renderer.coordinateSystem;
    this.shadowCamera.updateProjectionMatrix();
    // This direction is perpendicular to the main camera's (8, 6, 8) view vector.
    this.shadowCamera.position.set(0, 8, -6);
    this.shadowCamera.lookAt(0, 0, 0);
    this.shadowCamera.updateMatrixWorld();

    const lightDirection = new THREE.Vector3();
    this.shadowCamera.getWorldDirection(lightDirection).negate();
    this.lightDirectionNode = uniform(lightDirection);

    this.shadowMatrix = new THREE.Matrix4().multiplyMatrices(
      this.shadowCamera.projectionMatrix,
      this.shadowCamera.matrixWorldInverse,
    );
    this.shadowMatrixNode = uniform(this.shadowMatrix);

    this.shadowPass = depthPass(scene, this.shadowCamera);
    this.shadowPass.setResolutionScale(0.5);
    // The shadow pass must not render materials that sample its own depth texture.
    this.shadowPass.overrideMaterial = new MeshBasicNodeMaterial();
    this.shadowDepth = this.shadowPass.getTextureNode("depth");
  }
}
