import {
  Color,
  DataTexture,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import type { ThemeColors } from "../../themes/types";

/** An iris painted in eye-local coordinates, independent of the surrounding eyelids. */
export function createEyeTexture(
  colors: ThemeColors,
  pupilSize: number,
): DataTexture {
  const size = 128,
    pixels = new Uint8Array(size * size * 4);
  const white = new Color(colors.eyes.white).lerp(
    new Color(colors.skin.light),
    0.09,
  );
  const inner = new Color(colors.eyes.iris),
    outer = new Color(colors.eyes.irisDark),
    pupil = new Color(colors.eyes.pupil);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1,
        ny = ((y + 0.5) / size) * 2 - 1;
      const r = Math.hypot(nx, ny),
        angle = Math.atan2(ny, nx);
      const color = white.clone();
      if (r < 0.46) {
        const fiber =
          (Math.sin(angle * 67 + r * 15) + Math.sin(angle * 103 - r * 21)) *
          0.12;
        color
          .copy(inner)
          .lerp(
            outer,
            Math.max(0, Math.min(1, (r / 0.46) ** 4 + fiber + 0.15)),
          );
      }
      if (r < 0.19 * pupilSize) color.copy(pupil);
      color.convertLinearToSRGB();
      const offset = (y * size + x) * 4;
      pixels[offset] = Math.round(color.r * 255);
      pixels[offset + 1] = Math.round(color.g * 255);
      pixels[offset + 2] = Math.round(color.b * 255);
      pixels[offset + 3] = 255;
    }
  const texture = new DataTexture(
    pixels,
    size,
    size,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}
