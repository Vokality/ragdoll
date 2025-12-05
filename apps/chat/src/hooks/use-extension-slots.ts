import { useState, useEffect, useRef } from "react";
import type { ExtensionUISlot, SlotIcon, PresetIconName } from "@vokality/ragdoll-extensions";
import { createSlotState } from "@vokality/ragdoll-extensions";

/**
 * Slot metadata received from main process via IPC.
 * Icons are serialized as strings (preset names) since component functions can't cross IPC.
 */
interface SlotMetadata {
  extensionId: string;
  slotId: string;
  label: string;
  icon: string | { type: "component" };
  priority: number;
}

/**
 * Convert serialized icon (from IPC) to SlotIcon type.
 */
function toSlotIcon(icon: string | { type: "component" }): SlotIcon {
  if (typeof icon === "string") {
    return icon as PresetIconName;
  }
  // Component icons can't be serialized - fall back to a default
  return "star";
}

/**
 * Generic hook that manages extension slots by subscribing to state channel changes.
 *
 * This hook:
 * 1. Loads slot contributions from extensions on mount
 * 2. Subscribes to generic slot state changes from the main process
 * 3. Creates UI slots dynamically from extension-provided state
 * 4. Forwards slot actions back to the main process
 *
 * Extensions define their state shape and the hook renders based on that shape.
 *
 * @returns Array of extension UI slots ready to render
 */
export function useExtensionSlots(): ExtensionUISlot[] {
  // Guard for environments where preload hasn't exposed slot APIs yet
  const electronAPI = window.electronAPI;
  const slotsApiAvailable =
    electronAPI &&
    typeof electronAPI.getExtensionSlots === "function" &&
    typeof electronAPI.getSlotState === "function" &&
    typeof electronAPI.onSlotStateChanged === "function" &&
    typeof electronAPI.executeSlotAction === "function";

  const [slots, setSlots] = useState<ExtensionUISlot[]>([]);
  const slotStateStores = useRef<Map<string, ReturnType<typeof createSlotState>>>(new Map());
  const slotMetaRef = useRef<Map<string, SlotMetadata>>(new Map());

  // Load initial state and subscribe to changes
  useEffect(() => {
    if (!slotsApiAvailable) {
      console.warn("Slot APIs not available in preload; extension slots disabled.");
      return;
    }

    // Load slot definitions and initial state
    const loadSlots = async () => {
      const metas = await window.electronAPI.getExtensionSlots();
      metas.forEach((meta) => {
        slotMetaRef.current.set(meta.slotId, meta);
      });

      const stores = new Map<string, ReturnType<typeof createSlotState>>(slotStateStores.current);

      for (const meta of metas) {
        const rawState = (await window.electronAPI.getSlotState(meta.slotId)) ?? {
          badge: null,
          visible: false,
          panel: { type: "list", title: meta.label, items: [] },
        };
        const hydratedState = attachActionHandlers(meta.slotId, rawState);
        if (stores.has(meta.slotId)) {
          stores.get(meta.slotId)!.replaceState(hydratedState);
        } else {
          stores.set(meta.slotId, createSlotState(hydratedState));
        }
      }

      slotStateStores.current = stores;
      setSlots(
        Array.from(slotMetaRef.current.values()).map((meta) => ({
          id: meta.slotId,
          label: meta.label,
          icon: toSlotIcon(meta.icon),
          priority: meta.priority,
          state: stores.get(meta.slotId)!,
        }))
      );
    };

    void loadSlots();

    // Subscribe to slot state changes (generic)
    const unsubscribeSlot = window.electronAPI.onSlotStateChanged((event) => {
      const stores = slotStateStores.current;
      const meta = slotMetaRef.current.get(event.slotId);
      if (!meta) {
        return;
      }
      if (!stores.has(event.slotId)) {
        stores.set(event.slotId, createSlotState(attachActionHandlers(event.slotId, event.state)));
        setSlots((prev) => [
          ...prev,
          {
            id: meta.slotId,
            label: meta.label,
            icon: toSlotIcon(meta.icon),
            priority: meta.priority,
            state: stores.get(meta.slotId)!,
          },
        ]);
      } else {
        stores.get(event.slotId)!.replaceState(attachActionHandlers(event.slotId, event.state));
      }
    });

    return () => {
      unsubscribeSlot();
    };
  }, [slotsApiAvailable]);

  return slots;
}

// =============================================================================
// Helpers
// =============================================================================

function attachActionHandlers(slotId: string, state: any) {
  const panel = state?.panel;
  if (!panel || panel.type !== "list") {
    return state;
  }

  const withHandlers = {
    ...state,
    panel: {
      ...panel,
      actions: panel.actions?.map((action: any) => ({
        ...action,
        onClick: () => window.electronAPI.executeSlotAction(slotId, "panel-action", action.id),
      })),
      sections: panel.sections?.map((section: any) => ({
        ...section,
        actions: section.actions?.map((action: any) => ({
          ...action,
          onClick: () => window.electronAPI.executeSlotAction(slotId, "section-action", action.id),
        })),
        items: section.items?.map((item: any) => ({
          ...item,
          onClick: item.onClick
            ? () => window.electronAPI.executeSlotAction(slotId, "item-click", item.id)
            : undefined,
          onToggle: item.checkable
            ? () => window.electronAPI.executeSlotAction(slotId, "item-toggle", item.id)
            : undefined,
        })),
      })),
      items: panel.items?.map((item: any) => ({
        ...item,
        onClick: item.onClick
          ? () => window.electronAPI.executeSlotAction(slotId, "item-click", item.id)
          : undefined,
        onToggle: item.checkable
          ? () => window.electronAPI.executeSlotAction(slotId, "item-toggle", item.id)
          : undefined,
      })),
    },
  };

  return withHandlers;
}
