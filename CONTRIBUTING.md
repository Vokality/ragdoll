# Contributing

Engineering rules, package boundaries, and commands live in [AGENTS.md](./AGENTS.md). Architecture detail is in [ARCHITECTURE.md](./ARCHITECTURE.md). Keep [CLAUDE.md](./CLAUDE.md) aligned with AGENTS.md.

## Checks

From the repository root:

```bash
bun install --frozen-lockfile
bun run lint
bun run test
bun run typecheck
bun run verify:packages
```

Use Bun workspace filters for focused work. Do not add npm, pnpm, or Yarn lockfiles.
