/**
 * Example tests demonstrating testing utilities
 * These are examples - not meant to be run in CI yet
 */

// @ts-nocheck - These are example tests for documentation
import { describe, it, expect } from "bun:test";
import { ActionController } from "../controllers/action-controller";
import { StateManager } from "../state/state-manager";
import { EventBus } from "../state/event-bus";
import {
  MockClock,
  MockHeadPoseController,
  SpyEventBus,
  CharacterStateBuilder,
  HeadPoseBuilder,
  SpeechBubbleBuilder,
} from "./index";

describe("ActionController", () => {
  it("should trigger shake action", () => {
    const mockHeadPose = new MockHeadPoseController();
    const controller = new ActionController(mockHeadPose);

    controller.triggerAction("shake", 0.6);

    expect(controller.getActiveAction()).toBe("shake");
  });

  it("should complete shake after duration", () => {
    const mockHeadPose = new MockHeadPoseController();
    const controller = new ActionController(mockHeadPose);

    controller.triggerAction("shake", 0.6);
    controller.update(0.7); // Exceed duration

    expect(controller.getActiveAction()).toBeNull();
  });

  it("should return head to center after shake", () => {
    const mockHeadPose = new MockHeadPoseController();
    const controller = new ActionController(mockHeadPose);

    controller.triggerAction("shake", 0.6);
    controller.update(0.7);

    expect(mockHeadPose.lookForwardCalls.length).toBe(1);
  });

  it("should update head pose during shake", () => {
    const mockHeadPose = new MockHeadPoseController();
    const controller = new ActionController(mockHeadPose);

    controller.triggerAction("shake", 0.6);
    controller.update(0.1);
    controller.update(0.1);

    expect(mockHeadPose.setTargetPoseCalls.length).toBeGreaterThan(0);
  });
});

describe("StateManager with EventBus", () => {
  it("should emit mood change events", () => {
    const eventBus = new SpyEventBus() as unknown as EventBus;
    const initialState = new CharacterStateBuilder().build();
    const stateManager = new StateManager(initialState, eventBus);

    stateManager.setMood("smile", "neutral");

    expect((eventBus as unknown as SpyEventBus).emittedEvents).toHaveLength(1);
    expect((eventBus as unknown as SpyEventBus).emittedEvents[0]).toMatchObject(
      {
        type: "moodChanged",
        mood: "smile",
        previousMood: "neutral",
      },
    );
  });

  it("should emit action triggered events", () => {
    const eventBus = new SpyEventBus() as unknown as EventBus;
    const initialState = new CharacterStateBuilder().build();
    const stateManager = new StateManager(initialState, eventBus);

    stateManager.setAction("wink", 0.6);

    expect((eventBus as unknown as SpyEventBus).emittedEvents).toHaveLength(1);
    expect((eventBus as unknown as SpyEventBus).emittedEvents[0]).toMatchObject(
      {
        type: "actionTriggered",
        action: "wink",
        duration: 0.6,
      },
    );
  });

  it("should emit action cleared events", () => {
    const eventBus = new SpyEventBus() as unknown as EventBus;
    const initialState = new CharacterStateBuilder().withAction("wink").build();
    const stateManager = new StateManager(initialState, eventBus);

    stateManager.setAction(null);

    expect((eventBus as unknown as SpyEventBus).emittedEvents).toHaveLength(1);
    expect((eventBus as unknown as SpyEventBus).emittedEvents[0]).toMatchObject(
      {
        type: "actionCleared",
      },
    );
  });
});

describe("MockClock", () => {
  it("should track time", () => {
    const clock = new MockClock();

    expect(clock.now()).toBe(0);

    clock.advance(1000);
    expect(clock.now()).toBe(1000);
  });

  it("should execute setTimeout callbacks", () => {
    const clock = new MockClock();
    let executed = false;

    clock.setTimeout(() => {
      executed = true;
    }, 1000);

    expect(executed).toBe(false);

    clock.advance(1000);
    expect(executed).toBe(true);
  });

  it("should execute setInterval callbacks", () => {
    const clock = new MockClock();
    let count = 0;

    clock.setInterval(() => {
      count++;
    }, 1000);

    clock.advance(3500);
    expect(count).toBe(3);
  });

  it("should clear timeouts", () => {
    const clock = new MockClock();
    let executed = false;

    const id = clock.setTimeout(() => {
      executed = true;
    }, 1000);

    clock.clearTimeout(id);
    clock.advance(1000);

    expect(executed).toBe(false);
  });
});

describe("CharacterStateBuilder", () => {
  it("should build default state", () => {
    const state = new CharacterStateBuilder().build();

    expect(state.mood).toBe("neutral");
    expect(state.action).toBeNull();
    expect(state.bubble.text).toBeNull();
  });

  it("should build custom state", () => {
    const state = new CharacterStateBuilder()
      .withMood("smile")
      .withAction("wink", 0.5)
      .withSpeechBubble("Hello!", "shout")
      .withTalking(true)
      .build();

    expect(state.mood).toBe("smile");
    expect(state.action).toBe("wink");
    expect(state.animation.actionProgress).toBe(0.5);
    expect(state.bubble.text).toBe("Hello!");
    expect(state.bubble.tone).toBe("shout");
    expect(state.animation.isTalking).toBe(true);
  });
});

describe("HeadPoseBuilder", () => {
  it("should build poses in degrees", () => {
    const pose = new HeadPoseBuilder().lookingLeft(20).lookingUp(10).build();

    expect(pose.yaw).toBeCloseTo((20 * Math.PI) / 180);
    expect(pose.pitch).toBeCloseTo((10 * Math.PI) / 180);
  });

  it("should build poses in radians", () => {
    const pose = new HeadPoseBuilder()
      .withYaw(Math.PI / 4)
      .withPitch(Math.PI / 6)
      .build();

    expect(pose.yaw).toBe(Math.PI / 4);
    expect(pose.pitch).toBe(Math.PI / 6);
  });
});

describe("SpeechBubbleBuilder", () => {
  it("should build speech bubble", () => {
    const bubble = new SpeechBubbleBuilder()
      .withText("Test message")
      .withTone("whisper")
      .build();

    expect(bubble.text).toBe("Test message");
    expect(bubble.tone).toBe("whisper");
  });
});
