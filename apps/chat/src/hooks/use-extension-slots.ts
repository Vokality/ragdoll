import { useState, useEffect, useRef } from "react";
import type { ExtensionUISlot } from "@vokality/ragdoll-extensions";
import { createSlotState } from "@vokality/ragdoll-extensions";

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
  const [slots, setSlots] = useState<ExtensionUISlot[]>([]);
  const slotStateStores = useRef<Map<string, ReturnType<typeof createSlotState>>>(new Map());
  const slotMeta = useRef<Map<string, { extensionId: string; slotId: string; label: string; icon: string | { type: "component" }; priority: number }>>(new Map());

  // Load initial state and subscribe to changes
  useEffect(() => {
    // Load slot definitions and initial state
    const loadSlots = async () => {
      const metas = await window.electronAPI.getExtensionSlots();
      metas.forEach((meta) => {
        slotMeta.current.set(meta.slotId, meta);
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
        Array.from(slotMeta.current.values()).map((meta) => ({
          id: meta.slotId,
          label: meta.label,
          icon: meta.icon,
          priority: meta.priority,
          state: stores.get(meta.slotId)!,
        }))
      );
    };

    void loadSlots();

    // Subscribe to slot state changes (generic)
    const unsubscribeSlot = window.electronAPI.onSlotStateChanged((event) => {
      const stores = slotStateStores.current;
      const meta = slotMeta.current.get(event.slotId);
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
            icon: meta.icon,
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
  }, []);

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
