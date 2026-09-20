import { describe, expect, test } from "bun:test";
import { Mesh, type MeshStandardMaterial, Raycaster, Vector3 } from "three";
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
      expect(data.expression.leftEye.pupilOffset.x).toBeCloseTo(-4);
      expect(data.expression.rightEye.pupilOffset.x).toBeCloseTo(-4);
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
  test("pupil dilation reuses eye textures and a theme change keeps the skin relief", () => {
    const controller = new CharacterController({
      variantId: "human",
      themeId: "default",
      onEventSubscriberError: console.error,
    });
    const head = new AnatomicalHead();
    const eyeMaps = () =>
      head.root.children
        .filter((child): child is Mesh => child instanceof Mesh)
        .map((mesh) => (mesh.material as MeshStandardMaterial).map)
        .filter((map) => map !== null);
    try {
      head.update(computeRenderData(controller));
      const [left, right] = eyeMaps();
      expect(left).toBeDefined();
      expect(left).toBe(right);
      const relief = head.skin.material.bumpMap;
      expect(relief).not.toBeNull();

      // A full neutral -> surprise -> neutral round trip at 60fps.
      const painted = new Set([left]);
      controller.setMood("surprise");
      for (let i = 0; i < 40; i++) {
        controller.update(1 / 60);
        head.update(computeRenderData(controller));
        for (const map of eyeMaps()) painted.add(map);
      }
      const dilated = eyeMaps()[0];
      expect(dilated).not.toBe(left);
      controller.setMood("neutral");
      for (let i = 0; i < 40; i++) {
        controller.update(1 / 60);
        head.update(computeRenderData(controller));
        for (const map of eyeMaps()) painted.add(map);
      }
      // pupilSize spans 1 -> 1.3: at most seven 0.05 steps, not one per frame.
      expect(painted.size).toBeLessThanOrEqual(7);
      expect(eyeMaps()[0]).toBe(left);

      controller.setTheme("robot");
      head.update(computeRenderData(controller));
      expect(head.skin.material.bumpMap).toBe(relief);
      expect(eyeMaps()[0]).not.toBe(left);
    } finally {
      head.dispose();
      controller.destroy();
    }
  });
  test("thinking pushes a pressed mouth to one side and cocks one brow over the other", () => {
    const controller = new CharacterController({
      variantId: "human",
      themeId: "default",
      onEventSubscriberError: console.error,
    });
    const head = new AnatomicalHead();
    try {
      controller.setIdleEnabled(false);
      controller.setMood("thinking", 0);
      controller.update(0.05);
      head.update(computeRenderData(controller));
      const dictionary = head.skin.morphTargetDictionary;
      const influences = head.skin.morphTargetInfluences;
      if (!dictionary || !influences) {
        throw new Error("Missing morph dictionary");
      }
      expect(influences[dictionary.mouthLeft]).toBeCloseTo(0.5);
      expect(influences[dictionary.mouthRight]).toBe(0);
      expect(influences[dictionary.mouthPress_L]).toBeCloseTo(0.5);
      expect(influences[dictionary.browOuterUp_L]).toBeGreaterThan(0.7);
      expect(influences[dictionary.browDown_R]).toBeGreaterThan(0.5);
      expect(influences[dictionary.eyeBlink_L]).toBe(0);
    } finally {
      head.dispose();
      controller.destroy();
    }
  });
});
