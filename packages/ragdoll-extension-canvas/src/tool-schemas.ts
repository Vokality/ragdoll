import {
  z,
  canvasElementSchema,
  type ToolPropertySchema,
  type ToolParameterSchema,
} from "@vokality/ragdoll-extensions";

const number: ToolPropertySchema = { type: "number" };
const color: ToolPropertySchema = {
  type: "string",
  description: "Hex color (#rgb or #rrggbb), or none. No CSS expressions.",
};
const common: Record<string, ToolPropertySchema> = {
  id: {
    type: "string",
    description: "Stable element ID. Reuse it to replace an existing element.",
  },
  fill: color,
  stroke: color,
  strokeWidth: { type: "number", minimum: 0, maximum: 100 },
  opacity: { type: "number", minimum: 0, maximum: 1 },
};
function shape(
  type: string,
  fields: Record<string, ToolPropertySchema>,
): ToolPropertySchema {
  const properties = {
    type: { type: "string", enum: [type] } satisfies ToolPropertySchema,
    ...common,
    ...fields,
  };
  return {
    type: "object",
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}
const element: ToolPropertySchema = {
  type: "object",
  anyOf: [
    shape("rect", {
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number,
    }),
    shape("ellipse", { cx: number, cy: number, rx: number, ry: number }),
    shape("path", {
      d: {
        type: "string",
        description:
          "SVG path commands (M L C Q A Z etc.). Use paths for lines, arrows, and freeform drawings.",
      },
    }),
    shape("text", {
      x: number,
      y: number,
      text: { type: "string" },
      fontSize: number,
      anchor: { type: "string", enum: ["start", "middle", "end"] },
    }),
  ],
};
export const emptySchema = z.object({}).strict();
export const revisionSchema = z
  .object({ expectedRevision: z.number().int().nonnegative() })
  .strict();
export const editSchema = revisionSchema
  .extend({
    elements: z.array(canvasElementSchema).max(100),
    removeIds: z.array(z.string().min(1).max(80)).max(100),
  })
  .strict();
export const newSchema = revisionSchema
  .extend({
    title: z.string().trim().min(1).max(120),
    width: z.number().positive().max(10000),
    height: z.number().positive().max(10000),
    background: z.string().regex(/^(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6}|none)$/),
  })
  .strict();

export const emptyParameters: ToolParameterSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};
export const revisionParameters: ToolParameterSchema = {
  type: "object",
  properties: {
    expectedRevision: {
      type: "number",
      description:
        "Revision returned by canvas_get or the last successful edit.",
      minimum: 0,
    },
  },
  required: ["expectedRevision"],
  additionalProperties: false,
};
export const editParameters: ToolParameterSchema = {
  ...revisionParameters,
  properties: {
    ...revisionParameters.properties,
    elements: {
      type: "array",
      items: element,
      maxItems: 100,
      description:
        "Complete new or replacement elements, in back-to-front order. Existing IDs retain their layer positions.",
    },
    removeIds: { type: "array", items: { type: "string" }, maxItems: 100 },
  },
  required: ["expectedRevision", "elements", "removeIds"],
};
export const newParameters: ToolParameterSchema = {
  ...revisionParameters,
  properties: {
    ...revisionParameters.properties,
    title: { type: "string" },
    width: number,
    height: number,
    background: color,
  },
  required: ["expectedRevision", "title", "width", "height", "background"],
};
