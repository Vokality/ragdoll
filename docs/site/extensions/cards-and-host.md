# Cards and host capabilities

## Panel regions

An extension describes what its panel contains. Lumen's renderer decides spacing, scrolling, and control sizes so every panel fits the compact card.

| Region   | Contract                                     | Guidance                                                                        |
| -------- | -------------------------------------------- | ------------------------------------------------------------------------------- |
| Identity | `PanelFrame.title`                           | Keep the name stable. The host leaves room for the avatar and the close button. |
| State    | `status`, `progress`                         | Put changing state here, not in placeholder list rows.                          |
| Content  | List, grid, cards, canvas, or document panel | Pick the shape that fits the data.                                              |
| Controls | `PanelFrame.actions`, study `answerInput`    | Keep action labels short. The footer stays visible while content scrolls.       |

Lists fit collections that grow. Grids fit fixed-size boards. Study cards have a front and a revealed side, plus answer or rating controls. A canvas panel holds a `CanvasDocument` of typed rectangles, ellipses, paths, and text; it never holds raw SVG. A document panel shows a long plain-text body that scrolls.

The [panel contract](https://github.com/Vokality/ragdoll/blob/main/docs/extension-card-layout.md) and the [first-party extensions](https://github.com/Vokality/ragdoll/tree/main/packages) have complete examples.

## State and action routing

Slots hold React-free observable state. Before a slot crosses Electron IPC, Lumen runs `serializeSlotState` on it. That strips the callbacks and records which actions are available as `canClick`, `canToggle`, and `canSubmit`. When the user clicks, the renderer sends an action descriptor back, and the host routes it to the callback that owns it.

Don't send functions over IPC, don't build a second routing path for actions, and don't assume the panel is as big as the window. Domain state belongs in the extension; layout belongs to the shared renderer.

An action ID has to name the thing it acts on. Notes gives the selected note's Delete button the ID `delete:<noteId>`. If the selection changes while a click is still on its way to the host, the host rejects the stale ID and the newly selected note survives. Keep an ID the same for as long as it points at the same target.

## Document cards and persistence

For long text, use a `document` panel with a `title`, a plain-text `body`, and optional footer `actions`. The renderer keeps line breaks and keeps the controls on screen while the body scrolls. Any markup in the body is shown as literal text.

Notes validates its `{ notes }` document and saves it through host storage before it updates the slot. Which note is open is view state that lives only at runtime, so opening a note or going back to the list doesn't write to storage. Writing or selecting a note updates the `notes.main` slot without opening the card; opening the card is the host's `lumen_open_card` tool's job.

## Card visibility belongs to Lumen

The agent shows and hides cards with `lumen_list_cards`, `lumen_open_card`, and `lumen_close_card`, which are separate from any extension's actions. Once a slot is registered as visible, the agent can find it without the extension importing any app code.

Closing a card doesn't stop a timer or unload the extension. If the agent should be able to stop a timer or clear a drawing, give it a tool for that.

## Host capabilities

Declare required and optional host capabilities in both the package descriptor and the runtime factory, with identical lists. An `ExtensionHostEnvironment` advertises a capability only if it implements it.

Mark a capability required when the extension can't work without it. Check that an optional capability is present before using it. Credentials belong in host-owned configuration and OAuth services, never in extension storage or panel state.

For OAuth, declare the provider endpoints, the scopes, the configuration key for the public client ID, and PKCE support in the package metadata. Lumen handles checking that configuration is ready, the system-browser login, the loopback callback, token encryption, and refresh. See the [host OAuth contract](https://github.com/Vokality/ragdoll/blob/main/docs/extension-host-oauth.md).

## Lifecycle and conversation context

Anything `createRuntime` creates should be released by the `dispose` callback on the contribution it returns. The factory also accepts `onDestroy` for lifecycle cleanup. Test unregistering and reloading the extension. Closing a card is not a cleanup signal.

To put extension activity into the agent's context, use the host's [conversation events](https://github.com/Vokality/ragdoll/blob/main/docs/conversation-events.md). Only report operations that finished and state that changed; never fake an assistant message or a success result.
