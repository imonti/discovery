import * as THREE from "three";
function voxelize(geometry, subdivisions) {
  const vertexBuffer = geometry.getAttribute("position");
  const voxels = [
    {
      voxel: new THREE.Box3().setFromBufferAttribute(vertexBuffer),
      triangles: triangulate(geometry),
    },
  ];

  /*
  for i = 0; i < subdivisions; i++
    octree_subdivision = []
    for each voxel in voxels
        new_voxels.push(...subdivide_voxel(voxel))
    voxels = octree_subdivision
  */

  return voxels;
}