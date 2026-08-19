import * as THREE from "three";
const rnd_rng = THREE.MathUtils.randFloat;

function distributePointsOnSurface(width, height, count) {
  const points = [];

  for (let i = 0; i < count; i++) {
    const x = rnd_rng(0, width);
    const y = rnd_rng(0, height);
    points.push({ x, y });
  }

  voidAndCluster(width, height, points);

  return points;
}

function voidAndCluster(width, height, points) {
  const sigma = Math.min(width, height) * 0.1;
  for (let i = 0; i < 100; i++) {
    const _void = { d: Infinity, x: 0, y: 0 };
    const cluster = { d: -Infinity, x: 0, y: 0 };
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let computed_density = 0;
        for (const p of points) {
          const dx = p.x - x;
          const dy = p.y - y;
          const d2 = dx * dx + dy * dy;
          const contributed_density = Math.exp(-d2 / (2 * sigma * sigma));
          computed_density += contributed_density;
        }
        // replace void
        if (computed_density < _void.d) {
          _void.x = x;
          _void.y = y;
          _void.d = computed_density;
        }
        // replace cluster
        if (computed_density > cluster.d) {
          cluster.x = x;
          cluster.y = y;
          cluster.d = computed_density;
        }
      }
    }
    // move the closest point to the cluster position into the void position
    const candidate_point = findClosest(cluster.x, cluster.y, points);
    candidate_point.x = _void.x;
    candidate_point.y = _void.y;
  }
}

function findClosest(x, y, points) {
  let closest_distance = null;
  let closest_point = null;
  for (const p of points) {
    const dx = p.x - x;
    const dy = p.y - y;
    const computed_distance = dx * dx + dy * dy;
    if (!closest_point || computed_distance < closest_distance) {
      closest_point = p;
      closest_distance = computed_distance;
    }
  }
  return closest_point;
}

export { distributePointsOnSurface };
