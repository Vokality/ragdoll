# @vokality/ragdoll-extensions

Extension framework for Ragdoll - register tools, handlers, and plugins that integrate with AI agents.

## Overview

This package provides a flexible extension system that allows you to:

- Define tools in OpenAI function-calling format
- Register extensions with handlers that execute those tools
- Aggregate tools from multiple extensions
- Execute tools by name with automatic validation
- React to extension/tool changes via events

The system is designed to be embeddable anywhere - Electron apps, VS Code extensions, web applications, or Node.js servers.

## Installation

```bash
bun add @vokality/ragdoll-extensions
```

## Quick Start

```typescript
import {
  createRegistry,
  createCharacterExtension,
} from "@vokality/ragdoll-extensions";

// 1. Create a registry
const registry = createRegistry();

// 2. Create and register an extension
const characterExtension = createCharacterExtension({
  handler: {
    setMood: async ({ mood, duration }) => {
      console.log(`Setting mood to ${mood}`);
      return { success: true };
    },
    triggerAction: async ({ action }) => {
      console.log(`Triggering action: ${action}`);
      return { success: true };
    },
    setHeadPose: async ({ yawDegrees, pitchDegrees }) => {
      console.log(`Head pose: yaw=${yawDegrees}, pitch=${pitchDegrees}`);
      return { success: true };
    },
    setSpeechBubble: async ({ text, tone }) => {
      console.log(`Speech bubble: "${text}" (${tone})`);
      return { success: true };
    },
  },
});

await registry.register(characterExtension);

// 3. Get all tools (OpenAI format)
const tools = registry.getAllTools();
// Pass `tools` to OpenAI's chat completion API

// 4. Execute a tool when the AI calls it
const result = await registry.executeTool("setMood", { mood: "smile" });
```

## Built-in Extensions

### Character Extension

Controls facial expressions and animations.

```typescript
import { createCharacterExtension } from "@vokality/ragdoll-extensions";

const extension = createCharacterExtension({
  handler: {
    setMood: async ({ mood, duration }) => ({ success: true }),
    triggerAction: async ({ action, duration }) => ({ success: true }),
    setHeadPose: async ({ yawDegrees, pitchDegrees, duration }) => ({ success: true }),
    setSpeechBubble: async ({ text, tone }) => ({ success: true }),
  },
});
```

**Tools:**
- `setMood` - Set facial expression (neutral, smile, frown, laugh, angry, sad, surprise, confusion, thinking)
- `triggerAction` - Trigger animation (wink, talk, shake)
- `setHeadPose` - Rotate head (yaw: -35 to 35, pitch: -20 to 20)
- `setSpeechBubble` - Show/clear speech bubble

### Pomodoro Extension

Timer for focused work sessions.

```typescript
import { createPomodoroExtension } from "@vokality/ragdoll-extensions";

const extension = createPomodoroExtension({
  handler: {
    startPomodoro: async ({ sessionDuration, breakDuration }) => ({ success: true }),
    pausePomodoro: async () => ({ success: true }),
    resetPomodoro: async () => ({ success: true }),
    getPomodoroState: async () => ({ success: true, data: { state: "idle" } }),
  },
});
```

**Tools:**
- `startPomodoro` - Start timer (session: 5/15/30/60/120 min, break: 5/10/15/30 min)
- `pausePomodoro` - Pause active timer
- `resetPomodoro` - Stop and reset timer
- `getPomodoroState` - Get current timer state

### Tasks Extension

Task management tools.

```typescript
import { createTaskExtension } from "@vokality/ragdoll-extensions";

const extension = createTaskExtension({
  handler: {
    addTask: async ({ text, status }) => ({ success: true, data: { id: "1" } }),
    updateTaskStatus: async ({ taskId, status }) => ({ success: true }),
    setActiveTask: async ({ taskId }) => ({ success: true }),
    removeTask: async ({ taskId }) => ({ success: true }),
    completeActiveTask: async () => ({ success: true }),
    clearCompletedTasks: async () => ({ success: true }),
    clearAllTasks: async () => ({ success: true }),
    listTasks: async () => ({ success: true, data: [] }),
  },
});
```

**Tools:**
- `addTask` - Add a new task
- `updateTaskStatus` - Update task status (todo, in_progress, blocked, done)
- `setActiveTask` - Set active task
- `removeTask` - Remove a task
- `completeActiveTask` - Mark active task as done
- `clearCompletedTasks` - Remove completed tasks
- `clearAllTasks` - Remove all tasks
- `listTasks` - Get all tasks

## Renderer UI Slots

The package also includes React helpers for rendering extension-contributed UI slots. These slots power the task checklist, pomodoro timer, Spotify panel, and any future extensions without touching your app code.

```tsx
import { createElectronHostBridge, useExtensionSlots } from "@vokality/ragdoll-extensions";
import { SlotBar } from "@vokality/ragdoll-extensions/ui";

function ExtensionBar() {
  const host = useMemo(
    () => createElectronHostBridge({
      api: window.electronAPI,
      reload: () => window.location.reload(),
    }),
    []
  );

  const slots = useExtensionSlots(host);
  return <SlotBar slots={slots} />;
}
```

Extensions manage their own slot state (tasks, pomodoro, Spotify, etc.). Your renderer just provides the host API and renders whatever slots are available, making it easy to add or remove extensions in isolation.

## Creating Custom Extensions

Use the `createExtension` factory to create custom extensions:

