# Extension development

An extension adds tools, state, and optionally an interactive card to Lumen. Lumen supplies the desktop services and draws the card. The Ragdoll extension framework itself has no dependency on Electron.

## Pick the right mechanism

| You need                                              | Use                                       |
| ----------------------------------------------------- | ----------------------------------------- |
| Tools from a remote service that already exists       | An [MCP connection](../mcp/index.md)      |
| Local logic, saved state, or a card                   | A Ragdoll extension                       |
| OS integration, credential storage, or app navigation | A host capability or an app-owned control |

Extensions can have tools and no card. A card doesn't need a tool for every button. When the agent should be able to do something the card does, give it a tool that calls the same function the card's button calls.

## Package contract

Export a named `createExtension(config?)` factory. Lumen loads installed packages through that factory. A bare extension object can't be loaded as a package; register it directly with a registry instead.

In `package.json`, add a `ragdollExtension` object with a stable ID, the entry file inside the package, the capability types the extension provides, and its required and optional host capabilities. Add configuration and OAuth schemas if the extension uses them. The ID and capability lists in `package.json` must match what the runtime factory declares.

## Entrypoints

| Import                                | Contains                                                      |
| ------------------------------------- | ------------------------------------------------------------- |
| `@vokality/ragdoll-extensions`        | React-free contracts, the registry, and the extension factory |
| `@vokality/ragdoll-extensions/loader` | Package discovery and loading through host adapters           |
| `@vokality/ragdoll-extensions/slots`  | React-free observable panel state                             |
| `@vokality/ragdoll-extensions/ui`     | Shared React components                                       |

Extensions can't import Electron, Lumen, or another first-party extension, and the core entrypoints can't import React. Storage, OAuth, configuration, notifications, filesystem access, and imports come from host adapters, where the host provides them.

Start with [your first extension](./first-extension.md), then read [cards and host capabilities](./cards-and-host.md).
