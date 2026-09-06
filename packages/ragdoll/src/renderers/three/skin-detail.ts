import { DataTexture, LinearFilter, RGBAFormat, UnsignedByteType } from "three";

/** Fine surface relief in the authored face's planar detail atlas. */
export function createSkinDetail(age: number): DataTexture {
  const width = 1024,
    height = 512,
    pixels = new Uint8Array(width * height * 4);
  const maturity = Math.max(0, (age - 0.5) * 2);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const fx = ((x % 512) / 512) * 180 - 90,
        fy = (y / height - 0.5) * 220;
      let relief = 128 + Math.sin(x * 17.13 + y * 91.7) * 1.5;
      if (x < 512) {
        for (let crease = 0; crease < 5; crease++) {
          const line =
            42 + crease * 7 + Math.sin(fx * 0.06) * 0.6 - fx * fx * 0.002;
          relief -=
            maturity *
            60 *
            Math.exp(-(((fy - line) / 0.38) ** 2) - (fx / 42) ** 6);
        }
        const underEye = -6 - 3 * Math.cos((Math.abs(fx) - 26) * 0.12);
        relief -=
          maturity *
          45 *
          Math.exp(
            -(((fy - underEye) / 0.5) ** 2) - ((Math.abs(fx) - 26) / 15) ** 4,
          );
        const foldX = 14 + (25 + fy) * -0.24;
        relief -=
          maturity *
          38 *
          Math.exp(
            -(((Math.abs(fx) - foldX) / 0.6) ** 2) - ((fy + 39) / 16) ** 4,
          );
      }
      const value = Math.round(Math.max(0, Math.min(255, relief))),
        i = (y * width + x) * 4;
      pixels[i] = value;
      pixels[i + 1] = value;
      pixels[i + 2] = value;
      pixels[i + 3] = 255;
    }
  const texture = new DataTexture(
    pixels,
    width,
    height,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
