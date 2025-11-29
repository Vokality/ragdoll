# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ragdoll is a monorepo containing an animated character framework and applications built with it.

## Monorepo Structure

```
ragdoll/
├── packages/
│   └── ragdoll/              # @vokality/ragdoll - core character framework
│       └── src/
│           ├── components/   # RagdollCharacter React component
│           ├── controllers/  # CharacterController, ExpressionController, etc.
│           ├── models/       # RagdollGeometry, RagdollSkeleton
│           ├── themes/       # Theme system (default, robot, alien, monochrome)
│           ├── types/        # TypeScript type definitions
│           └── animation/    # Easing functions
│
├── apps/
│   ├── demo/                 # Browser demo with control panel
│   │   └── src/
│   │       ├── ui/           # UI components (Scene, ControlPanel, etc.)
│   │       ├── api/          # Express server with WebSocket
│   │       └── mcp/          # MCP server for browser version
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
- **VS Code Extension API** - For Emote extension
- **MCP (Model Context Protocol)** - AI assistant control
