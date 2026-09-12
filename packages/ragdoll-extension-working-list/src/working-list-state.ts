import {
  z,
  type ToolParameterSchema,
  type ToolPropertySchema,
} from "@vokality/ragdoll-extensions";

export const MAX_WORKING_LIST_ITEMS = 5;
export const DEFAULT_WORKING_LIST_TITLE = "To handle";

const titleSchema = z.string().trim().min(1).max(80);
const itemIdSchema = z.string().trim().min(1).max(200);

export const workingListItemSchema = z.strictObject({
  id: itemIdSchema,
  label: z.string().trim().min(1).max(120),
  sublabel: z.string().trim().min(1).max(160).optional(),
  ref: z.string().trim().min(1).max(500).optional(),
});

export const workingListItemsSchema = z
  .array(workingListItemSchema)
  .max(MAX_WORKING_LIST_ITEMS)
  .superRefine((items, context) => {
    const ids = new Set<string>();
    for (const [index, item] of items.entries()) {
      if (ids.has(item.id)) {
        context.addIssue({
          code: "custom",
          message: "Working list item IDs must be unique",
          path: [index, "id"],
        });
        return;
      }
      ids.add(item.id);
    }
  });

export const setItemsArgsSchema = z.strictObject({
  title: titleSchema,
  items: workingListItemsSchema,
});

export const workingListStateSchema = z.strictObject({
  title: titleSchema,
  items: workingListItemsSchema,
  updatedAt: z.number().int().nonnegative(),
});

export const removeItemArgsSchema = z.strictObject({
  itemId: itemIdSchema,
});

export const emptyArgsSchema = z.strictObject({});

export type WorkingListItem = z.infer<typeof workingListItemSchema>;
export type WorkingListState = z.infer<typeof workingListStateSchema>;

export function emptyWorkingListState(now: number): WorkingListState {
  return {
    title: DEFAULT_WORKING_LIST_TITLE,
    items: [],
    updatedAt: now,
  };
}

const itemParameters: ToolPropertySchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "label"],
  properties: {
    id: {
      type: "string",
      maxLength: 200,
      description: "Stable id for this row",
    },
    label: {
      type: "string",
      maxLength: 120,
      description: "Primary text",
    },
    sublabel: {
      type: "string",
      maxLength: 160,
      description: "Secondary text such as sender or due time",
    },
    ref: {
      type: "string",
      maxLength: 500,
      description: "Opaque source identity (for example an email id)",
    },
  },
};

export const emptyParameters: ToolParameterSchema = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

export const setItemsParameters: ToolParameterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "items"],
  properties: {
    title: {
      type: "string",
      maxLength: 80,
      description: "Stable list title shown in the card header",
    },
    items: {
      type: "array",
      description: "Ranked items, most important first",
      maxItems: MAX_WORKING_LIST_ITEMS,
      items: itemParameters,
    },
  },
};

export const removeItemParameters: ToolParameterSchema = {
  type: "object",
  additionalProperties: false,
  required: ["itemId"],
  properties: {
    itemId: {
      type: "string",
      maxLength: 200,
      description: "The item id from working_list_set_items",
    },
  },
};
