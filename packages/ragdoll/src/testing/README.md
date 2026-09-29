# Ragdoll Testing Utilities

Helpers for testing controllers, state managers, and integration code without UI dependencies.

## Installation

```bash
bun add --dev @vokality/ragdoll
```

## Usage

### Builders - create test data

```ts
import { StateManager } from "@vokality/ragdoll";
import {
  CharacterStateBuilder,
  HeadPoseBuilder,
  SpyEventBus,
} from "@vokality/ragdoll/testing";

describe("StateManager", () => {
  it("should update mood + action atomically", () => {
    const state = new CharacterStateBuilder()
      .withMood("smile")
      .withAction("wink", 0.5)
      .build();
    const manager = new StateManager(state, new SpyEventBus());

    manager.setMood("laugh", "smile");

    expect(manager.getState().mood).toBe("laugh");
  });

  it("should load head pose snapshots", () => {
    const pose = new HeadPoseBuilder().lookingLeft(20).lookingUp(10).build();
    const manager = new StateManager(
      new CharacterStateBuilder().build(),
      new SpyEventBus(),
    );

    manager.setHeadPose(pose);

    expect(manager.getState().headPose.yaw).toBeCloseTo(pose.yaw);
  });
});
```

### Mocks - test in isolation

```typescript
import { ActionController } from "@vokality/ragdoll";
import { MockHeadPoseController } from "@vokality/ragdoll/testing";

describe("ActionController", () => {
  it("should trigger shake action", () => {
    const mockHeadPose = new MockHeadPoseController();
    const controller = new ActionController(mockHeadPose);

    controller.triggerAction("shake", 0.6);
    controller.update(0.1);

    expect(mockHeadPose.setTargetPoseCalls.length).toBeGreaterThan(0);
    expect(controller.getActiveAction()).toBe("shake");
  });
});
```

### SpyEventBus - track events

```ts
import { StateManager } from "@vokality/ragdoll";
import { CharacterStateBuilder, SpyEventBus } from "@vokality/ragdoll/testing";

describe("state events", () => {
  it("records the exact event payloads", () => {
    const bus = new SpyEventBus();
    const manager = new StateManager(new CharacterStateBuilder().build(), bus);

    manager.setMood("smile", "neutral");

    expect(bus.emittedEvents).toHaveLength(1);
    expect(bus.emittedEvents[0]).toMatchObject({
      type: "moodChanged",
      mood: "smile",
      previousMood: "neutral",
    });
  });
});
```

## Available utilities

### Builders

- `CharacterStateBuilder`: Build CharacterState objects
  - `withMood(mood)`
  - `withAction(action, progress)`
  - `withHeadPose(pose)`
  - `withTalking(isTalking)`

- `HeadPoseBuilder`: Build HeadPose objects
  - `withYaw(radians)` / `withPitch(radians)`
  - `lookingLeft(degrees)` / `lookingRight(degrees)`
  - `lookingUp(degrees)` / `lookingDown(degrees)`

### Mocks

- `MockHeadPoseController`: Mock head pose controller
  - Tracks all method calls
  - Provides simplified implementation
  - `reset()`: Clear call history

- `SpyEventBus`: `StateEventEmitter` that records events; pass it to `StateManager`
  - `emittedEvents`: Array of all emitted events
  - `reset()`: Clear events and subscribers
