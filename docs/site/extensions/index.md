# Extension development

Extensions add domain tools, state, and optional interactive cards. Lumen supplies desktop services and renders their UI. The underlying Ragdoll extension framework remains independent of Electron.

## Choose the integration boundary

| You need | Use |
| --- | --- |
| Tools from an existing remote service | An [MCP connection](../mcp/index.md) |
| Local domain behavior, persistent state, or a card | A Ragdoll extension |
| OS integration, credential storage, or app navigation | A host capability or app-owned control |

An extension can contribute tools without a card. A card can expose controls without duplicating every control as a tool. If the agent should perform an action, expose that action through a tool backed by the same domain operation as the UI.

## Package contract

Export a named `createExtension(config?)` factory. Installed packages are loaded through that factory; a bare extension object is registered directly with a registry, not passed to the package loader.

Declare an object under `package.json#ragdollExtension` containing a stable ID, in-package entry, contributed capability types, and required and optional host capabilities. Add configuration and OAuth schemas when needed. Package metadata and runtime identity and capability declarations must agree.

## Imports and ownership

- `@vokality/ragdoll-extensions`: React-free domain contracts, registry, and extension factory.
- `@vokality/ragdoll-extensions/loader`: package discovery and loading through host adapters.
- `@vokality/ragdoll-extensions/slots`: React-free observable panel state.
- `@vokality/ragdoll-extensions/ui`: shared React rendering.

Extensions must not import Electron, Lumen, another first-party extension, or React through core entrypoints. Hosts provide storage, OAuth, configuration, notifications, filesystem, and import adapters where supported.

Start with [your first extension](./first-extension.md), then read about [cards and host capabilities](./cards-and-host.md).
