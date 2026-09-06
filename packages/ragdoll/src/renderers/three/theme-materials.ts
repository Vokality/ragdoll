import {
  Color,
  MeshStandardMaterial,
  LineBasicMaterial,
} from "three";
import type { RagdollTheme } from "../../themes/types";

export interface CssColor {
  color: Color;
  opacity: number;
}

export function parseCssColor(value: string): CssColor {
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
    value,
  );
  if (rgba) {
    return {
      color: new Color(
        Number(rgba[1]) / 255,
        Number(rgba[2]) / 255,
        Number(rgba[3]) / 255,
      ),
      opacity: rgba[4] === undefined ? 1 : Number(rgba[4]),
    };
  }
  return { color: new Color(value), opacity: 1 };
}

export interface CharacterMaterials {
  skin: MeshStandardMaterial;
  skinLight: MeshStandardMaterial;
  skinFace: MeshStandardMaterial;
  hair: MeshStandardMaterial;
  hairLight: MeshStandardMaterial;
  brow: MeshStandardMaterial;
  sclera: MeshStandardMaterial;
  iris: MeshStandardMaterial;
  pupil: MeshStandardMaterial;
  highlight: MeshStandardMaterial;
  lid: MeshStandardMaterial;
  upperLip: MeshStandardMaterial;
  lowerLip: MeshStandardMaterial;
  blush: MeshStandardMaterial;
  shadow: MeshStandardMaterial;
  teeth: MeshStandardMaterial;
  nose: MeshStandardMaterial;
  crease: LineBasicMaterial;
  stroke: LineBasicMaterial;
  mouthOpening: MeshStandardMaterial;
}

function standard(params: ConstructorParameters<typeof MeshStandardMaterial>[0]) {
  return new MeshStandardMaterial(params);
}

export function createThemeMaterials(theme: RagdollTheme): CharacterMaterials {
  const materials = {
    skin: standard({ roughness: 0.62, metalness: 0.02 }),
    skinLight: standard({
      roughness: 0.5,
      metalness: 0.02,
      transparent: true,
      depthWrite: false,
    }),
    skinFace: standard({ roughness: 0.58, metalness: 0.02 }),
    hair: standard({ roughness: 0.72, metalness: 0.04 }),
    hairLight: standard({
      roughness: 0.55,
      metalness: 0.04,
      transparent: true,
      depthWrite: false,
    }),
    brow: standard({ roughness: 0.74, metalness: 0.04 }),
    sclera: standard({ roughness: 0.28, metalness: 0 }),
    iris: standard({ roughness: 0.22, metalness: 0.08 }),
    pupil: standard({ roughness: 0.18, metalness: 0 }),
    highlight: standard({
      roughness: 0.12,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    }),
    lid: standard({ roughness: 0.6, metalness: 0.02 }),
    upperLip: standard({ roughness: 0.38, metalness: 0.05 }),
    lowerLip: standard({ roughness: 0.34, metalness: 0.05 }),
    blush: standard({
      roughness: 0.7,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    }),
    shadow: standard({
      roughness: 1,
      metalness: 0,
      transparent: true,
      depthWrite: false,
    }),
    teeth: standard({ roughness: 0.35, metalness: 0 }),
    nose: standard({ roughness: 0.55, metalness: 0.02 }),
    crease: new LineBasicMaterial({ transparent: true }),
    stroke: new LineBasicMaterial({ transparent: true }),
    mouthOpening: standard({ roughness: 1, metalness: 0 }),
  } satisfies CharacterMaterials;
  applyThemeToMaterials(materials, theme);
  return materials;
}

export function applyThemeToMaterials(
  materials: CharacterMaterials,
  theme: RagdollTheme,
): void {
  const colors = theme.colors;
  assign(materials.skin, colors.skin.mid);
  assign(materials.skinLight, colors.skin.light, 0.4);
  assign(materials.skinFace, colors.skin.radial);
  assign(materials.hair, colors.hair.mid);
  assign(materials.hairLight, colors.hair.light, 0.3);
  assign(materials.brow, colors.hair.mid);
  assign(materials.sclera, colors.eyes.white);
  assign(materials.iris, colors.eyes.irisMid);
  assign(materials.pupil, colors.eyes.pupil);
  assign(materials.highlight, colors.highlight, 0.8);
  assign(materials.lid, colors.lids.light);
  assign(materials.upperLip, colors.lips.upper);
  assign(materials.lowerLip, colors.lips.lower);
  assign(materials.blush, colors.blush.color);
  assign(materials.shadow, colors.shadow.color);
  assign(materials.teeth, colors.teeth);
  assign(materials.nose, colors.skin.dark);
  assign(materials.mouthOpening, colors.shadow.color, 0.85);

  const crease = parseCssColor(colors.shadow.color);
  materials.crease.color.copy(crease.color);
  materials.crease.opacity = Math.min(1, crease.opacity + 0.35);
  materials.crease.transparent = true;

  const stroke = parseCssColor(colors.stroke);
  materials.stroke.color.copy(stroke.color);
  materials.stroke.opacity = stroke.opacity;
  materials.stroke.transparent = stroke.opacity < 1;

  materials.iris.emissive.copy(parseCssColor(colors.eyes.iris).color);
  materials.iris.emissiveIntensity = 0.12;
  materials.highlight.emissive.copy(parseCssColor(colors.highlight).color);
  materials.highlight.emissiveIntensity = 0.2;
}

function assign(
  material: MeshStandardMaterial,
  css: string,
  opacityOverride?: number,
): void {
  const parsed = parseCssColor(css);
  material.color.copy(parsed.color);
  const opacity = opacityOverride ?? parsed.opacity;
  material.opacity = opacity;
  material.transparent = opacity < 1;
}

export function disposeThemeMaterials(materials: CharacterMaterials): void {
  for (const material of Object.values(materials)) {
    material.dispose();
  }
}
