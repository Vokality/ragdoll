import { describe, expect, test } from "bun:test";
import { Mesh, Raycaster, Vector3 } from "three";
import { AnatomicalHead } from "../../src/renderers/three/anatomical-head";
import { CharacterController } from "../../src/controllers/character-controller";
import { computeRenderData } from "../../src/components/render-data";

describe("anatomical head", () => {
  test("indexed scalp intersections match triangle intersections", () => {
    const controller = new CharacterController({
      variantId: "human",
      themeId: "default",
      onEventSubscriberError: console.error,
    });
    const head = new AnatomicalHead();
    try {
      head.update(computeRenderData(controller));
      const center = new Vector3(0, 0, -25);
      for (const direction of [
        new Vector3(0, 1, 0),
        new Vector3(0, 0, -1),
        new Vector3(1, 1, 0).normalize(),
      ]) {
        const ray = new Raycaster(
          center.clone().addScaledVector(direction, 300),
          direction.clone().negate(),
        );
        const expected = ray.intersectObject(head.skin)[0];
        expect(expected).toBeDefined();
        expect(head.surface(direction).distanceTo(expected.point)).toBeLessThan(
          0.001,
        );
      }
    } finally {
      head.dispose();
      controller.destroy();
    }
  });
  test("instances own their morph attributes and blinking does not rebuild geometry", () => {
    const controller = new CharacterController({
      variantId: "human",
      themeId: "default",
      onEventSubscriberError: console.error,
    });
    const first = new AnatomicalHead(),
      second = new AnatomicalHead();
    try {
      const data = computeRenderData(controller);
      first.update(data);
      second.update(data);
      const normal = first.skin.geometry.morphAttributes.normal;
      expect(normal?.length).toBe(52);
      expect(normal?.[0]).not.toBe(
        second.skin.geometry.morphAttributes.normal?.[0],
      );
      const geometry = first.skin.geometry;
      data.expression.leftEye.openness = 0;
      data.expression.rightEye.openness = 1;
      first.update(data);
      expect(first.skin.geometry).toBe(geometry);
      const dictionary = first.skin.morphTargetDictionary;
      if (!dictionary) throw new Error("Missing morph dictionary");
      expect(first.skin.morphTargetInfluences?.[dictionary.eyeBlink_L]).toBe(1);
      expect(first.skin.morphTargetInfluences?.[dictionary.eyeBlink_R]).toBe(0);
      expect(second.skin.morphTargetInfluences?.[dictionary.eyeBlink_L]).toBe(
        0,
      );
      first.dispose();
      second.update(data);
      expect(
        second.skin.geometry.getAttribute("position").count,
      ).toBeGreaterThan(1000);
    } finally {
      second.dispose();
      controller.destroy();
    }
  });

  test("settled smile, gaze, and jaw lock adapter morphs and eyeball rotation", () => {
    const controller = new CharacterController({
      variantId: "human",
      themeId: "default",
      onEventSubscriberError: console.error,
    });
    const head = new AnatomicalHead();
    try {
      controller.setIdleEnabled(false);
      controller.setExpression({ smile: 0.5, gazeX: 1, jaw: 1 }, 0);
      controller.update(0);
      const data = computeRenderData(controller);
      expect(data.expression.leftEye.pupilOffset.x).toBeCloseTo(4);
      expect(data.expression.rightEye.pupilOffset.x).toBeCloseTo(4);
      head.update(data);
      const dictionary = head.skin.morphTargetDictionary;
      const influences = head.skin.morphTargetInfluences;
      if (!dictionary || !influences) {
        throw new Error("Missing morph dictionary");
      }
      expect(influences[dictionary.mouthSmile_L]).toBeCloseTo(0.5);
      expect(influences[dictionary.jawOpen]).toBeCloseTo(1);
      const pupilOffset = data.expression.leftEye.pupilOffset;
      const gazing = head.root.children.filter(
        (child): child is Mesh =>
          child instanceof Mesh &&
          child !== head.skin &&
          child.rotation.y === pupilOffset.x * 0.035,
      );
      expect(gazing.length).toBeGreaterThan(0);
      for (const mesh of gazing) {
        expect(mesh.rotation.y).toBe(pupilOffset.x * 0.035);
        expect(mesh.rotation.x).toBe(pupilOffset.y * 0.035);
      }
    } finally {
      head.dispose();
      controller.destroy();
    }
  });
});
