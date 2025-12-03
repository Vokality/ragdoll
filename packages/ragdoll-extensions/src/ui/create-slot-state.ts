/**
 * Helper to create observable slot state stores.
 *
 * This creates a store compatible with React's useSyncExternalStore,
 * allowing extensions to expose reactive state for their UI slots.
 *
 * @example
 * ```ts
 * const slotState = createSlotState({
 *   badge: 0,
 *   visible: false,
 *   panel: { type: 'list', title: 'Tasks', items: [] }
 * });
 *
 * // Update state (triggers subscribers)
 * slotState.setState({ badge: 5, visible: true });
 *
 * // Partial updates
 * slotState.setState({ badge: 3 });
 *
 * // Use in slot definition
 * const slot: ExtensionUISlot = {
 *   id: 'tasks',
 *   label: 'Tasks',
 *   icon: 'checklist',
 *   state: slotState,
 * };
 * ```
 */

import type { SlotState, SlotStateStore, SlotStateCallback, PanelConfig } from "./types.js";

// =============================================================================
// Mutable Slot State Store
// =============================================================================

/**
 * Extended store interface that allows state mutations
 */
export interface MutableSlotStateStore extends SlotStateStore {
  /** Update state (partial updates supported) */
  setState(partial: Partial<SlotState>): void;
  /** Replace entire state */
  replaceState(state: SlotState): void;
  /** Update just the badge */
  setBadge(badge: number | string | null): void;
  /** Update just the visibility */
  setVisible(visible: boolean): void;
  /** Update just the panel config */
  setPanel(panel: PanelConfig): void;
}

/**
 * Create a mutable slot state store.
 *
 * @param initialState - Initial state for the slot
 * @returns A mutable store that can be used in slot definitions
 */
export function createSlotState(initialState: SlotState): MutableSlotStateStore {
  let state: SlotState = { ...initialState };
  const listeners = new Set<SlotStateCallback>();

  const notify = (): void => {
    for (const listener of listeners) {
      try {
        listener();
      } catch (error) {
        console.error("[SlotState] Error in listener:", error);
      }
    }
  };

  return {
    getState(): SlotState {
      return state;
    },

    subscribe(callback: SlotStateCallback): () => void {
      listeners.add(callback);
      return () => {
        listeners.delete(callback);
      };
    },

    setState(partial: Partial<SlotState>): void {
      state = { ...state, ...partial };
      notify();
    },

    replaceState(newState: SlotState): void {
      state = { ...newState };
      notify();
    },

    setBadge(badge: number | string | null): void {
      if (state.badge !== badge) {
        state = { ...state, badge };
        notify();
      }
    },

    setVisible(visible: boolean): void {
      if (state.visible !== visible) {
        state = { ...state, visible };
        notify();
      }
    },

    setPanel(panel: PanelConfig): void {
      state = { ...state, panel };
      notify();
    },
  };
}

// =============================================================================
// Derived Slot State Store
// =============================================================================

/**
 * Options for creating a derived slot state store
 */
export interface DerivedSlotStateOptions<TSource> {
  /** Function to get the source state */
  getSourceState: () => TSource;
  /** Subscribe to source state changes */
  subscribeToSource: (callback: () => void) => () => void;
  /** Derive slot state from source state */
  deriveState: (source: TSource) => SlotState;
}

/**
 * Create a slot state store derived from another state source.
 *
 * This is useful when an extension already has its own state management
 * (like TaskManager) and wants to expose a slot state derived from it.
 *
 * IMPORTANT: This implementation caches results for useSyncExternalStore
 * compatibility. The getSnapshot result must be stable (same reference)
 * when the underlying data hasn't changed.
 *
 * @example
 * ```ts
 * const slotState = createDerivedSlotState({
 *   getSourceState: () => taskManager.getState(),
 *   subscribeToSource: (cb) => taskManager.onStateChange(cb),
 *   deriveState: (tasks) => ({
 *     badge: tasks.filter(t => t.status !== 'done').length,
 *     visible: tasks.length > 0,
 *     panel: {
 *       type: 'list',
 *       title: 'Tasks',
 *       items: tasks.map(taskToItem),
 *     },
 *   }),
 * });
 * ```
 */
export function createDerivedSlotState<TSource>(
  options: DerivedSlotStateOptions<TSource>
): SlotStateStore {
  const { getSourceState, subscribeToSource, deriveState } = options;

  // Version number that increments on each subscription notification
  let version = 0;
  let cachedVersion = -1;
  let cachedSlotState: SlotState | undefined;

  // getState must return a stable reference for useSyncExternalStore
  // It should only recompute when subscribe callback has been called
  const getState = (): SlotState => {
    // Only recompute if version changed (subscription was triggered)
    if (version !== cachedVersion || cachedSlotState === undefined) {
      cachedVersion = version;
      const sourceState = getSourceState();
      cachedSlotState = deriveState(sourceState);
    }

    return cachedSlotState;
  };

  return {
    getState,
    subscribe(callback: SlotStateCallback): () => void {
      return subscribeToSource(() => {
        // Increment version to signal that state may have changed
        version++;
        callback();
      });
    },
  };
}

// =============================================================================
// Default State Factory
// =============================================================================

/**
 * Create a default hidden slot state
 */
export function createHiddenSlotState(title: string = "Panel"): SlotState {
  return {
    badge: null,
    visible: false,
    panel: {
      type: "list",
      title,
      items: [],
    },
  };
}

/**
 * Create a slot state for a list panel
 */
export function createListSlotState(
  title: string,
  options: {
    badge?: number | string | null;
    visible?: boolean;
    emptyMessage?: string;
  } = {}
): SlotState {
  return {
    badge: options.badge ?? null,
    visible: options.visible ?? true,
    panel: {
      type: "list",
      title,
      items: [],
      emptyMessage: options.emptyMessage,
    },
  };
}
