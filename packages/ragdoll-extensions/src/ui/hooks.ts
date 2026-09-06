/**
 * React hooks for consuming extension UI slots.
 *
 * These hooks use React's useSyncExternalStore for efficient
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
    slot.state.getState, // Server snapshot (same as client for our use case)
  );
}

/**
 * Subscribe to a slot state store directly.
 *
 * @param store - The state store to subscribe to
 * @returns Current slot state
 */
export function useSlotStateStore(store: SlotStateStore): SlotState {
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
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
  const getSnapshot = useCallback(() => slot.state.getState().visible, [slot]);

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
    [registry],
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
 * Reuses the result when the visible slot objects and ordering are unchanged.
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
  const cacheRef = useRef<ExtensionUISlot[]>([]);
  const subscribe = useCallback(
    (callback: () => void) => {
      const unsubscribes = slots.map((slot) => slot.state.subscribe(callback));
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
    },
    [slots],
  );
  const getSnapshot = useCallback((): ExtensionUISlot[] => {
    // Read current state even before subscription; notifications are not a revision log.
    const visible = slots
      .filter((slot) => slot.state.getState().visible)
      .sort((left, right) => right.priority - left.priority);
    if (
      cacheRef.current.length !== visible.length ||
      cacheRef.current.some((slot, index) => slot !== visible[index])
    ) {
      cacheRef.current = visible;
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
  slots: ExtensionUISlot[],
): [string | null, (id: string | null) => void, ExtensionUISlot | null] {
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const visibleSlots = useVisibleSlots(slots);
  const isActiveVisible =
    activeSlotId !== null &&
    visibleSlots.some((slot) => slot.id === activeSlotId);
  const resolvedActiveSlotId = isActiveVisible ? activeSlotId : null;

  // Clear a selection that disappeared instead of syncing via an effect.
  if (activeSlotId !== null && resolvedActiveSlotId === null) {
    setActiveSlotId(null);
  }

  const activeSlot = useMemo(() => {
    if (!resolvedActiveSlotId) return null;
    return slots.find((slot) => slot.id === resolvedActiveSlotId) ?? null;
  }, [slots, resolvedActiveSlotId]);

  return [resolvedActiveSlotId, setActiveSlotId, activeSlot];
}
