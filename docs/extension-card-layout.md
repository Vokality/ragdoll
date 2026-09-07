# Extension card layout

Extension panels describe semantic content. The shared UI renderer owns geometry,
control sizing, scrolling, and placement. Both the inline card and modal host use
one layout. Extensions must not assume a viewport height or render their own
header or action bar.

## Regions

| Region   | Contract                                                    | Rendering responsibility                                                                                                                                         |
| -------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity | `PanelFrame.title`                                          | Fixed header, stable extension name, host-reserved leading avatar space, close control on the right.                                                             |
| State    | `PanelFrame.status`, `PanelFrame.progress`                  | Compact header state and progress; use these instead of adding status rows to a list or replacing the title with a changing state.                               |
| Content  | `ListPanelConfig`, `GridPanelConfig`, or `CardsPanelConfig` | Takes the remaining height. Lists scroll; boards fit the available width and height; study text scrolls within its face.                                         |
| Controls | `PanelFrame.actions`, study `answerInput`                   | Fixed footer, ordered actions, consistent button sizing. Study answer input and submit occupy this same region. Controls remain available while content scrolls. |

`PanelFrame` is the shared React-free contract inherited by each panel kind.
`PanelProgress` is shared across kinds. `status` and `progress` are optional because
some panels have no meaningful state or progress. Study panels require progress.
The front/revealed study union continues to determine whether submission or rating
is available; the layout does not introduce a second interaction state machine.

Actions keep their stable IDs and callbacks. `serializeSlotState` removes callbacks
before IPC, and the host restores action routing to the owning extension. Region
metadata passes through that same contract. Layout changes do not create new IPC
channels or alternate action paths.

## Authoring

- Keep the title stable. Put “Your turn”, “Paused”, and similar state in `status`.
- Use short action labels and one primary action where possible. Preserve array
  order; the renderer does not infer priority from an extension-specific ID.
- Keep section actions attached to their section. Panel actions always go in the
  footer, including empty and completed states.
- Choose lists for growing collections and small grids for bounded boards. Avoid
  using list rows to simulate toolbars, progress bars, or forms.
- Use `answerInput` for study submission. It stays beside the other footer controls;
  the host handles pending and failed submissions without replacing the input.
- Supply meaningful empty messages that explain the next step in user language.

Lumen supplies the card bounds and avatar inset. The shared renderer determines
body geometry from those bounds, including board aspect ratio. It does not rely
on a Lumen-specific board width or a bottom-sheet viewport calculation. Extra
footer actions remain reachable by horizontal scrolling; content never pushes
the footer out of the card. Hosts should provide enough height for the fixed
header and controls plus a usable content area; Lumen reserves at least 260px.

`apps/chat/tests/character-card.html` exercises both 480×800 and 400×600 hosts,
including long lists, long study text, board containment, pinned controls,
persistent character canvas, and a visible, interactive chat composer.

## Agent control

Lumen exposes separate app-owned tools: `lumen_list_cards`, `lumen_open_card`
(with an available `slotId`), and `lumen_close_card`. These tools control
presentation only. Reading tasks, starting a timer, and playing a move remain
independent extension actions. An extension does not need to add card-opening
metadata or depend on the app to participate; its registered visible slots are
already discoverable through the host.

`AppToolService` combines extension tools with app controls for the agent.
`ExtensionCardService` owns the current selection in Electron, and both agent
calls and authorized toolbar IPC use it. Selection changes are published to the
renderer, including changes received during slot hydration. Unknown or hidden
cards cannot be opened; hiding or unregistering the active slot closes it.
Closing a card does not dispose its extension or cancel its activity.

App-control tool names are reserved and cannot be shadowed by extension tools.

## Canvas panels

A `CanvasPanelConfig` contributes a typed `CanvasDocument` to the standard header/content/footer layout. The React-free contract, schemas, and SVG exporter are available from the extension framework's core and slots entrypoints. `CanvasPanel` is available from `/ui`; it fits SVG viewBox coordinates into the available body space while preserving aspect ratio.

Canvas elements are a discriminated union of rectangles, ellipses, paths, and text. The drawing contains data, never arbitrary SVG markup or callbacks. `serializeSlotState` copies the document and removes footer callbacks; hosts restore standard `panel-action` handlers as for other panel types. Export SVG is a local renderer download control.

The first-party `@vokality/ragdoll-extension-canvas` package owns document persistence, revisions, batch edits, and undo. It contributes `canvas.main`; the host's existing card tools control its visibility independently.
