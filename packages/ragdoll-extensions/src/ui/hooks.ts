/**
 * React hooks for consuming extension UI slots.
 *
 * These hooks use React 18's useSyncExternalStore for efficient
 * subscription to external slot state.
 *
 * IMPORTANT: All getSnapshot functions must return stable references
 * (same object/array reference if data hasn't changed) to avoid
 * infinite render loops with useSyncExternalStore.
 */

import {
  useSyncExternalStore,
  useMemo,
  useCallback,
  useState,
  useRef,
  useEffect,
} from "react";
import type {
  ExtensionUISlot,
  SlotState,
  SlotStateStore,
  SlotRegistryEventCallback,
} from "./types.js";

// =============================================================================
// Slot State Hook
// =============================================================================

/**
 * Subscribe to a slot's state.
 *
 * @param slot - The slot to subscribe to
 * @returns Current slot state
 *
 * @example
 * ```tsx
 * function SlotButton({ slot }: { slot: ExtensionUISlot }) {
 *   const state = useSlotState(slot);
 *
 *   if (!state.visible) return null;
 *
 *   return (
 *     <button>
 *       {slot.label}
 *       {state.badge && <span>{state.badge}</span>}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSlotState(slot: ExtensionUISlot): SlotState {
  return useSyncExternalStore(
    slot.state.subscribe,
    slot.state.getState,
    slot.state.getState // Server snapshot (same as client for our use case)
  );
}

/**
 * Subscribe to a slot state store directly.
 *
 * @param store - The state store to subscribe to
 * @returns Current slot state
 */
export function useSlotStateStore(store: SlotStateStore): SlotState {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState
  );
}

// =============================================================================
// Slot Badge Hook
// =============================================================================

/**
 * Subscribe to just the badge value from a slot.
 *
 * This is optimized to only re-render when badge changes.
 *
 * @param slot - The slot to get badge from
 * @returns Badge value (number, string, or null)
 */
export function useSlotBadge(slot: ExtensionUISlot): number | string | null {
  // Cache the badge value to return stable reference for primitives
  const cacheRef = useRef<{ badge: number | string | null }>({ badge: null });

  const getSnapshot = useCallback(() => {
    const newBadge = slot.state.getState().badge;
    // Only update cache if badge actually changed
    if (cacheRef.current.badge !== newBadge) {
      cacheRef.current = { badge: newBadge };
    }
    return cacheRef.current.badge;
  }, [slot]);

  return useSyncExternalStore(slot.state.subscribe, getSnapshot, getSnapshot);
}

// =============================================================================
// Slot Visibility Hook
// =============================================================================

/**
 * Subscribe to just the visibility from a slot.
 *
 * @param slot - The slot to check visibility for
 * @returns Whether the slot is visible
 */
export function useSlotVisible(slot: ExtensionUISlot): boolean {
  const getSnapshot = useCallback(
    () => slot.state.getState().visible,
    [slot]
  );

  return useSyncExternalStore(slot.state.subscribe, getSnapshot, getSnapshot);
}

// =============================================================================
// Slot Registry Types and Hook
// =============================================================================

/**
 * Interface for a slot registry that components can subscribe to
 */
export interface SlotRegistry {
  /** Get all registered slots */
  getSlots(): ExtensionUISlot[];
  /** Subscribe to slot registration changes */
  subscribe(callback: SlotRegistryEventCallback): () => void;
}

/**
 * Subscribe to all slots in a registry.
 *
 * @param registry - The slot registry to subscribe to
 * @returns Array of all registered slots
 */
export function useSlotRegistry(registry: SlotRegistry): ExtensionUISlot[] {
  const subscribe = useCallback(
    (callback: () => void) => {
      return registry.subscribe(() => callback());
    },
    [registry]
  );

  return useSyncExternalStore(subscribe, registry.getSlots, registry.getSlots);
}

// =============================================================================
// Visible Slots Hook
// =============================================================================

/**
 * Get only visible slots, sorted by priority.
 *
 * This hook subscribes to each slot's state and returns only visible slots
 * sorted by priority (higher first).
 *
 * Uses a version-based caching strategy to maintain stable references
 * for useSyncExternalStore compatibility.
 *
 * @param slots - Array of slots to filter
 * @returns Visible slots sorted by priority
 *
 * @example
 * ```tsx
 * function SlotBar({ slots }: { slots: ExtensionUISlot[] }) {
 *   const visibleSlots = useVisibleSlots(slots);
 *
 *   return (
 *     <div className="slot-bar">
 *       {visibleSlots.map(slot => (
 *         <SlotButton key={slot.id} slot={slot} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useVisibleSlots(slots: ExtensionUISlot[]): ExtensionUISlot[] {
  // Version counter that increments when any slot's state changes
  const versionRef = useRef(0);
  // Cached result
  const cacheRef = useRef<ExtensionUISlot[]>([]);
  // Version when cache was last computed
  const cachedVersionRef = useRef(-1);

  // Subscribe to all slots' state changes
  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubscribes = slots.map((slot) =>
        slot.state.subscribe(() => {
          // Increment version on any change
          versionRef.current++;
          callback();
        })
      );
      return () => {
        unsubscribes.forEach((unsub) => unsub());
      };
    },
    [slots]
  );

  // Get snapshot with stable reference
  const getSnapshot = useCallback((): ExtensionUISlot[] => {
    // Only recompute if version changed
    if (versionRef.current !== cachedVersionRef.current) {
      cachedVersionRef.current = versionRef.current;

      const visible = slots
        .filter((slot) => slot.state.getState().visible)
        .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

      // Only update cache reference if the result actually changed
      const cacheValid =
        cacheRef.current.length === visible.length &&
        cacheRef.current.every((slot, i) => slot.id === visible[i]?.id);

      if (!cacheValid) {
        cacheRef.current = visible;
      }
    }

    return cacheRef.current;
  }, [slots]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// =============================================================================
// Active Slot Hook
// =============================================================================

/**
 * Manage active slot state for a slot bar.
 *
 * @param slots - Array of available slots
 * @returns Tuple of [activeSlotId, setActiveSlotId, activeSlot]
 */
export function useActiveSlot(
  slots: ExtensionUISlot[]
): [string | null, (id: string | null) => void, ExtensionUISlot | null] {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  const activeSlot = useMemo(() => {
    if (!activeSlotId) return null;
    return slots.find((s) => s.id === activeSlotId) ?? null;
  }, [slots, activeSlotId]);

  // Get visible slots to check if active slot is still visible
  const visibleSlots = useVisibleSlots(slots);

  // Auto-close if active slot becomes invisible or is removed
  useEffect(() => {
    if (activeSlotId && !visibleSlots.some((s) => s.id === activeSlotId)) {
      setActiveSlotId(null);
    }
  }, [activeSlotId, visibleSlots]);

  return [activeSlotId, setActiveSlotId, activeSlot];
}
