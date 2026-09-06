import { describe, expect, it } from "bun:test";
import { BoxGeometry, ExtrudeGeometry, Shape } from "three";
import {
  headBulgeParams,
  liftToHeadSurface,
  roundExtrudedOutline,
  subdivideFaces,
  surfaceOffsetZ,
} from "../../src/renderers/three/bulge-geometry";

describe("head bulge", () => {
  it("peaks at the center and falls off at the rim", () => {
    expect(surfaceOffsetZ(0, 0, 70, 85, 40)).toBeCloseTo(40);
    expect(surfaceOffsetZ(70, 0, 70, 85, 40)).toBe(0);
    expect(surfaceOffsetZ(0, 85, 70, 85, 40)).toBe(0);
    expect(surfaceOffsetZ(35, 0, 70, 85, 40)).toBeCloseTo(Math.sqrt(0.75) * 40);
  });

  it("subdivides a rim-only cap until interior vertices exist", () => {
    const shape = new Shape();
    shape.absarc(0, 0, 50, 0, Math.PI * 2, false);
    const geometry = new ExtrudeGeometry(shape, {
      depth: 10,
      bevelEnabled: false,
      curveSegments: 16,
    });
    const subdivided = subdivideFaces(geometry, 16);
    const positions = subdivided.getAttribute("position");
    let nearest = Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      nearest = Math.min(
        nearest,
        Math.hypot(positions.getX(i), positions.getY(i)),
      );
    }
    expect(nearest).toBeLessThan(8);
    geometry.dispose();
    subdivided.dispose();
  });

  it("pushes the front of an extruded disc farther forward in the center", () => {
    const shape = new Shape();
    shape.absarc(0, 0, 50, 0, Math.PI * 2, false);
    const extruded = new ExtrudeGeometry(shape, {
      depth: 10,
      bevelEnabled: false,
      curveSegments: 16,
    });
    extruded.translate(0, 0, -5);
    const geometry = roundExtrudedOutline(extruded, 50, 50, 30, 16);
    extruded.dispose();

    const positions = geometry.getAttribute("position");
    let centerZ = -Infinity;
    let rimZ = Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      const x = positions.getX(i);
      const y = positions.getY(i);
      const z = positions.getZ(i);
      const r = Math.hypot(x, y);
      if (r < 8 && z > centerZ) centerZ = z;
      if (r > 42 && z < rimZ) rimZ = z;
    }
    expect(centerZ).toBeGreaterThan(rimZ + 12);
    geometry.dispose();
  });

  it("shades the rounded disc with a smooth outward normal at the center", () => {
    const shape = new Shape();
    shape.absarc(0, 0, 50, 0, Math.PI * 2, false);
    const extruded = new ExtrudeGeometry(shape, {
      depth: 10,
      bevelEnabled: false,
      curveSegments: 16,
    });
    extruded.translate(0, 0, -5);
    const geometry = roundExtrudedOutline(extruded, 50, 50, 30, 12);
    extruded.dispose();
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    let nz = 0;
    let bestZ = -Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      if (Math.hypot(positions.getX(i), positions.getY(i)) >= 6) continue;
      const z = positions.getZ(i);
      if (z > bestZ) {
        bestZ = z;
        nz = normals.getZ(i);
      }
    }
    expect(nz).toBeGreaterThan(0.85);
    geometry.dispose();
  });

  it("scales the head ellipsoid from face dimensions", () => {
    const bulge = headBulgeParams(140, 170);
    expect(bulge.radiusX).toBeCloseTo(78.4);
    expect(bulge.radiusY).toBeCloseTo(98.6);
    expect(bulge.amount).toBeCloseTo(77);
    expect(surfaceOffsetZ(0, 0, bulge.radiusX, bulge.radiusY, bulge.amount)).toBeCloseTo(
      bulge.amount,
    );
  });

  it("lifts a feature by the ellipsoid height at its centroid", () => {
    const geometry = new BoxGeometry(10, 10, 4);
    geometry.translate(0, 30, 0);
    liftToHeadSurface(geometry, 80, 100, 50, 8);
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const centerZ = (box.min.z + box.max.z) / 2;
    const expected = surfaceOffsetZ(0, 30, 80, 100, 50) + 8;
    expect(centerZ).toBeCloseTo(expected, 4);
  });
});
