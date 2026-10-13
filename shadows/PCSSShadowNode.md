# PCSS Shadow Node

`PCSSShadowNode.js` implements a percentage-closer soft-shadow filter for a
Three.js `DirectionalLight` using TSL and WebGPU.

PCSS has two main jobs:

1. Estimate how large the shadow's penumbra should be.
2. Average visibility samples across that penumbra.

The final result is a visibility value in the range `[0, 1]`:

```text
0 = fully shadowed
1 = fully lit
```

## Shadow-node inputs

Three.js calls `setupShadowFilter` with:

- `depthTexture`: the shadow pass' depth texture. It stores the nearest surface
  seen from the light for each shadow-map texel.
- `shadowCoord`: a TSL `vec3` for the current fragment in shadow-map space.
  `xy` are shadow-map UV coordinates and `z` is the receiver depth.
- `shadow`: the light's `DirectionalLightShadow` object. Its `mapSize` and
  `radius` are read as live shader references.
- `depthLayer`: the layer index used when the depth texture is a texture array.
  It is unused for the normal 2D directional-light shadow map.

The receiver depth is calculated from the current fragment's world position by
projecting it through the light's shadow camera. It does not come from the
shadow texture.

## Shadow-map coordinates

Three.js transforms a world-space position with the light's shadow matrix:

```text
world position
  → shadow-camera view transform
  → shadow-camera projection
  → divide by w
  → shadowCoord
```

For standard depth values, smaller `z` values are closer to the light. A depth
sample is therefore a blocker when it is closer to the light than the current
receiver:

```js
const isBlocker = depth.lessThan(shadowCoord.z);
```

## Sampling pattern

`vogelDiskSample(index, count, rotation)` returns a `vec2` point inside a unit
disk. It distributes points using a golden-angle spiral. The pattern is
rotated per screen pixel to reduce visible banding and repetition.

The point is scaled by a radius and added to `shadowCoord.xy` to produce a
nearby shadow-map sample location.

## Pass 1: blocker search

The first pass samples `BLOCKER_SAMPLES` nearby texels, currently eight:

```text
sample nearby shadow depths
  → keep samples closer than the receiver
  → sum their depths
  → count them
  → average their depths
```

The average is protected against division by zero:

```js
const averageBlockerDepth = blockerDepth.div(
  max(blockerCount, 1),
);
```

`max(blockerCount, 1)` still divides by the real count when blockers exist,
but uses `1` when the count is zero.

## Estimating separation

The current receiver depth and average blocker depth are used to estimate a
relative light-space separation:

```js
const separation = shadowCoord.z
  .sub(averageBlockerDepth)
  .div(max(averageBlockerDepth, 0.0001))
  .max(0);
```

Mathematically:

```text
separation = max(
  (receiverDepth - averageBlockerDepth)
  / averageBlockerDepth,
  0
)
```

This is not an exact world-space distance. It estimates separation along the
light's projected depth axis, using only the nearest blocker information that
a standard shadow map contains.

## Converting separation to softness

The separation is converted to a smooth penumbra factor with `smoothstep`:

```js
const softness = blockerCount
  .greaterThan(0)
  .select(separation.smoothstep(0, 0.125), 0);
```

The result is in `[0, 1]`:

- Below `0`: no softness.
- Between `0` and `0.125`: smoothly increasing softness.
- Above `0.125`: maximum softness.

The final filtering radius is then:

```js
const filterRadius = texelSize
  .mul(shadowRadius)
  .mul(softness);
```

This converts the user-controlled radius from shadow-map texels into UV units,
then scales it by the distance-based softness.

## Pass 2: visibility filtering

The second pass samples `FILTER_SAMPLES` points, currently five, inside the
estimated penumbra:

```text
sample around the receiver
  → compare each stored depth to receiver depth
  → count lit samples
  → average the results
```

For standard depth values:

```text
stored depth >= receiver depth → lit sample
stored depth <  receiver depth → shadowed sample
```

The average produces percentage-closer visibility:

```js
const filteredVisibility =
  visibility.div(FILTER_SAMPLES);
```

For example, if two of five samples are lit, the visibility is `0.4`.

The implementation compares raw depth values with scalar math rather than
using `.compare()`. This avoids generating an invalid WebGPU
`textureSampleCompare` call when the depth texture is bound with a regular
sampler.

## Distance-based shadow opacity

The node also fades shadow opacity as the blocker-to-receiver separation grows:

```js
const distanceOpacity = blockerCount
  .greaterThan(0)
  .select(
    separation
      .mul(-DISTANCE_FADE)
      .add(1)
      .clamp(MIN_DISTANCE_OPACITY, 1),
    1,
  );
```

The filtered visibility is blended toward fully lit using that opacity:

```js
return filteredVisibility
  .mul(distanceOpacity)
  .add(distanceOpacity.oneMinus());
```

Nearby blockers therefore retain stronger shadows, while distant blockers
produce lighter shadows. `MIN_DISTANCE_OPACITY` prevents them from becoming
completely invisible.

## What the shadow map cannot represent

A standard depth shadow map stores only the nearest surface from the light:

```text
light → nearest blocker → hidden objects → receiver
```

The PCSS estimate therefore uses the nearest sampled blocker. It cannot recover
objects stacked behind that blocker, or accurately model multiple depth layers
and transparent occluders. Layered/deep shadow maps or ray tracing would be
needed for that information.

For opaque objects, the nearest blocker is usually a useful approximation because
objects behind it are already blocked from the light along that ray.

