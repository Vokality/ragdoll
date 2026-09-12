# React Doctor remediation — September 12, 2026

React Doctor 0.9.14 reports **100/100, zero errors and zero warnings** for
`@vokality/ragdoll`, `@vokality/ragdoll-extensions`, and `lumen`. All three
scans completed with no skipped checks. The original full scan found 88
warnings across 30 files: 72 were resolved through code changes and 16 have
line-specific exceptions for intentional behavior. No rules or files are
disabled globally.

Run from the repository root:

```bash
REACT_DOCTOR_DISABLE_OXLINT_WORKER_POOL=1 bunx --bun react-doctor@0.9.14 . --yes --scope full --no-cache --json --json-out /tmp/ragdoll-react-doctor.json
```

The environment variable selects React Doctor's existing subprocess runner.
Its worker pool fails under Bun 1.4.2 with `child.channel.unref is not a
function`; this switch does not disable analysis. This is a React source
scan, not a dependency security audit or live provider test.

## Findings and disposition

1. **Deprecated Zod APIs — 52:** replaced strict object construction with
   `z.strictObject`, preserving unknown-key rejection and inferred types.
2. **Await in loops — 16:** parallelized five independent discovery and
   metadata lookup sites with `Promise.all`, preserving result order.
   Eleven intentionally sequential sites remain annotated: extension
   registration, teardown, event delivery, OAuth initialization, rollback,
   and agent tool execution. Those operations have observable ordering,
   failure, or cancellation semantics.
3. **React function complexity — 5:** split connection controls and draft
   parsing, extension configuration fields, profile editing/review, and
   card answer state into focused components and functions. Card attempts
   own their state through an `attemptId` key, so late results cannot
   overwrite the next attempt. The message reveal logic also has its own
   hook after the message identity change.
4. **JSON round-trip cloning — 2:** character test builders use
   `structuredClone`. Tool history keeps a documented exception because
   JSON serialization deliberately applies `toJSON` and drops non-JSON
   fields before storage; those semantics must match transport data.
5. **Repeated array membership checks — 2:** construct sets for optional
   extension capabilities and used/known memory-note IDs.
6. **Autofocus — 2:** removed forced focus from API-key and connection
   fields; removed it from the extracted profile editor as well.
7. **Loading cleanup — 2:** setup resets loading in `finally`. The
   extension configuration hook already resets it inside a guarded
   `finally`; its exception preserves the stale-request guard.
8. **Live state passed to parent — 1:** retained the character's
   `onControllerReady` contract with a specific exception. It hands out a
   stable imperative controller when mounted.
9. **Prop callback in effect — 1:** the same controller callback follows
   the effect lifecycle, exposing the existing controller to a changed
   callback and the new controller when a variant is mounted.
10. **Dynamic import path — 1:** retained a specific exception for the
    host-adapted extension loader. Installed extension entrypoints are
    discovered at runtime and cannot be statically bundled.
11. **Insecure crypto risk — 1:** renamed `longTermSignature` to
    `longTermSnapshot`. It compares profile content for summary
    invalidation and performs no cryptography.
12. **Lazy state initialization — 1:** connection draft initialization is
    a lazy initializer, with a typed draft and boundary validation on save.
13. **Array index keys — 1:** messages have backend-owned IDs persisted
    through storage, streaming IPC, and the renderer. Legacy messages
    receive IDs once at the serialized storage read boundary. Streaming
    handoff matches IDs even when replies repeat or saved text is trimmed;
    React keys and reveal state retain identity as visible history shifts.
14. **Multiple controls in one label — 1:** memory-note category and text
    have separate labels, with a shared layout wrapper.

## Dependencies

Direct dependencies were checked against the npm registry. Workspace
catalogs and `bun.lock` were updated using Bun 1.4.2; compatible transitive
dependencies were refreshed. `bun outdated --recursive` reports no outdated
workspace dependencies.

| Dependency        | Before  | After   |
| ----------------- | ------- | ------- |
| React / React DOM | 19.2.8  | 19.3.0  |
| React types       | 19.2.18 | 19.3.0  |
| React DOM types   | 19.2.7  | 19.3.0  |
| Zod               | 4.5.4   | 4.6.2   |
| Three.js          | 0.185.1 | 0.186.0 |
| Three.js types    | 0.185.4 | 0.186.0 |
| OpenAI SDK        | 7.10.0  | 7.15.0  |
| Electron          | 44.2.0  | 44.3.0  |
| Node types        | 26.4.1  | 26.5.1  |
| Bun types         | 1.4.1   | 1.4.2   |
| Oxlint            | 1.81.0  | 1.82.0  |

Other direct dependencies were already at their latest stable releases.
Node types retain the existing Node 26 line and use its newest release;
the registry's `latest` tag points to the older Node 22 line.

## Validation

- `bun run test`: 722 unit tests passed across the workspace.
- `bun run typecheck`: passed, including architecture boundary verification.
- `bun run lint`: passed.
- `bun run build`: passed; `bun run build:apps` passed again after the final
  renderer changes.
- `bun run docs:build`: passed at the time of this audit.
- `bun run test:browser`: 21 browser fixtures passed, plus the window lifecycle
  and real provider/chat preload IPC regressions. No React key or `act` warnings.
- `bun run verify:packages`: passed for 10 packages in an isolated Bun project.
- `bun outdated --recursive`: no outdated workspace dependencies.
- `bun install --frozen-lockfile`: passed with Bun 1.4.2.

New regressions cover concurrent legacy migration and ID persistence across
restart, repeated reply text, normalized streaming handoff, stable rendered
message nodes, separate accessible labels, deterministic concurrent
discovery/update checks, and real Electron preload/chat IPC across response
phases. Provider fixtures use injected transports and do not spend API
credits or establish live OpenAI/Grok availability.

One intermediate browser rerun overlapped a library rebuild and failed on
temporarily missing output; the final run above happened after the library
and package builds completed.
