import { describe, expect, it } from "bun:test";
import { Color } from "three";
import { defaultTheme, robotTheme } from "../../src/themes/default-themes";
import {
  applyThemeToMaterials,
  createThemeMaterials,
  disposeThemeMaterials,
  parseCssColor,
} from "../../src/renderers/three/theme-materials";

describe("theme materials", () => {
  it("parses hex and rgba colors", () => {
    expect(parseCssColor("#ffd4b0").color.getHexString()).toBe("ffd4b0");
    expect(parseCssColor("#ffd4b0").opacity).toBe(1);

    const blush = parseCssColor("rgba(255,140,140,0.4)");
    expect(blush.color.r).toBeCloseTo(1);
    expect(blush.color.g).toBeCloseTo(140 / 255);
    expect(blush.opacity).toBeCloseTo(0.4);

    const rgb = parseCssColor("rgb(0, 255, 255)");
    expect(rgb.color.getHexString()).toBe("00ffff");
    expect(rgb.opacity).toBe(1);
  });

  it("maps default and robot palettes onto distinct materials", () => {
    const materials = createThemeMaterials(defaultTheme);

    expect(materials.skin.color.getHexString()).toBe(
      new Color(defaultTheme.colors.skin.mid).getHexString(),
    );
    expect(materials.iris.color.getHexString()).toBe(
      new Color(defaultTheme.colors.eyes.irisMid).getHexString(),
    );
    expect(materials.hairLight.color.getHexString()).toBe(
      new Color(defaultTheme.colors.hair.light).getHexString(),
    );
    expect(materials.skinLight.opacity).toBeCloseTo(0.4);
    expect(materials.blush.opacity).toBeCloseTo(0.4);
    expect(materials.stroke.color.getHexString()).toBe(
      new Color(defaultTheme.colors.stroke).getHexString(),
    );

    applyThemeToMaterials(materials, robotTheme);

    expect(materials.skin.color.getHexString()).toBe(
      new Color(robotTheme.colors.skin.mid).getHexString(),
    );
    expect(materials.iris.color.getHexString()).toBe(
      new Color(robotTheme.colors.eyes.irisMid).getHexString(),
    );
    expect(materials.skin.color.getHexString()).not.toBe(
      new Color(defaultTheme.colors.skin.mid).getHexString(),
    );
    expect(materials.iris.color.getHexString()).not.toBe(
      new Color(defaultTheme.colors.eyes.irisMid).getHexString(),
    );
    expect(materials.hairLight.color.getHexString()).toBe(
      new Color(robotTheme.colors.hair.light).getHexString(),
    );

    applyThemeToMaterials(materials, defaultTheme);
    expect(materials.skin.color.getHexString()).toBe(
      new Color(defaultTheme.colors.skin.mid).getHexString(),
    );

    disposeThemeMaterials(materials);
  });
});
