import { Fn, hue, saturation } from "three/tsl";

const hsl = Fn(([color, hueAmount, saturationAmount, valueAmount]) => {
  return hue(saturation(color, saturationAmount), hueAmount).mul(valueAmount);
});

export { hsl };
