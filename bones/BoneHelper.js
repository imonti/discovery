import * as THREE from "three";
import { AxisHelper } from "./AxisHelper";

class BoneHelper extends THREE.Object3D {
  constructor(bone) {
    super();
    if (!bone.isBone) {
      return;
    }
    const axisHelper = new AxisHelper(0.25);
    this.add(axisHelper);
    bone.matrix.decompose(this.position, this.rotation, this.scale);
    this.name = bone.name;
    this.isBone = true;
  }
}

export { BoneHelper };
