# Cards and host capabilities

## Use the shared panel regions

Extensions describe semantic panel state. The renderer owns spacing, scrolling, and control sizes so panels fit Lumen's compact card.

| Region | Contract | Guidance |
| --- | --- | --- |
| Identity | `PanelFrame.title` | Keep the name stable; the host reserves avatar and close-control space. |
| State | `status`, `progress` | Show changing state here instead of adding fake list rows. |
| Content | List, grid, cards, or canvas panel | Choose the shape that matches the domain. |
| Controls | `PanelFrame.actions`, study `answerInput` | Use short action labels; the shared footer stays reachable. |

Lists suit growing collections; grids suit bounded boards; study cards provide front/revealed states and submission or rating controls. Canvas panels carry typed rectangles, ellipses, paths, and text in a `CanvasDocument`, rather than arbitrary SVG markup.

See the [panel contract](https://github.com/Vokality/ragdoll/blob/main/docs/extension-card-layout.md) and [first-party extension implementations](https://github.com/Vokality/ragdoll/tree/main/packages) for complete examples.

## State and action routing

Slots contain React-free observable state. Before crossing Electron IPC, Lumen uses `serializeSlotState` to remove callbacks while preserving action availability as `canClick`, `canToggle`, and `canSubmit`. The renderer sends an action descriptor back to the owning callback.

Do not send functions across IPC, build a second action-routing path, or assume a window-sized panel. Keep domain state in the extension and layout in the shared renderer.

## Card visibility belongs to Lumen

The agent uses `lumen_list_cards`, `lumen_open_card`, and `lumen_close_card` to control presentation independently of extension actions. A registered visible slot is discoverable without the extension importing app code.

Closing a card does not stop a timer or unload an extension. Expose a separate tool for stopping a timer, clearing a drawing, or any other domain action.

## Request host capabilities

Declare required and optional host capabilities in both the package descriptor and runtime factory. The lists must match exactly. An `ExtensionHostEnvironment` advertises a capability only when its corresponding implementation exists.

Use required capabilities for features your extension cannot function without. Check optional capabilities before using them. Keep credentials in host-owned config and OAuth services, not extension storage or panel state.

For OAuth integrations, declare provider endpoints, scopes, the public client ID configuration key, and PKCE support in the package metadata. Lumen handles configuration readiness, system-browser login, loopback callbacks, encrypted tokens, and refresh. See the [host OAuth contract](https://github.com/Vokality/ragdoll/blob/main/docs/extension-host-oauth.md).

## Lifecycle and conversation context

Release subscriptions and timers through the extension's lifecycle cleanup (`onDestroy` when using the factory). Test unregistering and reloading; closing a card is not a lifecycle cleanup signal.

For activity that should enter agent context, use the host's documented [conversation events](https://github.com/Vokality/ragdoll/blob/main/docs/conversation-events.md). Report completed operations and real state changes. Do not manufacture assistant messages or success results to simulate model activity.
