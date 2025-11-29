# @vokality/ragdoll

An animated character framework with facial expressions, head poses, themes, and speech bubbles. Built with React and SVG.

## Installation

```bash
npm install @vokality/ragdoll
# or
bun add @vokality/ragdoll
```

## Quick Start

```tsx
import { RagdollCharacter, CharacterController } from '@vokality/ragdoll';

function App() {
  const [controller, setController] = useState<CharacterController | null>(null);

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
- **Speech Bubbles**: with tone support (default, whisper, shout)
- **Idle Animations**: subtle breathing, blinking, micro-movements

## API

### RagdollCharacter

The main React component that renders the animated character.

```tsx
<RagdollCharacter
  onControllerReady={(ctrl) => setController(ctrl)}
  theme={theme}  // Optional: RagdollTheme object
/>
```

### CharacterController

Controls the character's state and animations.

```tsx
// Facial expressions
controller.setMood('smile', 0.3);  // duration in seconds
controller.setMood('thinking');

// Actions
controller.triggerAction('wink', 0.7);
controller.triggerAction('talk');
controller.clearAction();

// Head pose (radians)
controller.setHeadPose({ yaw: 0.2, pitch: -0.1 }, 0.5);

// Speech bubble
controller.setSpeechBubble({ text: 'Hello!', tone: 'default' });
controller.setSpeechBubble({ text: null });  // clear

// Theme
controller.setTheme('robot');
```

### Themes

```tsx
import { getTheme, getDefaultTheme, getAllThemes } from '@vokality/ragdoll';

// Get a specific theme
const robotTheme = getTheme('robot');

// Get all available themes
const themes = getAllThemes();

// Available themes: 'default', 'robot', 'alien', 'monochrome'
```

### Types

```tsx
import type {
  RagdollTheme,
  FacialMood,
  FacialAction,
  SpeechBubbleState,
  HeadPose,
} from '@vokality/ragdoll';
```

## Requirements

- React 18 or 19
- TypeScript (recommended)

## License

MIT


