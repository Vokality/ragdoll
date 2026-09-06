import {
  BufferGeometry,
  CatmullRomCurve3,
  Color,
  Float32BufferAttribute,
  Vector3,
  SphereGeometry,
} from "three";
import type { RenderData } from "../../components/render-data";
export interface GroomSurface {
  scalp(normal: Vector3): Vector3;
  front(x: number, y: number): Vector3;
}

/** Deterministic tapered locks, rooted inside the same continuous head surface. */
export function createGroomGeometry(
  data: RenderData,
  surface: GroomSurface,
): BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let seed = 92821;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const light = new Color(data.currentTheme.colors.hair.light);
  const dark = new Color(data.currentTheme.colors.hair.dark);
  const addLock = (points: Vector3[], radius: number) => {
    const curve = new CatmullRomCurve3(points);
    const steps = 10;
    const sides = 5;
    const frames = curve.computeFrenetFrames(steps, false);
    const offset = positions.length / 3;
    const color = dark.clone().lerp(light, 0.4 + random() * 0.6);
    for (let ring = 0; ring <= steps; ring++) {
      const t = ring / steps;
      const center = curve.getPointAt(t);
      const width =
        ring === 0 || ring === steps
          ? 0
          : radius * Math.sin(Math.PI * t) ** 0.55;
      for (let side = 0; side < sides; side++) {
        const angle = (side / sides) * Math.PI * 2;
        const point = center
          .clone()
          .addScaledVector(frames.normals[ring], Math.cos(angle) * width)
          .addScaledVector(frames.binormals[ring], Math.sin(angle) * width);
        positions.push(point.x, point.y, point.z);
        colors.push(color.r, color.g, color.b);
        if (ring < steps) {
          const a = offset + ring * sides + side;
          const b = offset + ring * sides + ((side + 1) % sides);
          indices.push(a, b, a + sides, b, b + sides, a + sides);
        }
      }
    }
  };
  const { dims, appearance } = data;
  const wild = appearance.hairStyle === "wild";
  if (appearance.hairStyle === "wild") {
    const count = wild ? 3000 : 2300;
    for (let i = 0; i < count; i++) {
      const ny = random() * 1.18 - 0.18;
      const phi = random() * Math.PI * 2;
      const r = Math.sqrt(1 - ny * ny);
      const normal = new Vector3(r * Math.cos(phi), ny, r * Math.sin(phi));
      if (normal.z > 0) {
        const hairline = wild
          ? 0.84 - 0.5 * Math.abs(normal.x) + normal.x * 0.08
          : 0.73 - 0.32 * Math.abs(normal.x);
        if (ny < hairline) continue;
      }
      const root = surface.scalp(normal);
      const length = 16 + random() * 22;
      const side = normal.x >= 0 ? 1 : -1;
      const top = ny > 0.82;
      const rear = normal.z < -0.4;
      const sweep = new Vector3(
        wild
          ? top
            ? -0.65
            : rear
              ? (random() - 0.5) * 0.6
              : side * 0.7
          : -0.8,
        wild ? (top ? 0.2 : -0.5) + (random() - 0.5) * 0.5 : -0.15,
        -0.3 + (random() - 0.5) * 0.45,
      );
      const curl = new Vector3(
        (random() - 0.5) * 12,
        (random() - 0.5) * 16,
        (random() - 0.5) * 10,
      );
      const lift = wild ? 4 + random() * 6 : 2;
      addLock(
        [
          root.clone().addScaledVector(normal, -2.5),
          root
            .clone()
            .addScaledVector(normal, lift)
            .addScaledVector(sweep, length * 0.25),
          root
            .clone()
            .addScaledVector(normal, lift + 3)
            .addScaledVector(sweep, length * 0.65)
            .addScaledVector(curl, 0.5),
          root
            .clone()
            .addScaledVector(normal, lift)
            .addScaledVector(sweep, length)
            .add(curl),
        ],
        wild ? 0.38 + random() * 0.62 : 0.65 + random() * 0.65,
      );
    }
  }
  if (appearance.mustacheStyle !== "none") {
    const bushy = appearance.mustacheStyle === "bushy";
    for (let i = 0; i < (bushy ? 360 : 180); i++) {
      const x = (random() - 0.5) * dims.mouthWidth * 1.35;
      const y = -(dims.mouthY - 11) + random() * (bushy ? 7 : 2);
      const root = surface.front(x, y);
      const side = x < 0 ? -1 : 1;
      const length = bushy ? 7 + random() * 6 : 4;
      const curl =
        appearance.mustacheStyle === "handlebar" ? Math.abs(x) * 0.25 : -length;
      addLock(
        [
          root.clone().add(new Vector3(0, 0, -1.5)),
          root.clone().add(new Vector3(side * 1, -2, 3.5)),
          root.clone().add(new Vector3(side * 3, -length * 0.65, 4)),
          root.clone().add(new Vector3(side * 5, curl, 1)),
        ],
        bushy ? 0.38 + random() * 0.35 : 0.3,
      );
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Fitted, closed hair mass for groomed styles, with a softly swept crown. */
export function createHairCapGeometry(
  data: RenderData,
  surface: GroomSurface,
): BufferGeometry {
  const { appearance } = data;
  if (appearance.hairStyle === "bald" || appearance.hairStyle === "wild")
    return new BufferGeometry();
  const geometry = new SphereGeometry(1, 128, 80);
  const positions = geometry.getAttribute("position");
  const colors: number[] = [];
  const mid = new Color(data.currentTheme.colors.hair.mid);
  const light = new Color(data.currentTheme.colors.hair.light);
  for (let i = 0; i < positions.count; i++) {
    const nx = positions.getX(i),
      ny = positions.getY(i),
      nz = positions.getZ(i);
    const phi = Math.atan2(nz, nx);
    const front = Math.max(0, nz);
    const hairline =
      0.24 * Math.abs(nx) + 1.1 * front - 0.25 * Math.max(0, -nz);
    const t = Math.max(0, Math.min(1, (ny - hairline) / 0.16));
    const coverage = t * t * (3 - 2 * t);
    const quiff =
      appearance.hairStyle === "short"
        ? 2
        : 4 + 5 * Math.max(0, ny) * Math.max(0, -nx + 0.3);
    const lift = -7 + (7 + quiff) * coverage;
    const root =
      coverage > 0
        ? surface.scalp(new Vector3(nx, ny, nz))
        : new Vector3(nx * 25, ny * 25, nz * 25 - 25);
    const grooves = 0.06 * Math.sin(phi * 20 + ny * 8) * coverage;
    root.addScaledVector(new Vector3(nx, ny, nz), lift + grooves);
    positions.setXYZ(i, root.x, root.y, root.z);
    const color = mid
      .clone()
      .lerp(light, 0.1 + 0.1 * Math.sin(phi * 32 + ny * 12) ** 2);
    colors.push(color.r, color.g, color.b);
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
