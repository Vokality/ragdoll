# Repository guidance

Ragdoll is a Bun 1.3.14 workspace monorepo using React and strict TypeScript.

## Commands

Run all commands from the repository root unless a package-specific command is required.

```bash
bun install --frozen-lockfile
bun run build
bun run test
bun run typecheck
bun run lint
```

Use workspace filters for focused work:

```bash
bun run --filter @vokality/ragdoll-extensions test
bun run --filter lumen typecheck
bun run --filter emote build
```

Do not add npm, pnpm, or Yarn lockfiles or scripts. Do not execute tools by hardcoding paths under `node_modules`; use `bun run` for package scripts and `bunx --bun` for package binaries.

## Boundaries

- `@vokality/ragdoll` owns the React character framework.
- `@vokality/ragdoll-extensions` default entrypoint is React-free.
- `@vokality/ragdoll-extensions/loader` is host-adapter-driven.
- `@vokality/ragdoll-extensions/slots` is React-free.
- `@vokality/ragdoll-extensions/ui` is the only React UI entrypoint.
- First-party extension packages depend on the extension framework, never an app or another extension.
- Apps provide storage, IPC, notifications, config, OAuth, filesystem, and import adapters.

Do not add compatibility reexports or restore deleted entrypoints. Add a new public entrypoint only for a genuine runtime boundary.

## Extension contract

An extension package exports `createExtension(config?)` or an extension object supported by the loader. Its `ragdollExtension` package metadata must declare:

- stable ID and entrypoint;
- provided capability types;
- required host capabilities;
- config and OAuth schemas when applicable.

Registration requires an `ExtensionHostEnvironment`. Runtime services must be injected through that environment; shared extension packages must not import Electron or an app implementation.

Slots contain React-free observable state. Serialize them before IPC and route action descriptors back to the owning callback.

## Engineering rules

- Keep TypeScript strict and avoid `any`.
- Preserve package dependency direction.
- Keep React imports out of core and loader entrypoints.
- Clean only the workspace's own generated output.
- Add regression coverage for lifecycle, loading, and IPC behavior changes.
- Keep changes scoped; remove stale paths, commands, and docs instead of retaining compatibility guidance.
