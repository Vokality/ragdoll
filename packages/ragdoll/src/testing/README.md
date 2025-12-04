# Ragdoll Testing Utilities

Domain-minded helpers for exercising controllers, state managers, and integration code without pulling in any UI.

## Installation

```bash
npm install --save-dev @vokality/ragdoll
```

## Usage

### MockClock - Control Time in Tests

```ts
import { MockClock } from "@vokality/ragdoll/testing";
import { CharacterController } from "@vokality/ragdoll";

describe("character update loop", () => {
  it("can be stepped deterministically", () => {
    const controller = new CharacterController();
    const clock = new MockClock();

    // Run the controller update at a fixed cadence
    clock.setInterval(() => {
      controller.update(1 / 60); // 60 FPS delta in seconds
    }, 16);

    // Simulate one second of time
    clock.advance(1000);

    expect(controller.getState().animation).toBeDefined();
  });
});
```

### Builders - Create Test Data

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
    const manager = new StateManager(new CharacterStateBuilder().build());

    manager.setHeadPose(pose);

    expect(manager.getState().headPose.yaw).toBeCloseTo(pose.yaw);
  });
});
```

### Mocks - Test in Isolation

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

### SpyEventBus - Track Events

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

## Available Utilities

### Clock

- **`IClock`**: Interface for clock implementations
- **`SystemClock`**: Real clock using system time
- **`MockClock`**: Controllable clock for testing
  - `now()`: Get current time
  - `advance(ms)`: Move time forward
  - `setTime(time)`: Set absolute time
  - `reset()`: Reset to time 0

### Builders

- **`CharacterStateBuilder`**: Build CharacterState objects
  - `withMood(mood)`
  - `withAction(action, progress)`
  - `withHeadPose(pose)`
  - `withTalking(isTalking)`

- **`HeadPoseBuilder`**: Build HeadPose objects
  - `withYaw(radians)` / `withPitch(radians)`
  - `lookingLeft(degrees)` / `lookingRight(degrees)`
  - `lookingUp(degrees)` / `lookingDown(degrees)`

### Mocks

- **`MockHeadPoseController`**: Mock head pose controller
  - Tracks all method calls
  - Provides simplified implementation
  - `reset()`: Clear call history

- **`SpyEventBus`**: EventBus that records events
  - `emittedEvents`: Array of all emitted events
  - `clearHistory()`: Clear event history
  - `reset()`: Clear events and subscribers
