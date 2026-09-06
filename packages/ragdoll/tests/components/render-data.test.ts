import { afterEach, describe, expect, it } from "bun:test";
import { CharacterController } from "../../src/controllers/character-controller";
import {
  applyIdleToExpression,
  computeRenderData,
} from "../../src/components/render-data";

function createController(options?: { themeId?: string; variantId?: string }) {
  return new CharacterController({
    themeId: options?.themeId ?? "default",
    variantId: options?.variantId ?? "human",
    onEventSubscriberError: () => undefined,
  });
}

describe("computeRenderData", () => {
  const controllers: CharacterController[] = [];

  afterEach(() => {
    for (const controller of controllers) {
      controller.destroy();
    }
    controllers.length = 0;
  });

  function tracked(controller: CharacterController): CharacterController {
    controllers.push(controller);
    return controller;
  }

  it("applies idle blink and pupil offset to both eyes", () => {
    const controller = tracked(createController());
    const expression = applyIdleToExpression(
      controller.getExpressionWithAction(),
      1,
      2,
      -1,
    );
    expect(expression.leftEye.openness).toBe(0);
    expect(expression.rightEye.openness).toBe(0);
    expect(expression.leftEye.pupilOffset.x).toBe(2);
    expect(expression.rightEye.pupilOffset.y).toBe(-1);
  });

  it("includes themed geometry for moods, actions, and variants", () => {
    const human = tracked(createController({ themeId: "monochrome" }));
    human.setMood("smile", 0.05);
    human.update(1);
    const smile = computeRenderData(human);
    expect(smile.currentTheme.id).toBe("monochrome");
    expect(smile.facePath.length).toBeGreaterThan(0);
    expect(smile.hairPath.length).toBeGreaterThan(0);
    expect(smile.mustachePath).toBe("");
    expect(smile.expression.mouth.cornerPull).toBeGreaterThan(0);
    expect(Number.isFinite(smile.yaw)).toBe(true);
    expect(Number.isFinite(smile.pitch)).toBe(true);
    expect(Math.abs(smile.yaw)).toBeLessThan(0.05);
    expect(Math.abs(smile.pitch)).toBeLessThan(0.05);

    human.triggerAction("wink", 0.7);
    human.update(0.15);
    const wink = computeRenderData(human);
    expect(wink.expression.rightEye.openness).toBeLessThan(
      wink.expression.leftEye.openness,
    );

    human.clearAction();
    human.setMood("laugh", 0.05);
    human.triggerAction("talk", 1);
    human.update(0.2);
    const talk = computeRenderData(human);
    expect(talk.mouthPaths.openingHeight).toBeGreaterThan(1);
    expect(talk.mouthPaths.opening.length).toBeGreaterThan(0);

    const einstein = tracked(
      createController({ themeId: "alien", variantId: "einstein" }),
    );
    const einsteinData = computeRenderData(einstein);
    expect(einsteinData.currentTheme.id).toBe("alien");
    expect(einsteinData.mustachePath.length).toBeGreaterThan(0);
    expect(einsteinData.hairPath).not.toBe(smile.hairPath);
    expect(einsteinData.dims.headHeight).toBeGreaterThan(smile.dims.headHeight);

    const robot = tracked(createController({ themeId: "robot" }));
    robot.setHeadPose({ yaw: 0.25, pitch: -0.1 }, 0.2);
    for (let i = 0; i < 40; i += 1) {
      robot.update(0.05);
    }
    const pose = computeRenderData(robot);
    expect(pose.currentTheme.id).toBe("robot");
    expect(pose.yaw).toBeGreaterThan(0.1);
    expect(pose.pitch).toBeLessThan(-0.05);
    expect(pose.currentTheme.colors.skin.mid).not.toBe(
      einsteinData.currentTheme.colors.skin.mid,
    );
  });
});
