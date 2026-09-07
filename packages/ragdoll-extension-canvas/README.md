# Canvas extension

An agent-operated vector drawing surface for Ragdoll. Register `createExtension()` with host `storage` and `logger` capabilities. The canonical descriptor is in `package.json#ragdollExtension`.

The `canvas.main` slot uses the framework's `canvas` panel. Its header shows the document title and dimensions, the content fits the drawing without cropping, and the footer holds Export SVG, Undo, and Clear. Opening and closing the card are host actions, independent of drawing.

## Agent tools

- `canvas_get {}`: read the document and current revision.
- `canvas_new { expectedRevision, title, width, height, background }`: replace it with a blank drawing.
- `canvas_draw { expectedRevision, elements, removeIds }`: atomically add or replace up to 100 complete elements and remove IDs. Existing IDs retain their layer order; new elements append in back-to-front order.
- `canvas_clear { expectedRevision }`: remove elements.
- `canvas_undo { expectedRevision }`: undo the last edit (up to 20 edits in the current extension session).
- `canvas_export {}`: return standalone SVG text.

Each successful edit returns the next revision and document. Read again after a revision conflict. Writes are serialized and published only after storage succeeds. Documents survive restarts; undo history is session-local.

## Drawing contract

Coordinates are SVG viewBox units with the origin at the top-left. Supported elements are rectangles, ellipses, paths (including lines, arrows, and curves), and text. Each element has a stable ID, fill, stroke, stroke width, and opacity. Colors are hex values or `none`. Arbitrary SVG markup, external images, scripts, and CSS are not accepted.

Documents contain at most 500 elements; a tool batch contains at most 100. Tool schemas describe the fields required by each element type. Use multiple batches for complex illustrations. Text uses a portable sans-serif font.

This version supports agent drawing and editing, rather than pointer-based freehand input.
