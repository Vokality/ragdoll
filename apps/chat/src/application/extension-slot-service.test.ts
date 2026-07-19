import { describe, expect, it } from "bun:test";
import type { SerializedSlotState } from "@vokality/ragdoll-extensions";
import type { SlotChangeEvent } from "../../electron/electron-api";
import {
  ExtensionSlotService,
  type ExtensionSlotGateway,
} from "./extension-slot-service";

const initialState: SerializedSlotState = {
  badge: null,
  visible: true,
  panel: {
    type: "list",
    title: "Tasks",
    items: [
      {
        id: "task-1",
        label: "One",
        canClick: true,
        canToggle: false,
      },
    ],
  },
};

function createGateway(state: SerializedSlotState | null) {
  let listener: ((event: SlotChangeEvent) => void) | null = null;
  const actions: string[] = [];
  const gateway: ExtensionSlotGateway = {
    getExtensionSlots: async () => [
      {
        extensionId: "tasks",
        slotId: "tasks.main",
        label: "Tasks",
        icon: "checklist",
        priority: 10,
      },
    ],
    getSlotState: async () => state,
    onSlotStateChanged: (callback) => {
      listener = callback;
      return () => {
        listener = null;
      };
    },
    onExtensionSlotsChanged: () => () => undefined,
    executeSlotAction: async (_slotId, actionType, actionId) => {
      actions.push(`${actionType}:${actionId}`);
      return { success: true };
    },
  };
  return { gateway, actions, getListener: () => listener };
}

describe("ExtensionSlotService", () => {
  it("hydrates strict slot contracts and routes actions", async () => {
    const testGateway = createGateway(initialState);
    const service = new ExtensionSlotService(testGateway.gateway);
    await service.start();

    const slot = service.getSnapshot()[0];
    expect(slot?.icon).toBe("checklist");
    const panel = slot?.state.getState().panel;
    expect(panel?.type).toBe("list");
    if (panel?.type !== "list") throw new Error("expected list panel");
    panel.items?.[0]?.onClick?.();
    await Promise.resolve();
    expect(testGateway.actions).toEqual(["item-click:task-1"]);

    service.stop();
    expect(testGateway.getListener()).toBeNull();
  });

  it("rejects a slot without state instead of fabricating defaults", async () => {
    const service = new ExtensionSlotService(createGateway(null).gateway);
    await expect(service.start()).rejects.toThrow(
      "Missing state for slot: tasks.main",
    );
  });

  it("hydrates grid cells and routes cell-click actions", async () => {
    const gridState: SerializedSlotState = {
      badge: null,
      visible: true,
      panel: {
        type: "grid",
        title: "Board",
        columns: 3,
        cells: [
          { id: "1-1", label: "", canClick: true },
          { id: "1-2", label: "X", canClick: false },
          {
            id: "1-3",
            label: "",
            disabled: true,
            canClick: true,
          },
        ],
      },
    };
    const testGateway = createGateway(gridState);
    const service = new ExtensionSlotService(testGateway.gateway);
    await service.start();

    const slot = service.getSnapshot()[0];
    const panel = slot?.state.getState().panel;
    expect(panel?.type).toBe("grid");
    if (panel?.type !== "grid") throw new Error("expected grid panel");
    panel.cells[0]?.onClick?.();
    await Promise.resolve();
    expect(testGateway.actions).toEqual(["cell-click:1-1"]);
    expect(panel.cells[1]?.onClick).toBeUndefined();
    expect(panel.cells[2]?.onClick).toBeUndefined();

    service.stop();
  });
});
