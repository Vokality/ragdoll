import {
  createExtension as defineExtension,
  createSlotState,
  canvasDocumentSchema,
  serializeCanvasSvg,
  z,
  type CanvasDocument,
  type ExtensionHostEnvironment,
  type ExtensionRuntimeContribution,
  type ExtensionTool,
  type RagdollExtension,
  type SlotState,
  type ToolParameterSchema,
  type ToolResult,
} from "@vokality/ragdoll-extensions";
import {
  emptySchema,
  revisionSchema,
  editSchema,
  newSchema,
  emptyParameters,
  revisionParameters,
  editParameters,
  newParameters,
} from "./tool-schemas.js";

const stateSchema = z
  .object({
    revision: z.number().int().nonnegative(),
    document: canvasDocumentSchema,
  })
  .strict();
const defaultDocument: CanvasDocument = {
  title: "Canvas",
  width: 640,
  height: 400,
  background: "#f8fafc",
  elements: [],
};
class EditError extends Error {}

async function createRuntime(
  host: ExtensionHostEnvironment,
): Promise<ExtensionRuntimeContribution> {
  if (!host.storage || !host.logger)
    throw new Error("Canvas requires storage and logger");
  const storage = host.storage;
  const logger = host.logger;
  const saved = await storage.read("canvas", "state");
  let state =
    saved === undefined
      ? { revision: 0, document: structuredClone(defaultDocument) }
      : stateSchema.parse(saved);
  let history: CanvasDocument[] = [];
  let queue: Promise<void> = Promise.resolve();
  let disposed = false;

  const slotState = createSlotState(project(), (error) =>
    logger.error("Canvas slot listener failed", { error: String(error) }),
  );
  function project(): SlotState {
    return {
      visible: true,
      badge: null,
      panel: {
        type: "canvas",
        title: state.document.title,
        document: structuredClone(state.document),
        status: {
          label: `${state.document.elements.length} elements · ${state.document.width} × ${state.document.height}`,
        },
        actions: [
          {
            id: "undo",
            label: "Undo",
            disabled: history.length === 0,
            onClick: async () => {
              await undo();
            },
          },
          {
            id: "clear",
            label: "Clear",
            disabled: state.document.elements.length === 0,
            onClick: async () => {
              await change(undefined, (document) => ({
                ...document,
                elements: [],
              }));
            },
          },
        ],
      },
    };
  }
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const pending = queue.then(() => {
      if (disposed) throw new Error("Canvas extension is unloaded");
      return operation();
    });
    queue = pending.then(
      () => undefined,
      () => undefined,
    );
    return pending;
  }
  function checkRevision(expected: number | undefined): void {
    if (expected !== undefined && expected !== state.revision) {
      throw new EditError(
        `Canvas changed. Current revision is ${state.revision}; call canvas_get before retrying.`,
      );
    }
  }
  async function commit(
    document: CanvasDocument,
    nextHistory: CanvasDocument[],
  ): Promise<ToolResult> {
    const next = {
      revision: state.revision + 1,
      document: canvasDocumentSchema.parse(document),
    };
    await storage.write("canvas", "state", structuredClone(next));
    state = next;
    history = nextHistory;
    slotState.replaceState(project());
    return { success: true, data: structuredClone(state) };
  }
  function change(
    expected: number | undefined,
    operation: (document: CanvasDocument) => CanvasDocument,
  ): Promise<ToolResult> {
    return enqueue(async () => {
      checkRevision(expected);
      return commit(
        operation(structuredClone(state.document)),
        [...history, state.document].slice(-20),
      );
    });
  }
  function undo(expected?: number): Promise<ToolResult> {
    return enqueue(async () => {
      checkRevision(expected);
      const previous = history.at(-1);
      if (!previous) throw new EditError("Nothing to undo");
      return commit(previous, history.slice(0, -1));
    });
  }
  function tool<T extends z.ZodType>(
    name: string,
    description: string,
    schema: T,
    parameters: ToolParameterSchema,
    run: (args: z.output<T>) => Promise<ToolResult>,
  ): ExtensionTool {
    return {
      definition: {
        type: "function",
        function: { name, description, parameters },
      },
      validate: (args) => {
        const result = schema.safeParse(args);
        return result.success
          ? { valid: true }
          : { valid: false, error: result.error.message, retryable: true };
      },
      handler: async (args) => {
        try {
          return await run(schema.parse(args));
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
            retryable:
              error instanceof EditError || error instanceof z.ZodError,
          };
        }
      },
    };
  }
  return {
    slots: [
      {
        id: "canvas.main",
        label: "Canvas",
        icon: "canvas",
        priority: 30,
        state: slotState,
      },
    ],
    tools: [
      tool(
        "canvas_get",
        "Read the current canvas document and revision before drawing or editing. Drawing does not open its card; use the host's card tools separately.",
        emptySchema,
        emptyParameters,
        () =>
          enqueue(async () => ({
            success: true,
            data: structuredClone(state),
          })),
      ),
      tool(
        "canvas_new",
        "Start a new blank drawing with a title, dimensions, and background. Replaces the drawing; can be undone. Coordinates start at the top-left.",
        newSchema,
        newParameters,
        ({ expectedRevision, ...document }) =>
          change(expectedRevision, () => ({ ...document, elements: [] })),
      ),
      tool(
        "canvas_draw",
        "Apply a batch of vector drawing edits atomically. Add or replace shapes, paths, and text by ID; remove IDs separately. Use multiple batches for complex drawings. Supply all style fields; use fill none for open strokes. SVG paths can form arrows and curves.",
        editSchema,
        editParameters,
        ({ expectedRevision, elements, removeIds }) =>
          change(expectedRevision, (document) => {
            const ids = new Set(elements.map((element) => element.id));
            if (ids.size !== elements.length)
              throw new EditError("Duplicate element IDs in edit");
            if (removeIds.some((id) => ids.has(id)))
              throw new EditError("Cannot remove and replace the same ID");
            const existing = new Map(
              document.elements.map((element) => [element.id, element]),
            );
            for (const id of removeIds) {
              if (!existing.delete(id))
                throw new EditError(`Unknown element: ${id}`);
            }
            for (const element of elements) existing.set(element.id, element);
            return { ...document, elements: [...existing.values()] };
          }),
      ),
      tool(
        "canvas_clear",
        "Remove all drawing elements while retaining the canvas title, size, and background. Can be undone.",
        revisionSchema,
        revisionParameters,
        ({ expectedRevision }) =>
          change(expectedRevision, (document) => ({
            ...document,
            elements: [],
          })),
      ),
      tool(
        "canvas_undo",
        "Undo the last drawing edit in this session. Returns the updated document and revision.",
        revisionSchema,
        revisionParameters,
        ({ expectedRevision }) => undo(expectedRevision),
      ),
      tool(
        "canvas_export",
        "Return the current drawing as standalone SVG text. The canvas card also has an Export SVG download control.",
        emptySchema,
        emptyParameters,
        () =>
          enqueue(async () => ({
            success: true,
            data: {
              revision: state.revision,
              svg: serializeCanvasSvg(state.document),
            },
          })),
      ),
    ],
    dispose: async () => {
      disposed = true;
      await queue;
      history = [];
    },
  };
}

export function createExtension(): RagdollExtension {
  return defineExtension({
    id: "canvas",
    name: "Canvas",
    version: "0.1.0",
    description: "Draw and edit illustrations and diagrams",
    requiredCapabilities: ["storage", "logger"],
    optionalCapabilities: [],
    createRuntime,
  });
}
