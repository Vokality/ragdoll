import { describe, expect, it } from "bun:test";
import type { SerializedSlotState } from "@vokality/ragdoll-extensions";
import type {
  SlotActionRequest,
  SlotChangeEvent,
} from "../../electron/electron-api";
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
  let selected: string | null = null;
  let selectionListener: ((slotId: string | null) => void) | null = null;
  let slotsListener: (() => void) | null = null;
  const actions: SlotActionRequest[] = [];
  const gateway: ExtensionSlotGateway = {
    getActiveExtensionCard: async () => selected,
    selectExtensionCard: async (slotId) => {
      selected = slotId;
      selectionListener?.(slotId);
      return { success: true };
    },
    onActiveExtensionCardChanged: (callback) => {
      selectionListener = callback;
      return () => {
        selectionListener = null;
      };
    },
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
    onExtensionSlotsChanged: (callback) => {
      slotsListener = callback;
      return () => {
        slotsListener = null;
      };
    },
    executeSlotAction: async (_slotId, request) => {
      actions.push(request);
      return { success: true };
    },
  };
  return {
    gateway,
    actions,
    getListener: () => listener,
    changeSlots: () => slotsListener?.(),
    getSelectionListener: () => selectionListener,
    selectFromAgent: (slotId: string | null) => {
      selected = slotId;
      selectionListener?.(slotId);
    },
  };
}

