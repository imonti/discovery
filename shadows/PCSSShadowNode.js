import { shadow } from "three/tsl";
import {
  Fn,
  float,
  max,
  reference,
  renderGroup,
  screenCoordinate,
  texture,
  vec2,
  vogelDiskSample,
} from "three/tsl";

const BLOCKER_SAMPLES = 8;
const FILTER_SAMPLES = 5;
const DISTANCE_FADE = 0.75;
const MIN_DISTANCE_OPACITY = 0.15;

export function createPCSSShadowNode(light) {
  // Start with Three.js' regular shadow node, then replace only its filtering
  // step below. The rest of the shadow setup (shadow camera, projection,
  // bias, and shadow-map allocation) remains Three.js' responsibility.
  const shadowNode = shadow(light);

  shadowNode.setupShadowFilter = function (
    builder,
    { depthTexture, shadowCoord, shadow, depthLayer },
  ) {
    // shadowCoord is expressed in shadow-map space:
    //   xy = the projected UV coordinate in the depth texture
    //   z  = the current fragment's depth from the light
    // Fragments outside the projected shadow map are treated as fully lit.
    const frustumTest = shadowCoord.x
      .greaterThanEqual(0)
      .and(shadowCoord.x.lessThanEqual(1))
      .and(shadowCoord.y.greaterThanEqual(0))
      .and(shadowCoord.y.lessThanEqual(1))
      .and(shadowCoord.z.lessThanEqual(1));

    // These are live references to LightShadow properties. In particular,
    // changing shadow.radius at runtime changes the sampling footprint.
    const mapSize = reference("mapSize", "vec2", shadow).setGroup(
      renderGroup,
    );
    const shadowRadius = reference("radius", "float", shadow).setGroup(
      renderGroup,
    );
    // Convert a radius measured in shadow-map texels into UV units.
    const texelSize = vec2(1).div(mapSize);

    // Give each fragment a stable, pseudo-random rotation for its Vogel disk.
    // Rotating the pattern per pixel reduces visible concentric banding.
    const rotation = screenCoordinate.x
      .mul(12.9898)
      .add(screenCoordinate.y.mul(78.233))
      .sin()
      .mul(6.28318530718);

    const filter = Fn(() => {
      // Read a raw depth value. We intentionally do not use `.compare()` here:
      // WebGPU depth comparisons require a comparison sampler, while this
      // custom PCSS path uses the same texture for both blocker inspection and
      // the final visibility test with a regular sampler.
      const sampleDepth = (uv) => {
        let depth = texture(depthTexture, uv);

        if (depthTexture.isArrayTexture) {
          depth = depth.depth(depthLayer);
        }

        return depth;
      };

      // Pass 1: blocker search.
      // A blocker is a depth sample closer to the light than this fragment.
      // Averaging blocker depths gives us an estimate of the occluder's depth.
      const blockerDepth = float(0).toVar();
      const blockerCount = float(0).toVar();

      for (let i = 0; i < BLOCKER_SAMPLES; i++) {
        const offset = vogelDiskSample(i, BLOCKER_SAMPLES, rotation).mul(
          texelSize.mul(shadowRadius),
        );
        const depth = sampleDepth(shadowCoord.xy.add(offset));
        const isBlocker = depth.lessThan(shadowCoord.z);
        blockerDepth.addAssign(isBlocker.select(depth, 0));
        blockerCount.addAssign(isBlocker.select(1, 0));
      }

      // Avoid division by zero when no blocker was found. In that case the
      // blocker count is zero and softness is forced to zero below.
      const averageBlockerDepth = blockerDepth.div(max(blockerCount, 1));

      // Estimate how far the receiver is behind the blocker. A larger
      // blocker-to-receiver separation produces a wider penumbra and therefore
      // softer shadows. The factor 8 controls the softness response curve.
      const separation = shadowCoord.z
        .sub(averageBlockerDepth)
        .div(averageBlockerDepth.max(0.0001))
        .max(0);
      const softness = blockerCount
        .greaterThan(0)
        .select(separation.smoothstep(0, 0.125), 0);
      const filterRadius = texelSize.mul(shadowRadius).mul(softness);

      // Fade shadow opacity as the occluder gets farther from the receiver.
      // separation is normalized shadow-space distance, so DISTANCE_FADE
      // controls how quickly the shadow fades and the minimum keeps distant
      // shadows subtly visible instead of making them disappear abruptly.
      const distanceOpacity = blockerCount
        .greaterThan(0)
        .select(
          separation
            .mul(-DISTANCE_FADE)
            .add(1)
            .clamp(MIN_DISTANCE_OPACITY, 1),
          1,
        );
      const visibility = float(0).toVar();

      // Pass 2: percentage-closer filtering.
      // Sample around the receiver using the estimated penumbra radius. A
      // sample is lit when the stored occluder depth is at or behind the
      // receiver depth. Averaging these binary tests produces a soft value in
      // the [0, 1] range: 0 = fully shadowed, 1 = fully lit.
      for (let i = 0; i < FILTER_SAMPLES; i++) {
        const offset = vogelDiskSample(i, FILTER_SAMPLES, rotation).mul(
          filterRadius,
        );
        const depth = sampleDepth(shadowCoord.xy.add(offset));
        visibility.addAssign(depth.greaterThanEqual(shadowCoord.z));
      }

      const filteredVisibility = visibility.div(FILTER_SAMPLES);

      // Convert opacity into visibility. An opacity of 1 preserves the
      // filtered shadow; lower opacity blends it toward fully lit.
      return filteredVisibility
        .mul(distanceOpacity)
        .add(distanceOpacity.oneMinus());
    });

    // Return the shadow visibility mask used by Three.js lighting and by
    // materials' receivedShadowNode hooks.
    return frustumTest.select(filter(), float(1));
  };

  return shadowNode;
}
