import { describe, expect, it } from "bun:test";
import { RagdollGeometry } from "../../src/models/ragdoll-geometry";
import { einsteinVariant, humanVariant } from "../../src/variants";
import { parseSvgPath, svgPathToShape } from "../../src/renderers/three/svg-path-shape";

function expectShape(path: string): NonNullable<ReturnType<typeof svgPathToShape>> {
  const shape = svgPathToShape(path);
  expect(shape).not.toBeNull();
  if (!shape) throw new Error("expected a shape");
  expect(shape.curves.length).toBeGreaterThan(0);
  for (const point of shape.getPoints(12)) {
    expect(Number.isFinite(point.x)).toBe(true);
    expect(Number.isFinite(point.y)).toBe(true);
  }
  return shape;
}

describe("svg path to Three.js shape", () => {
  it("parses absolute and relative commands", () => {
    const commands = parseSvgPath("M 10 20 l 5 -3 H 30 v 4 C 31 22 33 24 35 25 Z");
    expect(commands.map((command) => command.type)).toEqual([
      "M",
      "l",
      "H",
      "v",
      "C",
      "Z",
    ]);
    expect(commands[0]?.values).toEqual([10, 20]);
  });

  it("converts a closed relative path into y-up coordinates", () => {
    const shape = expectShape("M 0 -10 l 10 0 l 0 10 l -10 0 Z");
    const points = shape.getPoints(4);
    const ys = points.map((point) => point.y);
    expect(Math.max(...ys)).toBeGreaterThan(0);
    expect(Math.min(...ys)).toBeLessThanOrEqual(0);
  });

  it("returns null for an empty path", () => {
    expect(svgPathToShape("")).toBeNull();
    expect(svgPathToShape("   ")).toBeNull();
  });

  it("extrudes real character outline paths, including unclosed nose and ear", () => {
    const human = new RagdollGeometry(humanVariant);
    const einstein = new RagdollGeometry(einsteinVariant);
    const expression = human.getExpressionForMood("neutral");

    expectShape(human.getFacePath());
    expectShape(human.getEyePath(true, expression.leftEye).sclera);
    expectShape(human.getEyebrowPath(true, expression.leftEyebrow));
    expectShape(human.getMouthPath(expression.mouth).upperLip);
    expectShape(human.getMouthPath(expression.mouth).lowerLip);
    expectShape(human.getHairPath());
    expectShape(human.getNosePath(0));
    expectShape(human.getEarPath(true));
    expectShape(einstein.getHairPath());
    expectShape(einstein.getMustachePath());

    expect(svgPathToShape(human.getMustachePath())).toBeNull();

    const face = expectShape(human.getFacePath());
    const top = Math.max(...face.getPoints(24).map((point) => point.y));
    expect(top).toBeGreaterThan(human.dimensions.headHeight / 2 - 2);
  });

  it("closes unclosed outlines unless close is disabled", () => {
    const human = new RagdollGeometry(humanVariant);
    const nose = human.getNosePath(0.2);
    expect(parseSvgPath(nose).some((command) => command.type === "Z")).toBe(false);
    expect(svgPathToShape(nose)?.curves.length).toBeGreaterThan(0);
    expect(svgPathToShape(nose, { close: false })?.curves.length).toBeGreaterThan(0);
  });

  it("handles smooth cubic shorthand after C", () => {
    const shape = expectShape("M 0 0 C 0 10 10 10 10 0 S 20 -10 20 0 Z");
    expect(shape.curves.length).toBeGreaterThan(1);
  });
});