```typescript
import { createExtension } from "@vokality/ragdoll-extensions";

const weatherExtension = createExtension({
  id: "weather",
  name: "Weather",
  version: "1.0.0",
  tools: [
    {
      definition: {
        type: "function",
        function: {
          name: "getWeather",
          description: "Get the current weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "City name or coordinates",
              },
              units: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
                description: "Temperature units",
              },
            },
            required: ["location"],
          },
        },
      },
      handler: async ({ location, units }, context) => {
        // Your implementation here
        return {
          success: true,
          data: { temp: 72, condition: "sunny" },
        };
      },
      validate: (args) => {
        if (!args.location) {
          return { valid: false, error: "location is required" };
        }
        return { valid: true };
      },
    },
  ],
  onInitialize: (context) => {
    console.log(`Weather extension initialized: ${context.instanceId}`);
  },
  onDestroy: () => {
    console.log("Weather extension destroyed");
  },
});

await registry.register(weatherExtension);
```

## Event Handling

React to changes in the registry:

```typescript
// When tools change (extension registered/unregistered)
const unsubscribe = registry.onToolsChanged((event) => {
  console.log(`Tools changed due to: ${event.extensionId}`);
  const tools = registry.getAllTools();
  // Update your OpenAI client with new tools
});

// When a specific extension is registered
registry.onExtensionRegistered((event) => {
  console.log(`Extension registered: ${event.extensionId}`);
});

// When a specific extension is unregistered
registry.onExtensionUnregistered((event) => {
  console.log(`Extension unregistered: ${event.extensionId}`);
});

// Clean up
unsubscribe();
```

## API Reference

### `createRegistry(): ExtensionRegistry`

Create a new extension registry.

### `ExtensionRegistry`

| Method | Description |
|--------|-------------|
| `register(extension, options?)` | Register an extension |
| `unregister(extensionId)` | Unregister an extension |
| `has(extensionId)` | Check if extension exists |
| `getExtension(extensionId)` | Get extension by ID |
| `getExtensionIds()` | Get all extension IDs |
| `getAllTools()` | Get all tool definitions |
| `getToolsByExtension(extensionId)` | Get tools for an extension |
| `hasTool(toolName)` | Check if tool exists |
| `validateTool(toolName, args)` | Validate tool arguments |
| `executeTool(toolName, args, metadata?)` | Execute a tool |
| `onToolsChanged(callback)` | Subscribe to tool changes |
| `onExtensionRegistered(callback)` | Subscribe to registrations |
| `onExtensionUnregistered(callback)` | Subscribe to unregistrations |
| `destroy()` | Clean up all extensions |
| `getStats()` | Get registry statistics |

### `createExtension(config): RagdollExtension`

Create an extension from a configuration object.

### Types

```typescript
interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: ToolParameterSchema;
  };
}

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

interface ValidationResult {
  valid: boolean;
  error?: string;
}

interface ExtensionTool<TArgs = Record<string, unknown>> {
  definition: ToolDefinition;
  handler: (args: TArgs, context: ToolExecutionContext) => Promise<ToolResult> | ToolResult;
  validate?: (args: TArgs) => ValidationResult;
}

interface RagdollExtension {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly tools: ExtensionTool[];
  initialize?(context: ExtensionContext): Promise<void> | void;
  destroy?(): Promise<void> | void;
}
```

## Loading Extensions from npm Packages

Extensions can be distributed as npm packages and auto-discovered by the loader.

### Creating an Extension Package

Create a package with `ragdollExtension` in package.json:

```json
{
  "name": "@example/weather-extension",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "ragdollExtension": true
}
```

Export the extension:

```typescript
// src/index.ts
import { createExtension } from "@vokality/ragdoll-extensions";

export const extension = createExtension({
  id: "weather",
  name: "Weather",
  version: "1.0.0",
  tools: [
    {
      definition: {
        type: "function",
        function: {
          name: "getWeather",
          description: "Get weather for a location",
          parameters: {
            type: "object",
            properties: {
              location: { type: "string", description: "City name" },
            },
            required: ["location"],
          },
        },
      },
      handler: async ({ location }) => {
        // Your implementation
        return { success: true, data: { temp: 72 } };
      },
    },
  ],
});

// Alternative: export a factory function
export function createExtension(config) {
  return extension;
}
```

### Using the Loader

```typescript
import { createRegistry, createLoader } from "@vokality/ragdoll-extensions";
import path from "path";

const registry = createRegistry();
const loader = createLoader(registry, {
  searchPaths: [
    path.join(process.cwd(), "node_modules"),
  ],
});

// Discover and load all extensions
const results = await loader.discoverAndLoad();
console.log(`Loaded ${results.filter(r => r.success).length} extensions`);

// Or load a specific package
const result = await loader.loadPackage("@example/weather-extension");
if (result.success) {
  console.log(`Loaded extension: ${result.extensionId}`);
}

// Unload a package
await loader.unloadPackage("@example/weather-extension");

// Check what's loaded
const loaded = loader.getLoadedPackages();
```

### Advanced Package Configuration

Use an object for more control:

```json
{
  "name": "@example/my-extension",
  "ragdollExtension": {
    "id": "custom-id",
    "config": {
      "apiKey": "default-key"
    }
  }
}
```

The `config` is passed to your `createExtension()` function if exported.

### Export Formats

The loader supports multiple export formats:

```typescript
// Option 1: Named export
export const extension = createExtension({ ... });

// Option 2: Default export
export default createExtension({ ... });

// Option 3: Factory function (receives config from package.json)
export function createExtension(config) {
  return { id: "my-ext", name: "My Extension", ... };
}
```

## License

MIT