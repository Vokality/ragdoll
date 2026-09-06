# Engineering audit — 2026-09-06

This audit covered the character framework, extension framework and first-party extensions, Lumen's Electron and React layers, Emote's command transport, package boundaries, and verification workflows. Changes remain in the local worktree.

## Changes and evidence

| Area                                    | Corrected behavior                                                                                                                                                                                                                                     | Regression evidence                                                                                                                                                                                       |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron startup and shutdown           | Wait for initialization, admitted IPC and chat work before teardown; reject new work during shutdown; release failed windows and share pending window creation.                                                                                        | `apps/chat/electron/services/quit-coordinator.test.ts`, `apps/chat/electron/ipc/registrar.test.ts`, `apps/chat/electron/services/chat-application-service.test.ts`, `apps/chat/tests/window-lifecycle.ts` |
| Renderer authority and delivery         | Require the owned main frame and app document for IPC; stop delivery to destroyed renderers without interrupting durable chat completion; restrict external navigation to HTTPS.                                                                       | `apps/chat/electron/ipc/renderer-authority.test.ts`, `apps/chat/electron/services/send-renderer-event.test.ts`, `apps/chat/electron/services/external-navigation-service.test.ts`                         |
| Storage and installation                | Serialize mutations, preserve prior committed state on write failure, use private atomic writes, validate persisted extension state, retain recovery copies when rollback fails, and reject mismatched extension IDs.                                  | Tests alongside storage repositories, `extension-storage`, `write-private-file`, `extension-installer`, and `extension-operations-service`                                                                |
| Extension lifecycle and tool boundaries | Reserve IDs during activation, recheck capability ownership after replacement cleanup, wait for pending activations during destruction, surface cleanup failures, serialize host lifecycle mutations, and parse tool arguments before domain handlers. | `packages/ragdoll-extensions/tests/registry.test.ts`, `apps/chat/electron/services/extension-manager.test.ts`, first-party tool boundary tests                                                            |
| OAuth and configuration                 | Cancel retired authorization/refresh work, avoid immediate refresh loops for short-lived tokens, clear refresh timers on disconnect, serialize configuration persistence, and preserve live state after failed saves.                                  | `apps/chat/electron/services/oauth-manager.test.ts`, `oauth-loopback-service.test.ts`, `config-manager.test.ts`                                                                                           |
| Chat and React state                    | Recover missed completion without resending turns; ignore stale hydration and older acknowledgements; preserve edits during saves and installs; retain operation state for each extension row; prevent duplicate or conflicting actions.               | `apps/chat/src/application/chat-service.test.ts`, `extension-slot-service.test.ts`, configuration/settings/browser fixtures                                                                               |
| React interaction and rendering         | Preserve IME composition, use native modal focus and inertness, restore focus after close, handle Strict Mode setup/cleanup, maintain slot subscriptions, and dispose scene resources on variant replacement/unmount.                                  | `apps/chat/tests/{composer-input,panel-dialog,panel-actions,visible-slots,smooth-text}.html`, `packages/ragdoll/tests/renderers/lifecycle.html`                                                           |
| Emote transport                         | Preserve split UTF-8 input, execute commands in connection order, close clients on disposal, settle canceled startup, protect active sockets and unrelated files, and validate finite command arguments.                                               | `apps/emote/src/socket-command-server.test.ts`, `command-validator.test.ts`                                                                                                                               |
| Packages and CI                         | Preserve React-free core/loader/slot boundaries, verify packed artifacts outside the workspace, and run Electron regressions from disposable profiles in the configured CI workflows.                                                                  | `scripts/verify-architecture.ts`, `scripts/verify-packages.ts`, `.github/workflows/{test,release,emote-extension-publish}.yml`                                                                            |

## Verification

The final local run passed all six gates below: 637 tests across 11 workspaces, full app/library builds, type checking and architecture checks, repository lint, all nine packed packages, and the Electron suite. `git diff --check` also passed.

Run the repository gates from the root with Bun 1.4.2:

```sh
bun run build
bun run test
bun run typecheck
bun run lint
bun run verify:packages
bun run test:browser
```

The browser suite includes eight React/rendering fixture pages and a main-process window-load recovery check. On headless Linux, run it through `xvfb-run -a`.

A live macOS Lumen session was restarted from a rebuilt Electron bundle, reached Ready with a visible canvas, and completed an expression request through `setMood` to the renderer. The unit and browser regressions also cover failure and overlap paths that a successful live request cannot exercise.

Validation was performed locally on macOS. Linux CI, signed release packaging, and marketplace publication were not executed during this audit. The character's visual styling remains stylized; the renderer checks cover geometry/lifecycle behavior and expression delivery.
