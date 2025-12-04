# @vokality/ragdoll

An animated character framework with facial expressions, head poses, and themes. Built with React and SVG.

## Installation

```bash
npm install @vokality/ragdoll
# or
bun add @vokality/ragdoll
```

## Quick Start

```tsx
import { RagdollCharacter, CharacterController } from "@vokality/ragdoll";

function App() {
  const [controller, setController] = useState<CharacterController | null>(
    null,
  );

  return (
    <RagdollCharacter
      onControllerReady={setController}
      theme={getDefaultTheme()}
    />
  );
}
```

## Features

- **Facial Expressions**: smile, frown, laugh, angry, sad, surprise, confusion, thinking
- **Actions**: wink, talk animations
- **Head Pose**: yaw and pitch control with smooth transitions
- **Themes**: default, robot, alien, monochrome (or create your own)
- **Idle Animations**: subtle breathing, blinking, micro-movements

## Architecture & DDD

Ragdoll follows a strict domain-driven split:

- **Domain Core** – controllers, models, variants, themes, and state live under `packages/ragdoll/src`. They expose pure animation, expression, and pose logic with zero UI or transport knowledge.
- **Presentation** – apps render the character (for example via `RagdollCharacter` or your own renderer) and subscribe to domain state through the event bus.
- **Integration** – extensions plug into `CharacterController` via the `FeaturePlugin` interface without nesting app-specific logic inside the core package.

Keeping UI, timers, or business-specific rules out of the core package ensures the framework stays reusable and easy to extend.

## API

### RagdollCharacter

The main React component that renders the animated character.

```tsx
<RagdollCharacter
  onControllerReady={(ctrl) => setController(ctrl)}
  theme={theme} // Optional: RagdollTheme object
  destroyOnUnmount // Optional: defaults to true, set false if you manage controller lifecycle yourself
/>
```

### CharacterController

Controls the character's state and animations.

```tsx
// Facial expressions
controller.setMood("smile", 0.3); // duration in seconds
controller.setMood("thinking");

// Actions
controller.triggerAction("wink", 0.7);
controller.triggerAction("talk");
controller.clearAction();

// Head pose (radians)
controller.setHeadPose({ yaw: 0.2, pitch: -0.1 }, 0.5);

// Theme
controller.setTheme("robot");

// Cleanup (stops internal timers/listeners)
controller.destroy();
```

#### State events

Every controller owns a `StateManager` + `EventBus`. Subscribe to state transitions without polling:

```ts
const unsubscribe = controller.getEventBus().subscribe((event) => {
  if (event.type === "moodChanged") {
    console.log("Mood updated", event.mood);
  }
});

// Later
unsubscribe();
```

Use the bus for UI updates, logging, or analytics layers that sit outside the domain model.

## Extension Points

### Themes

```tsx
import { getTheme, getDefaultTheme, getAllThemes } from "@vokality/ragdoll";

// Get a specific theme
const robotTheme = getTheme("robot");

// Get all available themes
const themes = getAllThemes();

// Available themes: 'default', 'robot', 'alien', 'monochrome'
```

Themes merge with variant color overrides at runtime, so domain logic never needs to know about presentation-specific palettes.

### Variants

```ts
import { getVariant, registerVariant } from "@vokality/ragdoll";

const customVariant = registerVariant({
  id: "scientist",
  dimensions: { /* overrides */ },
  colorOverrides: { hair: { light: "#eee", mid: "#ccc", dark: "#999" } },
});

const variant = getVariant("scientist");
```

Variants only describe geometry/dimension deltas. They never reach into controllers or UI, keeping the shape of the model independent from behavioral logic.

### Plugins

Use `FeaturePlugin` to bolt on integration-specific behavior without modifying the core controller:

```ts
import type { FeaturePlugin } from "@vokality/ragdoll";

const telemetryPlugin: FeaturePlugin = {
  name: "telemetry",
  initialize(controller) {
    this.unsubscribe = controller.getEventBus().subscribe((event) => {
      // forward to analytics
    });
  },
  destroy() {
    this.unsubscribe?.();
  },
};

controller.registerPlugin(telemetryPlugin);
```

Plugins run inside the controller's update loop, so they remain close to the domain while still being optional.

### Testing utilities

`@vokality/ragdoll/testing` exposes builders, clocks, mocks, and a spy event bus for pure domain tests:

```ts
import {
  CharacterStateBuilder,
  HeadPoseBuilder,
  MockClock,
  SpyEventBus,
} from "@vokality/ragdoll/testing";
```

These utilities never pull in React, letting you test controllers, state transitions, and event flows in isolation.

### Types

```tsx
import type {
  RagdollTheme,
  FacialMood,
  FacialAction,
  HeadPose,
} from "@vokality/ragdoll";
```

## Requirements

- React 18 or 19
- TypeScript (recommended)

## License

MIT