describe("ExtensionSlotService", () => {
  it("hydrates strict slot contracts and routes actions", async () => {
    const testGateway = createGateway(initialState);
    const service = new ExtensionSlotService(
      testGateway.gateway,
      () => undefined,
    );
    await service.start();

    const slot = service.getSnapshot()[0];
    expect(slot?.icon).toBe("checklist");
    const panel = slot?.state.getState().panel;
    expect(panel?.type).toBe("list");
    if (panel?.type !== "list") throw new Error("expected list panel");
    panel.items?.[0]?.onClick?.();
    await Promise.resolve();
    expect(testGateway.actions).toEqual([
      { actionType: "item-click", actionId: "task-1" },
    ]);

    service.stop();
    expect(testGateway.getListener()).toBeNull();
  });

  it("rejects a slot without state instead of fabricating defaults", async () => {
    const errors: unknown[] = [];
    const service = new ExtensionSlotService(
      createGateway(null).gateway,
      (error) => errors.push(error),
    );
    await service.start();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(Error);
    expect((errors[0] as Error).message).toBe(
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
        result: {
          title: "You win!",
          status: "success",
        },
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
    const service = new ExtensionSlotService(
      testGateway.gateway,
      () => undefined,
    );
    await service.start();

    const slot = service.getSnapshot()[0];
    const panel = slot?.state.getState().panel;
    expect(panel?.type).toBe("grid");
    if (panel?.type !== "grid") throw new Error("expected grid panel");
    expect(panel.result).toEqual({ title: "You win!", status: "success" });
    panel.cells[0]?.onClick?.();
    await Promise.resolve();
    expect(testGateway.actions).toEqual([
      { actionType: "cell-click", actionId: "1-1" },
    ]);
    expect(panel.cells[1]?.onClick).toBeUndefined();
    expect(panel.cells[2]?.onClick).toBeUndefined();

    service.stop();
  });

  it("hydrates cards panels and routes answer-submit with payload", async () => {
    const cardsState: SerializedSlotState = {
      badge: null,
      visible: true,
      panel: {
        type: "cards",
        title: "Review",
        status: { label: "Studying", tone: "active" },
        progress: { current: 1, total: 1 },
        card: {
          id: "card-1",
          attemptId: "attempt-1",
          front: "hola",
          back: "hello",
          face: "front",
        },
        answerInput: {
          id: "attempt-1",
          placeholder: "Answer",
          maxLength: 100,
        },
        canSubmit: true,
      },
    };
    const testGateway = createGateway(cardsState);
    const service = new ExtensionSlotService(
      testGateway.gateway,
      () => undefined,
    );
    await service.start();

    const slot = service.getSnapshot()[0];
    const panel = slot?.state.getState().panel;
    expect(panel?.status).toEqual({ label: "Studying", tone: "active" });
    expect(panel?.type).toBe("cards");
    if (panel?.type !== "cards" || panel.card.face !== "front") {
      throw new Error("expected front cards panel");
    }
    expect(panel.onSubmitAnswer).toBeTypeOf("function");
    await panel.onSubmitAnswer?.("hello");
    await Promise.resolve();
    expect(testGateway.actions).toEqual([
      {
        actionType: "answer-submit",
        actionId: "attempt-1",
        payload: "hello",
      },
    ]);

    service.stop();
  });
});

it("keeps slot updates that arrive before initial state resolves", async () => {
  const testGateway = createGateway(initialState);
  const state = Promise.withResolvers<SerializedSlotState | null>();
  testGateway.gateway.getSlotState = () => state.promise;
  const errors: unknown[] = [];
  const service = new ExtensionSlotService(testGateway.gateway, (error) =>
    errors.push(error),
  );
  const started = service.start();
  await Promise.resolve();
  expect(() =>
    testGateway.getListener()?.({
      slotId: "tasks.main",
      extensionId: "tasks",
      state: { ...initialState, badge: 3 },
    }),
  ).not.toThrow();
  state.resolve(initialState);
  await started;
  expect(service.getSnapshot()[0].state.getState().badge).toBe(3);
  expect(errors).toEqual([]);
  service.stop();
});

it("does not roll back live state when a reload returns an older snapshot", async () => {
  const testGateway = createGateway(initialState);
  const service = new ExtensionSlotService(testGateway.gateway, (error) => {
    throw error;
  });
  await service.start();
  const state = Promise.withResolvers<SerializedSlotState | null>();
  testGateway.gateway.getSlotState = () => state.promise;
  const published = Promise.withResolvers<void>();
  const unsubscribe = service.subscribe(() => published.resolve());
  testGateway.changeSlots();
  await Promise.resolve();
  testGateway.getListener()?.({
    slotId: "tasks.main",
    extensionId: "tasks",
    state: { ...initialState, badge: 4 },
  });
  expect(service.getSnapshot()[0].state.getState().badge).toBe(4);
  state.resolve(initialState);
  await published.promise;
  expect(service.getSnapshot()[0].state.getState().badge).toBe(4);
  unsubscribe();
  service.stop();
});

it("ignores a failed obsolete load after the service restarts", async () => {
  const testGateway = createGateway(initialState);
  const stale = Promise.withResolvers<SerializedSlotState | null>();
  const requested = Promise.withResolvers<void>();
  testGateway.gateway.getSlotState = () => {
    requested.resolve();
    return stale.promise;
  };
  const errors: unknown[] = [];
  const service = new ExtensionSlotService(testGateway.gateway, (error) =>
    errors.push(error),
  );
  const started = service.start();
  await requested.promise;
  service.stop();
  testGateway.gateway.getSlotState = async () => initialState;
  await service.start();
  stale.reject(new Error("obsolete"));
  await started;
  expect(errors).toEqual([]);
  expect(service.getSnapshot()).toHaveLength(1);
  expect(testGateway.getListener()).not.toBeNull();
  service.stop();
});

it("agent selections arriving during hydration survive stale snapshots and stop", async () => {
  const gateway = createGateway(initialState);
  const initial = Promise.withResolvers<string | null>();
  gateway.gateway.getActiveExtensionCard = () => initial.promise;
  const service = new ExtensionSlotService(gateway.gateway, (error) => {
    throw error;
  });
  const started = service.start();
  gateway.selectFromAgent("tasks.main");
  initial.resolve(null);
  await started;
  expect(service.getActiveCardSnapshot()).toBe("tasks.main");
  await service.selectCard(null);
  expect(service.getActiveCardSnapshot()).toBeNull();
  const late = gateway.getSelectionListener();
  service.stop();
  late?.("tasks.main");
  expect(service.getActiveCardSnapshot()).toBeNull();
  expect(gateway.getSelectionListener()).toBeNull();
});
