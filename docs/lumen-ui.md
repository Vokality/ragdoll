# Lumen UI controls

Shared controls live in `apps/chat/src/components/ui`. Import them directly
from their modules; they are internal to Lumen and add no package dependency.

- `button.tsx`: `Button` and `IconButton`. Buttons default to `type="button"`.
  Choose `primary`, `secondary`, `ghost`, `danger`, or `plain` appearance.
  `loading` disables activation, exposes `aria-busy`, and renders a decorative
  spinner alongside `loadingLabel` (or the normal children). An explicitly
  disabled button stays disabled when loading ends. `IconButton` requires an
  accessible `aria-label`. An icon-only loading state also needs a label.
- `input.tsx`: `TextInput`, `Textarea`, `Select`, and `Checkbox` preserve
  native values, events, attributes, and React 19 refs. A numeric input still
  exposes `event.currentTarget.valueAsNumber`; callers validate domain values.
- `switch.tsx`: `Switch` takes `checked` and `onCheckedChange(next)` and
  renders a native button with `role="switch"` and `aria-checked`. Give it a
  stable accessible name. It retains native keyboard activation and disabled
  behavior without implementing a second keyboard handler.
- `field.tsx`: `Field` owns a visible label, stable control ID, optional
  description, and error. Its render callback supplies props to spread onto
  exactly one control. This works through wrappers and fragments without
  cloning children or losing types. `id`, when supplied, identifies the control.

```tsx
import { Button } from "./ui/button";
import { Field } from "./ui/field";
import { TextInput } from "./ui/input";

<Field label="Name" description="How Lumen should address you" error={error}>
  {(control) => (
    <TextInput
      {...control}
      value={name}
      onChange={(event) => setName(event.currentTarget.value)}
    />
  )}
</Field>;

<Button type="submit" variant="primary" loading={saving} loadingLabel="Saving…">
  Save
</Button>;
```

`Field.required` adds the visible marker and `aria-required`; use the native
control's `required` prop when browser constraint validation is appropriate.
Descriptions normally follow the control; `descriptionPosition="before"`
groups a description with the label, as in extension configuration. An error
sets `aria-invalid` and joins the description through `aria-describedby`.

Continue using native headings, paragraphs, sections, forms, fieldsets, and
labels for simple checkboxes. Shared CSS tokens and control styles remain in
`styles/global.css`; `ui/controls.css` owns field layout and invalid-state
styling. Screen styles may set layout, density, and specialized appearances.
Use the shared components for interactive controls rather than rebuilding
their loading, labeling, or toggle contracts in each screen.

Icons use [Phosphor](https://phosphoricons.com/) with the duotone weight,
inherited theme colors, and decorative SVGs inside named controls. Lumen
controls use `ui/icons.tsx`; extension icons resolve from the React-free
`PresetIconName` contract in `ragdoll-extensions/slots` through the `/ui`
registry. Import individual Phosphor modules so development builds only load
the glyphs in use.

Each built-in card has a distinct icon: Tasks uses a checklist, Working List
uses bullets, Notes uses a notebook, Flash Cards uses stacked cards, Pomodoro
uses a stopwatch, Tic-Tac-Toe uses a game controller, and Canvas uses a palette.
Character and Spotify provide tools without cards, so they have no dock icons.

The browser suite includes `tests/ui-controls.html` for native ref and event
forwarding, wrapped-control labels, hint/error associations, error recovery,
switch state, loading and disabled behavior, and default versus explicit form
submission. Existing browser fixtures exercise the migrated setup, settings,
profile, connections, extension configuration, and composer flows.
