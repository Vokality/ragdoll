# Ragdoll Testing Utilities

Test utilities to make Ragdoll components easy to test.

## Installation

```bash
npm install --save-dev @vokality/ragdoll
```

## Usage

### MockClock - Control Time in Tests

```typescript
import { MockClock } from "@vokality/ragdoll/testing";

describe("PomodoroController", () => {
  it("should complete after session duration", () => {
    const clock = new MockClock();
    const controller = new PomodoroController({ clock });

    controller.start(1, 1); // 1 minute session, 1 minute break

    // Advance time by 1 minute
    clock.advance(60 * 1000);

    expect(controller.getState().state).toBe("running");
    expect(controller.getState().isBreak).toBe(true);
  });
});
```

### Builders - Create Test Data

```typescript
import {
  CharacterStateBuilder,
  HeadPoseBuilder,
} from "@vokality/ragdoll/testing";

describe("StateManager", () => {
  it("should update state", () => {
    const initialState = new CharacterStateBuilder()
      .withMood("smile")
      .withAction("wink", 0.5)
      .build();

    const manager = new StateManager(initialState);
    expect(manager.getState().mood).toBe("smile");
  });

  it("should handle head pose", () => {
    const pose = new HeadPoseBuilder().lookingLeft(20).lookingUp(10).build();

    controller.setHeadPose(pose);
  });
});
```

### Mocks - Test in Isolation

```typescript
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

```typescript
import { SpyEventBus } from "@vokality/ragdoll/testing";

describe("State Events", () => {
  it("should emit mood change events", () => {
    const eventBus = new SpyEventBus();
    const stateManager = new StateManager(defaultState, eventBus);

    stateManager.setMood("smile", "neutral");

    expect(eventBus.emittedEvents).toHaveLength(1);
    expect(eventBus.emittedEvents[0]).toMatchObject({
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
  - `withSpeechBubble(text, tone)`
  - `withTalking(isTalking)`

- **`HeadPoseBuilder`**: Build HeadPose objects
  - `withYaw(radians)` / `withPitch(radians)`
  - `lookingLeft(degrees)` / `lookingRight(degrees)`
  - `lookingUp(degrees)` / `lookingDown(degrees)`

- **`SpeechBubbleBuilder`**: Build SpeechBubbleState objects
  - `withText(text)`
  - `withTone(tone)`

### Mocks

- **`MockHeadPoseController`**: Mock head pose controller
  - Tracks all method calls
  - Provides simplified implementation
  - `reset()`: Clear call history

- **`SpyEventBus`**: EventBus that records events
  - `emittedEvents`: Array of all emitted events
  - `clearHistory()`: Clear event history
  - `reset()`: Clear events and subscribers
