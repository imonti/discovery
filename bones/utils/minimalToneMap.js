import { Fn } from "three/tsl";

export const minimalToneMap = Fn(([color, exposure, whitePoint]) => {
  const exposedColor = color.mul(exposure);
  const whitePointSquared = whitePoint.mul(whitePoint);

  // Extended Reinhard tone mapping. It compresses HDR values while allowing
  // the white point to control where the output reaches display white.
  return exposedColor
    .mul(whitePointSquared.add(exposedColor))
    .div(whitePointSquared.mul(exposedColor.add(1)));
});
