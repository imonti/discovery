import * as THREE from 'three'

class AxisHelper extends THREE.Object3D {
  constructor(length = 0.5) {
    super();
    const origin = new THREE.Vector3();
    const x_axis = new THREE.Vector3(1.0, 0.0, 0.0);
    const y_axis = new THREE.Vector3(0.0, 1.0, 0.0);
    const z_axis = new THREE.Vector3(0.0, 0.0, 1.0);
    const xColor = 0xfda4af;
    const yColor = 0x6ee7b7;
    const zColor = 0x93c5fd;
    const x_arrow = new THREE.ArrowHelper(x_axis, origin, length, xColor);
    const y_arrow = new THREE.ArrowHelper(y_axis, origin, length, yColor);
    const z_arrow = new THREE.ArrowHelper(z_axis, origin, length, zColor);
    this.add(x_arrow);
    this.add(y_arrow);
    this.add(z_arrow);
  }

  setColor(color, axis = "all") {
    switch (axis) {
      case "all":
        this.setColor(color, "X");
        this.setColor(color, "Y");
        this.setColor(color, "Z");
        break;
      case "X":
        this.children[0].setColor(color);
        break;
      case "Y":
        this.children[1].setColor(color);
        break;
      case "Z":
        this.children[2].setColor(color);
        break;
    }
  }
}

export { AxisHelper };
