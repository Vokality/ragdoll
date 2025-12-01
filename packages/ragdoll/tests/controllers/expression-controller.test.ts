import { describe, it, expect, beforeEach } from "bun:test";
import { ExpressionController } from "../../src/controllers/expression-controller";
import { ActionController } from "../../src/controllers/action-controller";
import { RagdollGeometry } from "../../src/models/ragdoll-geometry";
import { MockHeadPoseController } from "../../src/testing/mocks";
import { getDefaultVariant } from "../../src/variants";

describe("ExpressionController", () => {
  let geometry: RagdollGeometry;
  let actionController: ActionController;
  let controller: ExpressionController;

  beforeEach(() => {
    const variant = getDefaultVariant();
    geometry = new RagdollGeometry(variant);
    const mockHeadPose = new MockHeadPoseController();
    actionController = new ActionController(mockHeadPose);
    controller = new ExpressionController(geometry, actionController);
  });

  describe("mood transitions", () => {
    it("should start with neutral mood", () => {
      expect(controller.getCurrentMood()).toBe("neutral");
    });

    it("should transition from neutral to smile", () => {
      controller.setMood("smile");
      expect(controller.getCurrentMood()).toBe("smile");
    });

    it("should transition between different moods", () => {
      controller.setMood("smile");
      expect(controller.getCurrentMood()).toBe("smile");
      controller.setMood("sad");
      expect(controller.getCurrentMood()).toBe("sad");
      controller.setMood("angry");
      expect(controller.getCurrentMood()).toBe("angry");
    });

    it("should not transition when setting same mood", () => {
      controller.setMood("smile");
      const initialExpression = controller.getExpression();
      controller.setMood("smile");
      // Expression should remain the same (no transition triggered)
      const finalExpression = controller.getExpression();
      expect(finalExpression).toEqual(initialExpression);
    });
  });

  describe("transition duration and easing", () => {
    it("should use default transition duration", () => {
      controller.setMood("smile");
      controller.update(0.1);
      const progress = controller.getExpression();
      expect(progress).toBeDefined();
    });

    it("should use custom transition duration", () => {
      controller.setMood("smile", 0.5);
      controller.update(0.1);
      const expr = controller.getExpression();
      expect(expr).toBeDefined();
    });

    it("should enforce minimum transition duration", () => {
      controller.setMood("smile", 0.01);
      controller.update(0.1);
      const expr = controller.getExpression();
      expect(expr).toBeDefined();
    });

    it("should complete transition after duration", () => {
      controller.setMood("smile", 0.3);
      controller.update(0.35);
      const expr = controller.getExpression();
      const targetExpr = geometry.getExpressionForMood("smile");
      // Expression should be close to target after transition completes
      expect(expr.mouth.cornerPull).toBeCloseTo(targetExpr.mouth.cornerPull, 1);
    });
  });

  describe("expression interpolation", () => {
    it("should interpolate expression during transition", () => {
      controller.setMood("neutral");
      controller.update(0.1); // Ensure neutral is set
      const neutralExpr = controller.getExpression();
      
      controller.setMood("smile", 0.3);
      controller.update(0.15); // Halfway through transition
      const halfwayExpr = controller.getExpression();
      
      // Should be between neutral and smile
      expect(halfwayExpr.mouth.cornerPull).toBeGreaterThan(neutralExpr.mouth.cornerPull);
    });

    it("should update geometry during transition", () => {
      controller.setMood("smile", 0.3);
      controller.update(0.1);
      const expr = controller.getExpression();
      expect(expr).toBeDefined();
      expect(geometry.currentExpression).toBeDefined();
    });
  });

  describe("action controller integration", () => {
    it("should return action controller", () => {
      expect(controller.getActionController()).toBe(actionController);
    });

    it("should delegate active action to action controller", () => {
      actionController.triggerAction("wink", 0.5);
      expect(controller.getActiveAction()).toBe("wink");
    });

    it("should delegate isTalking to action controller", () => {
      actionController.triggerAction("talk", 0.5);
      expect(controller.isTalking()).toBe(true);
    });

    it("should delegate action progress to action controller", () => {
      actionController.triggerAction("wink", 1.0);
      controller.update(0.5);
      expect(controller.getActionProgress()).toBeCloseTo(0.5, 2);
    });

    it("should delegate action elapsed to action controller", () => {
      actionController.triggerAction("wink", 1.0);
      controller.update(0.3);
      expect(controller.getActionElapsed()).toBeCloseTo(0.3, 2);
    });

    it("should update action controller during update", () => {
      actionController.triggerAction("wink", 0.5);
      controller.update(0.1);
      expect(controller.getActionProgress()).toBeGreaterThan(0);
    });
  });

  describe("rapid mood changes", () => {
    it("should handle rapid mood changes", () => {
      controller.setMood("smile");
      controller.setMood("sad");
      controller.setMood("angry");
      expect(controller.getCurrentMood()).toBe("angry");
    });

    it("should reset transition progress on rapid change", () => {
      controller.setMood("smile", 0.3);
      controller.update(0.1);
      controller.setMood("sad", 0.3);
      // Transition should restart
      const expr = controller.getExpression();
      expect(expr).toBeDefined();
    });
  });

  describe("expression with action overlay", () => {
    it("should return expression with action overlay applied", () => {
      actionController.triggerAction("wink", 0.5);
      controller.update(0.1);
      const exprWithAction = controller.getExpressionWithAction();
      expect(exprWithAction).toBeDefined();
      expect(exprWithAction.rightEye).toBeDefined();
    });

    it("should merge action overlay with current expression", () => {
      controller.setMood("smile");
      controller.update(0.1);
      actionController.triggerAction("wink", 0.5);
      controller.update(0.1);
      const exprWithAction = controller.getExpressionWithAction();
      expect(exprWithAction.rightEye.openness).toBeLessThan(1);
    });
  });

  describe("blink application", () => {
    it("should apply blink to expression", () => {
      const expr = controller.getExpression();
      const blinkedExpr = controller.applyBlink(0.5);
      expect(blinkedExpr.leftEye.openness).toBeLessThan(expr.leftEye.openness);
      expect(blinkedExpr.rightEye.openness).toBeLessThan(expr.rightEye.openness);
    });

    it("should not modify expression when blink amount is 0", () => {
      const expr = controller.getExpression();
      const blinkedExpr = controller.applyBlink(0);
      expect(blinkedExpr).toEqual(expr);
    });

    it("should fully close eyes when blink amount is 1", () => {
      const blinkedExpr = controller.applyBlink(1.0);
      expect(blinkedExpr.leftEye.openness).toBe(0);
      expect(blinkedExpr.rightEye.openness).toBe(0);
    });
  });

  describe("pupil offset application", () => {
    it("should apply pupil offset", () => {
      const initialExpr = controller.getExpression();
      controller.applyPupilOffset(2, 1);
      const updatedExpr = controller.getExpression();
      expect(updatedExpr.leftEye.pupilOffset.x).toBeGreaterThan(initialExpr.leftEye.pupilOffset.x);
      expect(updatedExpr.leftEye.pupilOffset.y).toBeGreaterThan(initialExpr.leftEye.pupilOffset.y);
    });

    it("should apply offset to both eyes", () => {
      controller.applyPupilOffset(2, 1);
      const expr = controller.getExpression();
      expect(expr.leftEye.pupilOffset.x).toBe(expr.rightEye.pupilOffset.x);
      expect(expr.leftEye.pupilOffset.y).toBe(expr.rightEye.pupilOffset.y);
    });

    it("should accumulate offsets", () => {
      controller.applyPupilOffset(1, 1);
      const firstExpr = controller.getExpression();
      controller.applyPupilOffset(1, 1);
      const secondExpr = controller.getExpression();
      expect(secondExpr.leftEye.pupilOffset.x).toBeGreaterThan(firstExpr.leftEye.pupilOffset.x);
    });
  });
});

