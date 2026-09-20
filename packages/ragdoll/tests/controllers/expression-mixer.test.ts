import { describe, expect, it, beforeEach } from "bun:test";
import { ExpressionController } from "../../src/controllers/expression-controller";
import { ActionController } from "../../src/controllers/action-controller";
import { CharacterController } from "../../src/controllers/character-controller";
import { RagdollGeometry } from "../../src/models/ragdoll-geometry";
import {
  cloneExpression,
  FACE_AXES_CLEARED_ON_SET_MOOD,
  GAZE_OFFSET_X,
} from "../../src/models/expression-axes";
import { computeRenderData } from "../../src/components/render-data";
import { MockHeadPoseController } from "../../src/testing/mocks";
import { getDefaultVariant } from "../../src/variants";
import type { FaceAxis } from "../../src/types";

function createMixer() {
  const geometry = new RagdollGeometry(getDefaultVariant());
  const actionController = new ActionController(new MockHeadPoseController());
  const controller = new ExpressionController(geometry, actionController);
  return { geometry, actionController, controller };
}

function createCharacter() {
  return new CharacterController({
    themeId: "default",
    variantId: "human",
    onEventSubscriberError: () => undefined,
  });
}

function settle(controller: { update(deltaTime: number): void }): void {
  controller.update(1);
}

function ownedFaceKeys(
  overlay: Readonly<Partial<Record<FaceAxis, number>>>,
): FaceAxis[] {
  return FACE_AXES_CLEARED_ON_SET_MOOD.filter(
    (key) => overlay[key] !== undefined,
  );
}

function jawOpen(mouth: {
  lowerLipTop: number;
  upperLipBottom: number;
}): number {
  return Math.max(0, mouth.lowerLipTop - mouth.upperLipBottom - 2) / 26;
}

