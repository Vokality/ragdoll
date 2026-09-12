import { z } from "zod";

/** A bounded vector document. Coordinates use the document's viewBox units. */
const coordinate = z.number().finite().min(-10000).max(10000);
const size = z.number().finite().positive().max(10000);
const paint = z.string().regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|none)$/);
const base = {
  id: z.string().min(1).max(80),
  fill: paint,
  stroke: paint,
  strokeWidth: z.number().finite().min(0).max(100),
  opacity: z.number().finite().min(0).max(1),
};
export const canvasElementSchema = z.discriminatedUnion("type", [
  z.strictObject({
    ...base,
    type: z.literal("rect"),
    x: coordinate,
    y: coordinate,
    width: size,
    height: size,
    radius: z.number().min(0).max(500),
  }),
  z.strictObject({
    ...base,
    type: z.literal("ellipse"),
    cx: coordinate,
    cy: coordinate,
    rx: size,
    ry: size,
  }),
  z.strictObject({
    ...base,
    type: z.literal("path"),
    d: z
      .string()
      .min(1)
      .max(12000)
      .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9eE+.,\s-]+$/),
  }),
  z.strictObject({
    ...base,
    type: z.literal("text"),
    x: coordinate,
    y: coordinate,
    text: z.string().min(1).max(2000),
    fontSize: z.number().positive().max(300),
    anchor: z.enum(["start", "middle", "end"]),
  }),
]);
export type CanvasElement = z.infer<typeof canvasElementSchema>;
export const canvasDocumentSchema = z
  .strictObject({
    title: z.string().trim().min(1).max(120),
    width: size,
    height: size,
    background: paint,
    elements: z.array(canvasElementSchema).max(500),
  })
  .refine(
    (document) =>
      new Set(document.elements.map((element) => element.id)).size ===
      document.elements.length,
    "Canvas element IDs must be unique",
  );
export type CanvasDocument = z.infer<typeof canvasDocumentSchema>;

function escapeXml(value: string | number): string {
  return String(value).replace(/[&<>"']/g, (character) => {
    switch (character) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      default:
        return "&apos;";
    }
  });
}

/** Export inert SVG: no markup, scripts, remote resources, or arbitrary attributes. */
export function serializeCanvasSvg(document: CanvasDocument): string {
  const validated = canvasDocumentSchema.parse(document);
  const elements = validated.elements
    .map((element) => {
      const attributes = `fill="${element.fill}" stroke="${element.stroke}" stroke-width="${element.strokeWidth}" opacity="${element.opacity}"`;
      switch (element.type) {
        case "rect":
          return `<rect ${attributes} x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.radius}"/>`;
        case "ellipse":
          return `<ellipse ${attributes} cx="${element.cx}" cy="${element.cy}" rx="${element.rx}" ry="${element.ry}"/>`;
        case "path":
          return `<path ${attributes} d="${escapeXml(element.d)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        case "text":
          return `<text ${attributes} x="${element.x}" y="${element.y}" font-size="${element.fontSize}" font-family="sans-serif" text-anchor="${element.anchor}">${escapeXml(element.text)}</text>`;
      }
    })
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${validated.width}" height="${validated.height}" viewBox="0 0 ${validated.width} ${validated.height}"><title>${escapeXml(validated.title)}</title><rect width="100%" height="100%" fill="${validated.background}"/>${elements}</svg>`;
}
