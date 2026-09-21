import { float, pmremTexture, vec3 } from "three/tsl";

export const sampleIBLIrradiance = (environmentTexture, normalNode) => {
  // The environment cubemap's Z direction is opposite to the Bones scene's
  // world-space Z direction. Correct that convention before PMREM sampling.
  const environmentNormal = vec3(
    normalNode.x,
    normalNode.y,
    normalNode.z.negate(),
  );

  return pmremTexture(environmentTexture, environmentNormal, float(1)).mul(
    Math.PI,
  );
};
