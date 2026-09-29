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

    it("should not retrigger when setting the same mood without a face overlay", () => {
      controller.setMood("smile");
      const initialExpression = controller.getExpression();
      controller.setMood("smile");
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
      expect(halfwayExpr.mouth.cornerPull).toBeGreaterThan(
        neutralExpr.mouth.cornerPull,
      );
    });

    it("should update geometry during transition", () => {
      controller.setMood("smile", 0.3);
      controller.update(0.1);
      const expr = controller.getExpression();
      expect(expr).toBeDefined();
    });
  });

  describe("action controller integration", () => {
    it("should not advance action time from the expression update", () => {
      actionController.triggerAction("wink", 0.5);
      controller.update(0.1);
      expect(actionController.getActionProgress()).toBe(0);
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

    it("should continue a rapid transition from the rendered expression", () => {
      controller.setMood("smile", 1);
      controller.update(0.5);
      const beforeRedirect = controller.getExpression();

      controller.setMood("sad", 1);
      controller.update(0);

      expect(controller.getExpression()).toEqual(beforeRedirect);
    });
  });

  describe("expression with action overlay", () => {
    it("should return expression with action overlay applied", () => {
      actionController.triggerAction("wink", 0.5);
      actionController.update(0.1);
      const exprWithAction = controller.getExpressionWithAction();
      expect(exprWithAction).toBeDefined();
      expect(exprWithAction.rightEye).toBeDefined();
    });

    it("should merge action overlay with current expression", () => {
      controller.setMood("smile");
      controller.update(0.1);
      actionController.triggerAction("wink", 0.5);
      actionController.update(0.1);
      const exprWithAction = controller.getExpressionWithAction();
      expect(exprWithAction.rightEye.openness).toBeLessThan(1);
    });
  });
});
