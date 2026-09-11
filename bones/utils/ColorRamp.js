import * as THREE from "three";
import { Fn, clamp, color, mix, select } from "three/tsl";

function ColorRamp(elements) {
  if (!Array.isArray(elements) || elements.length === 0) {
    throw new TypeError("ColorRamp requires at least one color element.");
  }

  const sortedElements = elements
    .map(({ color: elementColor, weight }) => {
      if (!(elementColor instanceof THREE.Color)) {
        throw new TypeError("ColorRamp element color must be a THREE.Color.");
      }

      if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
        throw new RangeError("ColorRamp element weights must be in [0, 1].");
      }

      return {
        color: elementColor.clone(),
        weight,
      };
    })
    .sort((a, b) => a.weight - b.weight);

  return Fn(([value]) => {
    const clampedValue = clamp(value, 0, 1);
    const last = sortedElements[sortedElements.length - 1];
    let result = color(last.color);

    for (let index = sortedElements.length - 2; index >= 0; index--) {
      const left = sortedElements[index];
      const right = sortedElements[index + 1];
      const span = right.weight - left.weight;
      const factor = span === 0
        ? 0
        : clamp(
          clampedValue.sub(left.weight).div(span),
          0,
          1,
        );
      const segmentColor = mix(
        color(left.color),
        color(right.color),
        factor,
      );

      result = select(
        clampedValue.lessThanEqual(right.weight),
        segmentColor,
        result,
      );
    }

    return result;
  });
}

export { ColorRamp };
