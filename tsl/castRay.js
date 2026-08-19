import * as THREE from "three";
import { LineSegments2 } from "three/addons/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/addons/lines/LineSegmentsGeometry.js";
import { billboarding } from "three/tsl";
import { Line2NodeMaterial, MeshBasicNodeMaterial } from "three/webgpu";


export default function(origin, direction, collider) {

    const group = new THREE.Group()

    const dotGeometry = new THREE.CircleGeometry(0.05, 32);
    const dotMaterial = new MeshBasicNodeMaterial();
    dotMaterial.color = new THREE.Color(0xffffff);
    dotMaterial.vertexNode = billboarding({ horizontal: true, vertical: true });
    const dot = new THREE.Mesh(dotGeometry, dotMaterial);
    group.add(dot)

    const rayGeometry = new LineSegmentsGeometry();
    const rayCoordinates = new Float32Array([0, 0, 0, direction.x, direction.y, direction.z]);
    rayGeometry.setPositions(rayCoordinates);
    const rayMaterial = new Line2NodeMaterial({ linewidth: 1.0, color: 0xff0000 });
    const rayMesh = new LineSegments2(rayGeometry, rayMaterial);
    group.add(rayMesh);
    group.position.copy(origin)

    return group

}