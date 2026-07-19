import type {
  SerializedGridPanelCell,
  SerializedListPanelItem,
  SerializedListPanelSection,
  SerializedPanelAction,
  SerializedSlotState,
} from "@vokality/ragdoll-extensions";
import {
  createSlotState,
  type GridPanelCell,
  type ListPanelItem,
  type ListPanelSection,
  type MutableSlotStateStore,
  type PanelAction,
  type SlotState,
} from "@vokality/ragdoll-extensions/slots";
import type { ExtensionUISlot } from "@vokality/ragdoll-extensions/ui";
import type { ElectronAPI, SlotActionType } from "../../electron/electron-api";

export type ExtensionSlotGateway = Pick<
  ElectronAPI,
  | "executeSlotAction"
  | "getExtensionSlots"
  | "getSlotState"
  | "onExtensionSlotsChanged"
  | "onSlotStateChanged"
>;

export class ExtensionSlotService {
  private readonly stores = new Map<string, MutableSlotStateStore>();
  private readonly listeners = new Set<() => void>();
  private slots: ExtensionUISlot[] = [];
  private unsubscribe: (() => void) | null = null;
  private unsubscribeFromSlotChanges: (() => void) | null = null;
  private generation = 0;
  private loadRevision = 0;
  private startPromise: Promise<void> | null = null;

  constructor(private readonly api: ExtensionSlotGateway) {}

  readonly getSnapshot = (): ExtensionUISlot[] => this.slots;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  start(): Promise<void> {
    if (this.startPromise) return this.startPromise;
    const generation = ++this.generation;
    this.unsubscribe = this.api.onSlotStateChanged((event) => {
      if (generation !== this.generation) return;
      const store = this.stores.get(event.slotId);
      if (!store) {
        throw new Error(`Received state for unknown slot: ${event.slotId}`);
      }
      store.replaceState(this.attachActionHandlers(event.slotId, event.state));
    });
    this.unsubscribeFromSlotChanges = this.api.onExtensionSlotsChanged(() => {
      void this.reload(generation);
    });
    this.startPromise = this.load(generation, ++this.loadRevision);
    return this.startPromise;
  }

  stop(): void {
    this.generation++;
    this.loadRevision++;
    this.unsubscribe?.();
    this.unsubscribeFromSlotChanges?.();
    this.unsubscribe = null;
    this.unsubscribeFromSlotChanges = null;
    this.startPromise = null;
    this.stores.clear();
    this.slots = [];
  }

  private async load(generation: number, revision: number): Promise<void> {
    const metadata = await this.api.getExtensionSlots();
    const duplicateIds = metadata.filter(
      (slot, index) =>
        metadata.findIndex((candidate) => candidate.slotId === slot.slotId) !==
        index,
    );
    if (duplicateIds.length > 0) {
      throw new Error(`Duplicate slot id: ${duplicateIds[0]?.slotId}`);
    }

    const states = await Promise.all(
      metadata.map(async (slot) => {
        const state = await this.api.getSlotState(slot.slotId);
        if (!state) throw new Error(`Missing state for slot: ${slot.slotId}`);
        return [slot, state] as const;
      }),
    );
    if (generation !== this.generation || revision !== this.loadRevision)
      return;

    this.stores.clear();
    for (const [slot, state] of states) {
      this.stores.set(
        slot.slotId,
        createSlotState(this.attachActionHandlers(slot.slotId, state)),
      );
    }
    this.slots = metadata.map((slot) => ({
      id: slot.slotId,
      label: slot.label,
      icon: slot.icon,
      priority: slot.priority,
      state: this.requireStore(slot.slotId),
    }));
    for (const listener of this.listeners) listener();
  }

  private async reload(generation: number): Promise<void> {
    try {
      await this.load(generation, ++this.loadRevision);
    } catch (error) {
      console.error("Failed to refresh extension slots", error);
    }
  }

  private requireStore(slotId: string): MutableSlotStateStore {
    const store = this.stores.get(slotId);
    if (!store) throw new Error(`Slot store not initialized: ${slotId}`);
    return store;
  }

  private attachActionHandlers(
    slotId: string,
    state: SerializedSlotState,
  ): SlotState {
    const attachAction = (
      actionType: "panel-action" | "section-action",
      action: SerializedPanelAction,
    ): PanelAction => ({
      ...action,
      onClick: () => this.executeAction(slotId, actionType, action.id),
    });

    if (state.panel.type === "grid") {
      const attachCell = (cell: SerializedGridPanelCell): GridPanelCell => {
        const { canClick, ...metadata } = cell;
        return {
          ...metadata,
          onClick:
            canClick && !metadata.disabled
              ? () => this.executeAction(slotId, "cell-click", cell.id)
              : undefined,
        };
      };

      return {
        ...state,
        panel: {
          ...state.panel,
          actions: state.panel.actions?.map((action) =>
            attachAction("panel-action", action),
          ),
          cells: state.panel.cells.map(attachCell),
        },
      };
    }

    const attachItem = (item: SerializedListPanelItem): ListPanelItem => {
      const { canClick, canToggle, ...metadata } = item;
      return {
        ...metadata,
        onClick: canClick
          ? () => this.executeAction(slotId, "item-click", item.id)
          : undefined,
        onToggle: canToggle
          ? () => this.executeAction(slotId, "item-toggle", item.id)
          : undefined,
      };
    };
    const attachSection = (
      section: SerializedListPanelSection,
    ): ListPanelSection => ({
      ...section,
      actions: section.actions?.map((action) =>
        attachAction("section-action", action),
      ),
      items: section.items.map(attachItem),
    });

    return {
      ...state,
      panel: {
        ...state.panel,
        actions: state.panel.actions?.map((action) =>
          attachAction("panel-action", action),
        ),
        sections: state.panel.sections?.map(attachSection),
        items: state.panel.items?.map(attachItem),
      },
    };
  }

  private executeAction(
    slotId: string,
    actionType: SlotActionType,
    actionId: string,
  ): void {
    void this.api
      .executeSlotAction(slotId, actionType, actionId)
      .then((result) => {
        if (!result.success) throw new Error(result.error);
      })
      .catch((error) => console.error("Extension slot action failed", error));
  }
}
