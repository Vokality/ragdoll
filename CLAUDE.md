# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ragdoll is a monorepo containing an animated character framework and applications built with it.

## Monorepo Structure

```
ragdoll/
├── packages/
│   ├── ragdoll/              # @vokality/ragdoll - core character framework
│   │   └── src/
│   │       ├── components/   # RagdollCharacter React component
│   │       ├── controllers/  # CharacterController, ExpressionController, etc.
│   │       ├── models/       # RagdollGeometry, RagdollSkeleton
│   │       ├── themes/       # Theme system (default, robot, alien, monochrome)
│   │       ├── types/        # TypeScript type definitions
│   │       └── animation/    # Easing functions
│   │
│   └── ragdoll-extensions/   # @vokality/ragdoll-extensions - extension framework
│       └── src/
│           ├── types.ts      # Core types (ToolDefinition, RagdollExtension, etc.)
│           ├── registry.ts   # ExtensionRegistry - tool aggregation & execution
│           ├── create-extension.ts  # createExtension() factory
│           └── extensions/   # Built-in extensions
│               ├── character/  # Facial expression tools
│               ├── pomodoro/   # Timer tools
│               └── tasks/      # Task management tools
│
├── apps/
│   ├── demo/                 # Browser demo with control panel
│   │   └── src/
│   │       ├── ui/           # UI components (Scene, ControlPanel, etc.)
│   │       ├── api/          # Express server with WebSocket
│   │       └── mcp/          # MCP server for browser version
│   │
│   ├── chat/                 # Electron chat app with AI assistant
│   │   ├── src/              # React renderer (UI components, hooks, screens)
│   │   └── electron/         # Main process
│   │       └── services/     # ExtensionManager, OpenAI service
│   │
│   └── emote/                # VS Code extension
│       ├── src/              # Extension host code
│       └── webview/          # Webview React app
│
└── package.json              # Workspace root (bun workspaces)
```

## Development Commands

### Root

- `bun install` - Install all dependencies
- `bun run build` - Build all packages and apps

### Package: @vokality/ragdoll

- `cd packages/ragdoll && bun run build` - Build the core package
- `cd packages/ragdoll && bun run dev` - Watch mode

### Package: @vokality/ragdoll-extensions

- `cd packages/ragdoll-extensions && bun run build` - Build the extensions package
- `cd packages/ragdoll-extensions && bun run dev` - Watch mode

### App: Chat (Electron)

- `cd apps/chat && bun run electron:dev` - Start dev server with Electron
- `cd apps/chat && bun run build` - Build for production

### App: Demo

- `cd apps/demo && bun run dev` - Start dev server
- `cd apps/demo && bun run build` - Build for production
- `cd apps/demo && bun run server` - Start API server

### App: Emote (VS Code Extension)

- `cd apps/emote && bun run build` - Build extension
- `cd apps/emote && bunx @vscode/vsce package` - Package .vsix

## Engineering Requirements

- Use kebab-case for all files
- Group files in packages by features
- Use DDD (domain-driven design)
- Use bun for package management

## Tech Stack

- **Bun** - Package manager and runtime
- **React 19** with TypeScript
- **Vite** - Build tool for apps
- **TypeScript** - Compiled with tsc for packages
- **Electron** - Desktop app framework (Chat app)
- **VS Code Extension API** - For Emote extension
- **MCP (Model Context Protocol)** - AI assistant control

## Extension System

The `@vokality/ragdoll-extensions` package provides a flexible extension system:

- **createExtension(config)** - Factory to create custom extensions
- **ExtensionRegistry** - Manages extensions, aggregates tools, routes execution
- **Built-in extensions**: character, pomodoro, tasks

Extensions provide tools in OpenAI function-calling format. The registry:
1. Aggregates tools from all registered extensions
2. Validates tool arguments
3. Routes execution to the correct handler
4. Emits events when tools change

Usage pattern:
```typescript
const registry = createRegistry();
await registry.register(createCharacterExtension({ handler: {...} }));
const tools = registry.getAllTools(); // Pass to OpenAI
await registry.executeTool("setMood", { mood: "smile" });
```
