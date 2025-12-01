# Ragdoll Architecture

This document provides a comprehensive overview of the Ragdoll project architecture, design patterns, and key technical decisions.

## Table of Contents

- [Project Overview](#project-overview)
- [Monorepo Structure](#monorepo-structure)
- [Core Architecture](#core-architecture)
- [Design Patterns](#design-patterns)
- [State Management](#state-management)
- [Animation System](#animation-system)
- [Control Interfaces](#control-interfaces)
- [VS Code Extension Architecture](#vs-code-extension-architecture)
- [Plugin System](#plugin-system)
- [Theme System](#theme-system)
- [Data Flow](#data-flow)
- [Technology Stack](#technology-stack)
- [Performance Considerations](#performance-considerations)

## Project Overview

Ragdoll is an animated character framework that provides an expressive, controllable 2D character with facial expressions, head movements, and speech bubbles. It enables AI assistants and other applications to express emotions and communicate visually through a cartoon character.

**Key Use Cases:**

- AI assistant visual expression (via Model Context Protocol)
- Interactive character controls in web applications
- VS Code extension for developer companion

## Monorepo Structure

The project uses a **Bun workspace-based monorepo** with clear separation between core framework and applications:

```
ragdoll/
├── packages/
│   └── ragdoll/              # Core framework (@vokality/ragdoll)
│       └── src/
│           ├── components/   # React components
│           ├── controllers/  # Business logic
│           ├── models/       # Data models
│           ├── state/        # State management
│           ├── themes/       # Theme definitions
│           ├── animation/    # Animation utilities
│           ├── plugins/      # Plugin system
│           ├── testing/      # Test utilities
│           └── types/        # TypeScript types
│
├── apps/
│   ├── demo/                 # Browser demo application
│   │   ├── src/ui/          # React UI components
│   │   ├── src/api/         # Express + Socket.io server
│   │   └── src/mcp/         # MCP server
│   │
│   └── emote/               # VS Code extension
│       ├── src/             # Extension host code
│       └── webview/         # React webview app
│
└── assets/                  # Media and screenshots
```

**Benefits of this structure:**

- Core framework is independent and reusable
- Applications consume the framework as a dependency
- Clear boundaries between concerns
- Easy to add new applications

## Core Architecture

### Component Hierarchy

```
RagdollCharacter (React Component)
    │
    ├─> CharacterController (Orchestrator)
    │       │
    │       ├─> ExpressionController
    │       ├─> HeadPoseController
    │       ├─> IdleController
    │       ├─> ActionController
    │       ├─> PomodoroController (Plugin)
    │       └─> TaskController (Plugin)
    │
    ├─> RagdollSkeleton (Model)
    │       └─> Joint hierarchy
    │
    ├─> RagdollGeometry (Model)
    │       └─> Visual representation
    │
    └─> StateManager (State)
            └─> EventBus (Pub/Sub)
```

### Controller Pattern

The architecture uses a **controller-based pattern** where each domain has a dedicated controller:

**CharacterController** (`character-controller.ts:573 lines`)

- Central orchestrator that coordinates all sub-controllers
- Manages the update loop (60fps)
- Handles plugin registration
- Provides unified API for external control

**Specialized Controllers:**

- **ExpressionController**: Manages facial expressions (happy, sad, surprised, etc.)
- **HeadPoseController**: Controls head rotation (pitch, yaw, roll)
- **IdleController**: Adds lifelike behaviors (blinking, breathing, saccades)
- **ActionController**: Handles discrete actions (wave, nod, shake, shrug)
- **PomodoroController**: Plugin for Pomodoro timer functionality
- **TaskController**: Plugin for task management

**Why Controllers?**

- Clear separation of concerns
- Each controller is independently testable
- Composition over inheritance
- Easy to add new behaviors without modifying existing code

### Models

**RagdollSkeleton** (`ragdoll-skeleton.ts`)

- Defines the hierarchical joint structure
- Represents the "bones" of the character
- Joint transformations (position, rotation)

**RagdollGeometry** (`ragdoll-geometry.ts`)

- Defines visual appearance (SVG paths)
- Maps geometry to skeleton joints
- Supports theming through color mapping

## Design Patterns

### 1. Facade Pattern

**CharacterController** acts as a facade, providing a simplified interface to the complex subsystem of specialized controllers.

```typescript
// Simple API hides complexity
controller.setExpression("happy");
// Internally coordinates ExpressionController, IdleController, etc.
```

### 2. Observer Pattern (Pub/Sub)

**EventBus** enables loose coupling between components:

```typescript
eventBus.emit("expressionChanged", { expression: "happy" });
eventBus.on("expressionChanged", (data) => {
  /* react */
});
```

### 3. Strategy Pattern

**IdleController** uses strategies for different idle behaviors:

- Blinking strategy
- Breathing strategy
- Eye saccades strategy

### 4. Plugin Pattern

**FeaturePlugin** interface allows extending functionality:

```typescript
interface FeaturePlugin {
  onUpdate(deltaTime: number): void;
  reset(): void;
}
```

### 5. Command Pattern

**FacialCommand** discriminated union ensures type-safe command execution:

```typescript
type FacialCommand =
  | { type: "expression"; expression: string }
  | { type: "headPose"; pitch: number; yaw: number; roll: number }
  | { type: "say"; text: string; duration?: number };
```

### 6. Repository Pattern

**StateManager** acts as a single source of truth for all character state:

```typescript
stateManager.setState({ expression: "happy" });
const state = stateManager.getState();
```

## State Management

### Architecture

```
Controllers → StateManager → EventBus → Subscribers
                    ↓
            Single Source of Truth
```

**StateManager** (`state/state-manager.ts`)

- Centralized state container
- Immutable state updates
- Event emission on state changes
- Type-safe state access

**EventBus** (`state/event-bus.ts`)

- Pub/Sub event system
- Type-safe event names and payloads
- Unsubscribe support
- No external dependencies

**Why Custom State Management?**

- Avoids heavy dependencies (Redux, MobX, etc.)
- Tailored to character animation needs
- Simple and performant
- Full TypeScript support

### State Flow

```
User Action → Controller.method()
    ↓
Controller updates StateManager
    ↓
StateManager emits event via EventBus
    ↓
React Component subscribes to events
    ↓
Component re-renders with new state
```

## Animation System

### Rendering

**SVG-based** rendering (no Canvas/WebGL):

- Declarative
- CSS transforms for performance
- Theme-able with gradients
- Accessible

### Animation Loop

```typescript
// 60fps update loop
requestAnimationFrame(update);

function update(timestamp: number) {
  const deltaTime = Math.min(timestamp - lastTime, 100); // Cap at 100ms

  // Update all controllers
  controller.update(deltaTime);

  // Schedule next frame
  requestAnimationFrame(update);
}
```

**Key Features:**

- Capped deltaTime prevents animation jumps
- All controllers updated in single loop
- Efficient state batching

### Interpolation

**Spring-based easing** for natural motion:

```typescript
// Smooth transitions using easing functions
const currentValue = easeOut(startValue, targetValue, progress, easingFactor);
```

**Idle Animations:**

- **Blinking**: Random intervals (2-6 seconds)
- **Breathing**: Sine wave oscillation
- **Eye Saccades**: Micro-movements for realism

## Control Interfaces

Ragdoll supports **multiple control channels** that converge on the same `CharacterController`:

### 1. Direct API (Programmatic)

```typescript
import { CharacterController } from "@vokality/ragdoll";

const controller = new CharacterController(stateManager, eventBus);
controller.setExpression("happy");
controller.setHeadPose(10, 15, 0);
```

### 2. REST API (HTTP)

```http
POST /api/sessions/:sessionId/expression
Content-Type: application/json

{ "expression": "happy" }
```

**Server:** Express 5 (`apps/demo/src/api/server.ts:420 lines`)

- Multi-session support
- Session-scoped controllers
- CORS enabled

### 3. WebSocket (Real-time)

```typescript
socket.emit("command", {
  type: "expression",
  expression: "happy",
});
```

**Transport:** Socket.io 4.8

- Real-time bidirectional communication
- Session management
- State broadcasting

### 4. Model Context Protocol (AI Integration)

```typescript
// AI assistant can control character via MCP
await callTool("ragdoll_set_expression", {
  expression: "happy",
});
```

**MCP Server:** (`apps/demo/src/mcp/ragdoll-mcp-server.ts`)

- 20+ tools for AI control
- Validation and error handling
- Connects to API server via HTTP

### 5. UI Control Panel

Visual controls for manual testing and demonstration.

**Component:** `apps/demo/src/ui/control-panel.tsx`

### Multi-Channel Architecture

```
┌─────────────┐
│  UI Panel   │
└──────┬──────┘
       │
┌──────▼──────┐    ┌──────────────┐
│  REST API   │◄───┤ MCP Server   │
└──────┬──────┘    └──────────────┘
       │
┌──────▼──────┐
│  WebSocket  │
└──────┬──────┘
       │
┌──────▼──────────────────┐
│  CharacterController    │
└─────────────────────────┘
```

All channels provide the same functionality through different interfaces.

## VS Code Extension Architecture

### Overview

The **Emote** VS Code extension (`apps/emote/`) runs Ragdoll inside VS Code with AI control via MCP.

### Architecture

```
┌─────────────────────────────────────────┐
│        VS Code Extension Host           │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │   extension.ts (1145 lines)       │ │
│  │   - Command registration          │ │
│  │   - Socket server for MCP         │ │
│  │   - Configuration management      │ │
│  └────────────┬──────────────────────┘ │
│               │                         │
│  ┌────────────▼──────────────────────┐ │
│  │   ragdoll-panel.ts                │ │
│  │   - Webview lifecycle             │ │
│  │   - Message passing               │ │
│  └────────────┬──────────────────────┘ │
└───────────────┼─────────────────────────┘
                │ postMessage
┌───────────────▼─────────────────────────┐
│          Webview (React)                │
│                                         │
│  - RagdollCharacter component          │
│  - Full character control              │
└─────────────────────────────────────────┘

        ▲
        │ Unix Socket / Named Pipe
        │
┌───────┴─────────────────────────────────┐
│       MCP Server (mcp-server.ts)        │
│       - 763 lines                       │
│       - 20+ MCP tools                   │
│       - Validates and forwards commands │
└─────────────────────────────────────────┘
        ▲
        │ stdio (MCP Protocol)
        │
┌───────┴─────────────────────────────────┐
│       AI Assistant (Claude, etc.)       │
└─────────────────────────────────────────┘
```

### Inter-Process Communication

**Extension Host ↔ MCP Server:**

- **Transport:** Unix sockets (macOS/Linux) or Named Pipes (Windows)
- **Protocol:** Newline-delimited JSON
- **Location:** `~/.emote/mcp-server.js` (stable path)

**Extension Host ↔ Webview:**

- **Transport:** VS Code webview message passing
- **Protocol:** JSON messages
- **Security:** Webview runs in sandboxed iframe

**MCP Server ↔ AI Assistant:**

- **Transport:** stdio
- **Protocol:** Model Context Protocol (JSON-RPC)
- **Discovery:** Via Claude Desktop MCP configuration

### Key Design Decisions

1. **Separate MCP Server Process**
   - MCP requires stdio, but extension needs UI
   - Solution: Standalone server communicates via socket
   - Extension auto-installs server on activation

2. **Socket Communication**
   - Unix sockets for low-latency IPC
   - Newline-delimited JSON for simplicity
   - Validation at both ends

3. **Command Validation**
   - MCP server validates tool arguments
   - Extension validates commands before execution
   - Detailed error messages for debugging

## Plugin System

### Interface

```typescript
interface FeaturePlugin {
  onUpdate(deltaTime: number): void;
  reset(): void;
}
```

### Built-in Plugins

**PomodoroController** (`controllers/pomodoro-controller.ts`)

- Pomodoro timer functionality
- Work/break sessions
- Visual notifications

**TaskController** (`controllers/task-controller.ts`)

- Task list management
- Task completion tracking
- Display in sidebar

### Adding a Plugin

```typescript
class MyPlugin implements FeaturePlugin {
  onUpdate(deltaTime: number): void {
    // Called every frame
  }

  reset(): void {
    // Called when character resets
  }
}

// Register plugin
controller.registerPlugin(new MyPlugin());
```

### Why Plugins?

- **Extensibility**: Add features without modifying core
- **Isolation**: Plugins are self-contained
- **Testability**: Test plugins independently
- **Optional**: Core works without plugins

## Theme System

### Architecture

Themes define the visual appearance through color and gradient mappings.

**Theme Definition:**

```typescript
interface Theme {
  name: string;
  colors: Record<string, string>;
  gradients?: {
    linear?: Record<string, LinearGradient>;
    radial?: Record<string, RadialGradient>;
  };
}
```

### Built-in Themes

1. **Default**: Classic cartoon appearance
2. **Robot**: Metallic, mechanical look
3. **Alien**: Otherworldly color scheme
4. **Monochrome**: Grayscale aesthetic

### Runtime Theme Switching

```typescript
controller.setTheme(robotTheme);
```

Themes are applied by updating SVG fill and gradient references.

### Gradient Support

- **Linear gradients**: For smooth color transitions
- **Radial gradients**: For depth and lighting effects
- **Theme-scoped IDs**: Prevents gradient conflicts

## Data Flow

### Complete Flow Example: Setting an Expression

```
1. User/AI → "Set expression to happy"
   ↓
2. MCP Tool Call → ragdoll_set_expression({ expression: 'happy' })
   ↓
3. MCP Server → Validates and sends command via socket
   ↓
4. Extension Host → Receives command, validates again
   ↓
5. Webview Message → Posts message to webview
   ↓
6. React Handler → Calls controller.setExpression('happy')
   ↓
7. CharacterController → Delegates to ExpressionController
   ↓
8. ExpressionController → Updates StateManager
   ↓
9. StateManager → Emits 'expressionChanged' event
   ↓
10. EventBus → Notifies subscribers
   ↓
11. React Component → Re-renders with new expression
   ↓
12. Animation Loop → Interpolates to target expression
   ↓
13. SVG Update → Visual change on screen
```

### State Synchronization

- **Server Sessions**: Each session has its own controller and state
- **Webview State**: Managed by React state + controller
- **Persistence**: Optional (not currently implemented)

## Technology Stack

### Core Technologies

| Layer        | Technology | Version | Purpose                       |
| ------------ | ---------- | ------- | ----------------------------- |
| Runtime      | Bun        | Latest  | Package manager and runtime   |
| Language     | TypeScript | 5.9.3   | Type-safe development         |
| UI Framework | React      | 19      | Component-based UI            |
| Build Tool   | Vite       | 7       | Frontend build and dev server |
| Graphics     | SVG        | -       | 2D character rendering        |

### Backend

| Technology | Version | Purpose                  |
| ---------- | ------- | ------------------------ |
| Express    | 5       | REST API server          |
| Socket.io  | 4.8     | WebSocket communication  |
| MCP SDK    | 1.23.0  | AI assistant integration |

### VS Code Extension

| Technology               | Purpose             |
| ------------------------ | ------------------- |
| VS Code Extension API    | Extension framework |
| esbuild                  | Extension bundling  |
| Unix Sockets/Named Pipes | IPC with MCP server |

### Development Tools

| Tool           | Purpose          |
| -------------- | ---------------- |
| ESLint 9       | Linting          |
| Prettier       | Code formatting  |
| Docker         | Containerization |
| GitHub Actions | CI/CD            |

### Key Dependencies

**Minimal dependencies** in core package:

- React (peer dependency only)
- No animation frameworks
- No state management libraries
- Custom implementations for performance

## Performance Considerations

### Animation Performance

1. **SVG over Canvas**
   - Hardware-accelerated CSS transforms
   - No need to redraw entire canvas
   - Browser-optimized rendering

2. **RequestAnimationFrame**
   - Syncs with browser refresh rate
   - Automatic throttling when tab inactive
   - Efficient frame scheduling

3. **Capped Delta Time**

   ```typescript
   const deltaTime = Math.min(timestamp - lastTime, 100);
   ```

   - Prevents animation jumps when tab regains focus
   - Consistent animation speed

4. **State Batching**
   - Multiple state updates batched per frame
   - React's automatic batching (React 19)
   - Minimal re-renders

### Memory Management

1. **Cleanup**
   - Controllers clean up timers and subscriptions
   - Event listeners properly removed
   - No memory leaks in animation loop

2. **Session Management**
   - Sessions cleaned up when empty
   - No unbounded session growth
   - Periodic cleanup (could be improved)

### Network Efficiency

1. **WebSocket**
   - Binary protocol for efficiency
   - Automatic reconnection
   - Heartbeat for connection health

2. **Debouncing**
   - State updates debounced before sending
   - Reduces network traffic
   - Prevents flooding

### Bundle Size

- **Core package**: Minimal dependencies
- **Tree-shakable**: Use only what you need
- **Code splitting**: Vite automatic splitting

## Key Architectural Decisions

### 1. Why SVG instead of Canvas?

**Chosen:** SVG
**Alternatives:** Canvas, WebGL

**Rationale:**

- Declarative and theme-able
- Accessibility support
- CSS transforms for performance
- No need for complex 3D rendering
- Easier to debug and modify

### 2. Why Custom State Management?

**Chosen:** Custom EventBus + StateManager
**Alternatives:** Redux, MobX, Zustand

**Rationale:**

- Simple and tailored to character animation
- No external dependencies
- Full TypeScript support
- Performance-optimized for animation
- Easy to understand and maintain

### 3. Why Controller Pattern?

**Chosen:** Controller-based architecture
**Alternatives:** Hook-based, Service-based

**Rationale:**

- Clear separation of concerns
- Testable in isolation
- Composable (plugins)
- Familiar pattern for developers
- Easy to extend

### 4. Why Monorepo?

**Chosen:** Bun workspaces monorepo
**Alternatives:** Separate repositories

**Rationale:**

- Shared code and types
- Consistent tooling
- Easier cross-package changes
- Single source of truth
- Simplified development workflow

### 5. Why MCP for AI Integration?

**Chosen:** Model Context Protocol
**Alternatives:** Custom protocol, REST API only

**Rationale:**

- Standardized protocol for AI tools
- Works with multiple AI assistants
- Bidirectional communication
- Type-safe tool definitions
- Future-proof for AI ecosystem

### 6. Why Unix Sockets for Extension IPC?

**Chosen:** Unix sockets / Named pipes
**Alternatives:** HTTP localhost, VS Code messaging

**Rationale:**

- Low latency
- Secure (file system permissions)
- No port conflicts
- Efficient for local IPC
- Standard pattern for MCP servers

## Future Considerations

### Scalability

1. **Multi-user Support**
   - Currently session-based
   - Could add authentication
   - Rate limiting needed for production

2. **State Persistence**
   - No persistence currently
   - Could add database for sessions
   - Save/restore character state

### Extensibility

1. **Custom Themes**
   - Theme builder UI
   - User-created themes
   - Theme marketplace

2. **Animation Library**
   - Pre-built animation sequences
   - Custom animation creation
   - Keyframe editor

3. **More Plugins**
   - Weather display
   - Music visualizer
   - Code metrics
   - Git status indicator

### Performance

1. **Optimization**
   - WebGL renderer option for complex scenes
   - Worker threads for heavy computation
   - Virtual DOM diffing optimization

2. **Caching**
   - SVG path caching
   - Computed geometry caching
   - Theme gradient caching

### Testing

1. **Test Coverage**
   - Unit tests for all controllers
   - Integration tests for full flows
   - Visual regression tests for rendering
   - E2E tests for applications

2. **Performance Testing**
   - Benchmark animation performance
   - Memory leak detection
   - Load testing for API server

---

## Conclusion

Ragdoll's architecture demonstrates:

- **Separation of Concerns**: Clear boundaries between components
- **Extensibility**: Plugin system and theming
- **Performance**: Efficient SVG rendering and state management
- **Developer Experience**: TypeScript, hot reload, multiple control interfaces
- **AI Integration**: First-class MCP support

The architecture is designed for maintainability, testability, and future growth while keeping the core framework simple and performant.

For questions or contributions, see the main [README.md](./README.md) or open an issue on GitHub.
