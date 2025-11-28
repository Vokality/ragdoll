# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Ragdoll is a React + TypeScript + Vite application using React 19 with the React Compiler enabled for automatic optimization.

## Development Commands

- `npm run dev` - Start development server with HMR
- `npm run build` - Type check with `tsc -b` and build for production
- `npm run lint` - Run ESLint on the codebase
- `npm run preview` - Preview production build locally

## Engineering requirements
- Use kebab-case for all files
- Group files in packages by features
- Use DDD (domain-driven design)

## Architecture

### Tech Stack
- **React 19.2** with TypeScript
- **Vite 7.2** as build tool and dev server
- **React Compiler** (babel-plugin-react-compiler) - Enabled via Vite config for automatic component optimization
- **ESLint** with TypeScript, React Hooks, and React Refresh rules

### Project Structure
- `src/main.tsx` - Application entry point, renders App in StrictMode
- `src/App.tsx` - Root component
- `public/` - Static assets served at root
- `dist/` - Build output (ignored by ESLint)

### Configuration Files
- `vite.config.ts` - Vite configuration with React plugin and React Compiler enabled
- `eslint.config.js` - ESLint flat config with TypeScript and React rules
- `tsconfig.json` - Root TypeScript config with project references
- `tsconfig.app.json` - App-specific TypeScript config
- `tsconfig.node.json` - Node/build-specific TypeScript config

## Important Notes

### React Compiler
The React Compiler is enabled in this project via the Vite config (vite.config.ts:8-10). This impacts dev and build performance but provides automatic optimization. Components should be written following React best practices as the compiler will handle optimization automatically.

### TypeScript Configuration
The project uses TypeScript project references with separate configs for app code and build tooling. Always run `tsc -b` (as done in the build script) rather than plain `tsc`.