describe("expression mixer", () => {
  let geometry: RagdollGeometry;
  let actionController: ActionController;
  let controller: ExpressionController;

  beforeEach(() => {
    ({ geometry, actionController, controller } = createMixer());
  });

  it("applies a smile patch on top of a named mood without changing the mood", () => {
    controller.setMood("smile");
    settle(controller);
    controller.setExpression({ smile: 0.3 });
    settle(controller);

    expect(controller.getCurrentMood()).toBe("smile");
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(0.3);
    expect(controller.getExpression().mouth.cornerPull).toBeCloseTo(
      geometry.getExpressionForMood("smile").mouth.cornerPull,
    );
    expect(controller.getAxisOverlay()).toEqual({ smile: 0.3 });
  });

  it("clears a face patch when setMood follows setExpression", () => {
    controller.setExpression({ smile: 0.9 }, 0);
    controller.setMood("sad");
    settle(controller);

    expect(controller.getCurrentMood()).toBe("sad");
    expect(controller.getAxisOverlay().smile).toBeUndefined();
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(
      geometry.getExpressionForMood("sad").mouth.cornerPull,
    );
  });

  it("bakes the mixed face into the mood start before the next update", () => {
    controller.setMood("smile");
    settle(controller);
    controller.setExpression({ smile: 0.3 }, 0);
    const patchedPull = controller.getMixedExpression().mouth.cornerPull;
    const smilePupils = {
      left: { ...controller.getExpression().leftEye.pupilOffset },
      right: { ...controller.getExpression().rightEye.pupilOffset },
    };

    controller.setMood("sad");

    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(
      patchedPull,
    );
    expect(ownedFaceKeys(controller.getAxisOverlay())).toEqual([]);
    expect(controller.getExpression().mouth.cornerPull).toBeCloseTo(
      patchedPull,
    );
    expect(controller.getExpression().leftEye.pupilOffset).toEqual(
      smilePupils.left,
    );
    expect(controller.getExpression().rightEye.pupilOffset).toEqual(
      smilePupils.right,
    );

    settle(controller);
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(
      geometry.getExpressionForMood("sad").mouth.cornerPull,
    );
  });

  it("treats host thinking as a mixer writer that keeps gaze", () => {
    controller.setExpression({ smile: 0.3, gazeX: 0.8 }, 0);
    controller.setMood("thinking");
    settle(controller);

    expect(ownedFaceKeys(controller.getAxisOverlay())).toEqual([]);
    expect(controller.getAxisOverlay().gazeX).toBe(0.8);
    expect(controller.getCurrentMood()).toBe("thinking");
  });

  it("documents last-writer-wins for executeCommand order", () => {
    const expressionThenMood = createCharacter();
    expressionThenMood.executeCommand({
      action: "setExpression",
      params: { smile: 0.9, duration: 0 },
    });
    expressionThenMood.executeCommand({
      action: "setMood",
      params: { mood: "sad", duration: 0.05 },
    });
    settle(expressionThenMood);
    expect(expressionThenMood.getState().mood).toBe("sad");
    expect(expressionThenMood.getAxisOverlay().smile).toBeUndefined();
    expect(
      expressionThenMood.getMixedExpression().mouth.cornerPull,
    ).toBeCloseTo(geometry.getExpressionForMood("sad").mouth.cornerPull);
    expressionThenMood.destroy();

    const moodThenExpression = createCharacter();
    moodThenExpression.executeCommand({
      action: "setMood",
      params: { mood: "sad", duration: 0.05 },
    });
    moodThenExpression.executeCommand({
      action: "setExpression",
      params: { smile: 0.9, duration: 0 },
    });
    settle(moodThenExpression);
    expect(moodThenExpression.getState().mood).toBe("sad");
    expect(moodThenExpression.getAxisOverlay()).toEqual({ smile: 0.9 });
    expect(
      moodThenExpression.getMixedExpression().mouth.cornerPull,
    ).toBeCloseTo(0.9);
    moodThenExpression.destroy();
  });

  it("clears a leftover face patch on the same named mood", () => {
    controller.setMood("smile");
    settle(controller);
    controller.setExpression({ smile: 0.2 }, 0);
    controller.setMood("smile");
    settle(controller);

    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(
      geometry.getExpressionForMood("smile").mouth.cornerPull,
    );
    expect(ownedFaceKeys(controller.getAxisOverlay())).toEqual([]);
  });

  it("does not retrigger when the same mood is already clean", () => {
    controller.setMood("smile");
    const initial = controller.getExpression();
    controller.setMood("smile");
    expect(controller.getExpression()).toEqual(initial);
  });

  it("composites wink on a smile patch without changing mood or overlay", () => {
    controller.setMood("smile");
    settle(controller);
    controller.setExpression({ smile: 0.5 }, 0);
    actionController.triggerAction("wink");
    actionController.update(0.1);

    const withAction = controller.getExpressionWithAction();
    expect(withAction.rightEye.openness).toBeLessThan(
      withAction.leftEye.openness,
    );
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(0.5);
    expect(controller.getCurrentMood()).toBe("smile");
    expect(controller.getAxisOverlay()).toEqual({ smile: 0.5 });
  });

  it("preserves gaze overlay across setMood", () => {
    controller.setExpression({ gazeX: 0.8, gazeY: 0.4 }, 0);
    controller.setMood("sad");
    settle(controller);

    expect(controller.getAxisOverlay()).toEqual({ gazeX: 0.8, gazeY: 0.4 });
    expect(controller.getMixedExpression().leftEye.pupilOffset.x).toBeCloseTo(
      0.8 * GAZE_OFFSET_X,
    );
    expect(controller.getMixedExpression().leftEye.pupilOffset.x).not.toBe(
      geometry.getExpressionForMood("sad").leftEye.pupilOffset.x,
    );
  });

  it("keeps sticky gaze instead of restoring a thinking bake", () => {
    controller.setExpression({ gazeX: 0.8 }, 0);
    controller.setExpression({ gazeY: 0 }, 0);
    controller.setMood("thinking");
    settle(controller);

    expect(controller.getAxisOverlay()).toEqual({ gazeX: 0.8, gazeY: 0 });
    expect(controller.getMixedExpression().leftEye.pupilOffset.x).toBeCloseTo(
      0.8 * GAZE_OFFSET_X,
    );
    expect(
      controller.getMixedExpression().leftEye.pupilOffset.x,
    ).not.toBeCloseTo(controller.getExpression().leftEye.pupilOffset.x);
  });

  it("leaves omitted overlay keys unchanged", () => {
    controller.setExpression({ smile: 0.5 }, 0);
    controller.setExpression({ brows: 1 }, 0);
    expect(controller.getAxisOverlay()).toEqual({ smile: 0.5, brows: 1 });
  });

  it("treats explicit 0 as owned none, not the mood preset", () => {
    controller.setMood("smile");
    settle(controller);
    controller.setExpression({ smile: 0 }, 0);
    settle(controller);
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(0);
  });

  it("eases smile to 0 instead of snapping on the first overlay frame", () => {
    controller.setMood("smile");
    settle(controller);
    const startPull = controller.getMixedExpression().mouth.cornerPull;
    controller.setExpression({ smile: 0, duration: 0.35 });
    controller.update(0.1);
    const mixedPull = controller.getMixedExpression().mouth.cornerPull;
    expect(mixedPull).toBeLessThan(startPull);
    expect(mixedPull).toBeGreaterThan(0);
  });

  it("eases smile to frown monotonically without snapping to 0", () => {
    controller.setMood("smile");
    settle(controller);
    const samples = [controller.getMixedExpression().mouth.cornerPull];
    controller.setExpression({ frown: 1, duration: 0.35 });
    samples.push(controller.getMixedExpression().mouth.cornerPull);
    for (let i = 0; i < 4; i++) {
      controller.update(0.05);
      samples.push(controller.getMixedExpression().mouth.cornerPull);
    }
    for (let i = 1; i < samples.length; i++) {
      expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1e-9);
    }
    expect(samples[1]).toBeCloseTo(samples[0]);
    expect(samples[2]).not.toBeCloseTo(0, 1);
    expect(samples[2]).toBeGreaterThan(0);
  });

  it("eases thinking gazeX toward 0", () => {
    controller.setMood("thinking");
    settle(controller);
    const baked = controller.getExpression().leftEye.pupilOffset.x;
    expect(baked).toBeGreaterThan(0);
    expect(controller.getMixedExpression().leftEye.pupilOffset.x).toBeCloseTo(
      baked,
    );
    controller.setExpression({ gazeX: 0, duration: 0.35 });
    controller.update(0.1);
    const x = controller.getMixedExpression().leftEye.pupilOffset.x;
    expect(x).toBeLessThan(baked);
    expect(x).toBeGreaterThan(0);
  });

  it("no-ops an empty patch", () => {
    controller.setExpression({ smile: 0.4 }, 0);
    const overlay = controller.getAxisOverlay();
    expect(() => controller.setExpression({})).not.toThrow();
    expect(controller.getAxisOverlay()).toEqual(overlay);
  });

  it("snaps when duration is 0", () => {
    controller.setExpression({ smile: 1 }, 0);
    controller.update(0);
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(1);
  });

  it("clamps out-of-range finite axis values", () => {
    controller.setExpression({ smile: 2, brows: -4 });
    expect(controller.getAxisOverlay()).toEqual({ smile: 1, brows: -1 });
  });

  it("throws on non-finite axis values", () => {
    expect(() => controller.setExpression({ smile: Number.NaN })).toThrow(
      "smile must be a finite number",
    );
    expect(() =>
      controller.setExpression({ gazeX: Number.POSITIVE_INFINITY }),
    ).toThrow("gazeX must be a finite number");
  });

  it("does not mutate the mood expression when applying an overlay", () => {
    controller.setMood("smile");
    settle(controller);
    const captured = cloneExpression(controller.getExpression());
    const moodRef = controller.getExpression();
    controller.setExpression({ jaw: 1, smile: 0.5 }, 0);
    expect(controller.getExpression()).toBe(moodRef);
    expect(controller.getExpression()).toEqual(captured);
  });

  it("keeps jaw geometry valid when settled", () => {
    for (const mood of ["neutral", "laugh"] as const) {
      controller.setMood(mood);
      settle(controller);
      controller.setExpression({ jaw: 1 }, 0);
      const mixed = controller.getMixedExpression();
      expect(() => geometry.getMouthPath(mixed.mouth)).not.toThrow();
      expect(jawOpen(mixed.mouth)).toBeGreaterThan(0.9);
    }
  });

  it("keeps jaw geometry valid during an overlay transition", () => {
    controller.setMood("laugh");
    settle(controller);
    controller.setExpression({ jaw: 1, duration: 0.35 });
    controller.update(0.1);
    expect(() =>
      geometry.getMouthPath(controller.getMixedExpression().mouth),
    ).not.toThrow();
  });

  it("keeps talk plus jaw valid through getMouthPath and computeRenderData", () => {
    const character = createCharacter();
    try {
      character.setMood("laugh");
      settle(character);
      character.setExpression({ jaw: 1 }, 0);
      character.triggerAction("talk");
      character.update(0.2);
      const withAction = character.getExpressionWithAction();
      expect(() =>
        character.getGeometry().getMouthPath(withAction.mouth),
      ).not.toThrow();
      expect(() => computeRenderData(character)).not.toThrow();
      expect(character.getExpression().mouth.lowerLipTop).toBe(
        character.getGeometry().getExpressionForMood("laugh").mouth.lowerLipTop,
      );
    } finally {
      character.destroy();
    }
  });

  it("moves gaze independently of head pose", () => {
    const character = createCharacter();
    try {
      character.setHeadPose({ yaw: 0.3 });
      character.setExpression({ gazeX: 1 }, 0);
      character.update(0.1);
      expect(character.getState().headPose.yaw).not.toBe(0);
      expect(character.getMixedExpression().leftEye.pupilOffset.x).toBeCloseTo(
        GAZE_OFFSET_X,
      );
    } finally {
      character.destroy();
    }
  });

  it("strips duration from executeCommand setExpression params", () => {
    const character = createCharacter();
    try {
      character.executeCommand({
        action: "setExpression",
        params: { smile: 0.5, duration: 0.2 },
      });
      expect(character.getAxisOverlay()).toEqual({ smile: 0.5 });
      expect(character.getAxisOverlay()).not.toHaveProperty("duration");
    } finally {
      character.destroy();
    }
  });

  it("resetExpression hands gaze back to the mood's baked glance", () => {
    controller.setMood("thinking");
    controller.setExpression({ gazeX: 0.8, smile: 0.4 }, 0);
    settle(controller);

    controller.resetExpression(["gazeX"], 0);

    expect(controller.getAxisOverlay()).toEqual({ smile: 0.4 });
    expect(controller.getMixedExpression().leftEye.pupilOffset.x).toBeCloseTo(
      controller.getExpression().leftEye.pupilOffset.x,
    );
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(0.4);
  });

  it("resetExpression without axes releases every owned axis and eases back", () => {
    controller.setMood("smile");
    settle(controller);
    controller.setExpression({ smile: 0, gazeY: 1 }, 0);

    controller.resetExpression(undefined, 0.4);

    expect(controller.getAxisOverlay()).toEqual({});
    // Eases from the patched face instead of snapping to the mood.
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(0);
    controller.update(0.2);
    const midway = controller.getMixedExpression().mouth.cornerPull;
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(0.8);
    settle(controller);
    expect(controller.getMixedExpression().mouth.cornerPull).toBeCloseTo(0.8);
  });

  it("resetExpression ignores axes that are not owned and rejects a bad duration", () => {
    controller.setExpression({ smile: 0.5 }, 0);
    controller.resetExpression(["jaw"], 0);
    expect(controller.getAxisOverlay()).toEqual({ smile: 0.5 });
    expect(() => controller.resetExpression(["smile"], NaN)).toThrow("finite");
    expect(controller.getAxisOverlay()).toEqual({ smile: 0.5 });
  });

  it("routes resetExpression through executeCommand", () => {
    const character = createCharacter();
    try {
      character.setExpression({ smile: 0.5, gazeX: 1 }, 0);
      character.executeCommand({
        action: "resetExpression",
        params: { axes: ["smile"], duration: 0 },
      });
      expect(character.getAxisOverlay()).toEqual({ gazeX: 1 });
    } finally {
      character.destroy();
    }
  });

  describe("moods that move through poses", () => {
    const step = (seconds: number) => {
      for (let t = 0; t < seconds; t += 0.05) controller.update(0.05);
    };
    const gazeX = () => controller.getMixedExpression().leftEye.pupilOffset.x;

    it("walks thinking through its poses and loops back to the first", () => {
      const poses = geometry.getMoodSequence("thinking");
      if (!poses) throw new Error("thinking should define poses");
      expect(poses.length).toBeGreaterThan(2);
      expect(geometry.getExpressionForMood("thinking")).toEqual(
        poses[0].expression,
      );

      controller.setMood("thinking", 0);
      controller.update(0.05);
      const seen = [gazeX()];
      for (const pose of poses) {
        step(pose.hold + 0.7);
        seen.push(gazeX());
      }

      expect(seen.slice(0, -1)).toEqual(
        poses.map((pose) => pose.expression.leftEye.pupilOffset.x),
      );
      expect(seen.at(-1)).toBeCloseTo(seen[0]);
      expect(controller.getCurrentMood()).toBe("thinking");
    });

    it("eases between poses instead of snapping", () => {
      const poses = geometry.getMoodSequence("thinking");
      if (!poses) throw new Error("thinking should define poses");
      controller.setMood("thinking", 0);
      controller.update(0.05);
      step(poses[0].hold);
      controller.update(0.2);

      const from = poses[0].expression.leftEye.pupilOffset.x;
      const to = poses[1].expression.leftEye.pupilOffset.x;
      expect(gazeX()).toBeLessThan(Math.max(from, to));
      expect(gazeX()).toBeGreaterThan(Math.min(from, to));
    });

    it("reports each pose change once so the eyes can blink", () => {
      const poses = geometry.getMoodSequence("thinking");
      if (!poses) throw new Error("thinking should define poses");
      controller.setMood("thinking", 0);
      controller.update(0.05);
      expect(controller.consumePoseChange()).toBe(false);
      step(poses[0].hold + 0.1);
      expect(controller.consumePoseChange()).toBe(true);
      expect(controller.consumePoseChange()).toBe(false);
    });

    it("keeps a gaze patch on top while the poses change underneath", () => {
      const poses = geometry.getMoodSequence("thinking");
      if (!poses) throw new Error("thinking should define poses");
      controller.setMood("thinking", 0);
      controller.setExpression({ gazeX: 1 }, 0);
      step(poses[0].hold + 1);

      expect(gazeX()).toBeCloseTo(GAZE_OFFSET_X);
      expect(controller.getMixedExpression().mouth.skew).toBeCloseTo(
        poses[1].expression.mouth.skew,
      );
    });

    it("drifts the head with each pose and eases it between them", () => {
      const poses = geometry.getMoodSequence("thinking");
      if (!poses) throw new Error("thinking should define poses");
      expect(controller.getHeadOffset()).toEqual({ yaw: 0, pitch: 0, roll: 0 });

      controller.setMood("thinking", 0);
      controller.update(0.05);
      expect(controller.getHeadOffset()).toEqual(poses[0].head);

      step(poses[0].hold);
      controller.update(0.2);
      const midway = controller.getHeadOffset().pitch;
      expect(midway).toBeGreaterThan(poses[0].head.pitch);
      expect(midway).toBeLessThan(poses[1].head.pitch);

      step(1);
      expect(controller.getHeadOffset()).toEqual(poses[1].head);
    });

    it("eases the head back to rest when another mood takes over", () => {
      controller.setMood("thinking", 0);
      controller.update(0.05);
      controller.setMood("smile", 0.4);
      controller.update(0.2);
      const yaw = controller.getHeadOffset().yaw;
      expect(yaw).toBeGreaterThan(0);
      expect(yaw).toBeLessThan(
        geometry.getMoodSequence("thinking")?.[0].head.yaw ?? 0,
      );
      step(1);
      expect(controller.getHeadOffset()).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    });

    it("stops moving when another mood replaces it", () => {
      controller.setMood("thinking", 0);
      controller.update(0.05);
      controller.setMood("smile", 0);
      step(6);
      expect(controller.getExpression()).toEqual(
        geometry.getExpressionForMood("smile"),
      );
      expect(geometry.getMoodSequence("smile")).toBeNull();
    });
  });
});
