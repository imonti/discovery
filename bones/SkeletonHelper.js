import * as THREE from "three";
import { BoneHelper } from "./BoneHelper";
import { findNodeByName } from "./GraphUtils";

class SkeletonHelper extends THREE.Object3D {
  constructor(skeleton) {
    super();
    skeleton.traverse((node) => {
      if (node.isBone) {
        const bone = new BoneHelper(node);
        if (this.children.length == 0) {
          this.add(bone);
        } else {
          const parentName = node.parent.name;
          const parent = findNodeByName(this, parentName);
          parent.add(bone);
        }
      }
    });
  }
}

export { SkeletonHelper };
