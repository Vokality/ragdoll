/**
 * UI State Module - React-free state utilities for extension slots.
 *
 * This module provides state management utilities that can be used in any
 * environment (Node.js, Electron main process, browser) without requiring React.
 *
 * For React components and hooks, use "@vokality/ragdoll-extensions/ui".
 *
 * @example
 * ```ts
 * // In Electron main process or extension code
 * import { createSlotState } from "@vokality/ragdoll-extensions/ui/state";
 *
 * const slotState = createSlotState({
 *   badge: 0,
 *   visible: true,
 *   panel: { type: "list", title: "Tasks", sections: [] },
 * });
 * ```
 */

// =============================================================================
// Types (React-free subset)
// =============================================================================

/**
 * Status indicator for list items
 */
export type ItemStatus = "default" | "active" | "success" | "warning" | "error";

/**
 * A single item in a list panel
 */
export interface ListPanelItem {
  /** Unique identifier */
  id: string;
  /** Primary text */
  label: string;
  /** Secondary text (optional) */
  sublabel?: string;
  /** Visual status indicator */
  status?: ItemStatus;
  /** Whether item shows a checkbox */
  checkable?: boolean;
  /** Checkbox state (only if checkable) */
  checked?: boolean;
  /** Called when checkbox is toggled */
  onToggle?: () => void;
  /** Called when item is clicked (not the checkbox) */
  onClick?: () => void;
  /** Media/thumbnail image URL (e.g., album artwork) */
  mediaUrl?: string;
  /** Alt text for media image */
  mediaAlt?: string;
  /** Additional metadata for rendering */
  meta?: Record<string, unknown>;
}

/**
 * Action button in a panel
 */
export interface PanelAction {
  /** Unique identifier */
  id: string;
  /** Button label */
  label: string;
  /** Button variant */
  variant?: "primary" | "secondary" | "danger";
  /** Whether button is disabled */
  disabled?: boolean;
  /** Click handler */
  onClick: () => void;
}

/**
 * Section grouping for list items
 */
export interface ListPanelSection {
  /** Section identifier */
  id: string;
  /** Section title */
  title: string;
  /** Items in this section */
  items: ListPanelItem[];
  /** Section-level actions */
  actions?: PanelAction[];
  /** Whether section is collapsible */
  collapsible?: boolean;
  /** Whether section starts collapsed */
  defaultCollapsed?: boolean;
}

/**
 * Configuration for a list-based panel (React-free version)
 */
export interface ListPanelConfig {
  type: "list";
  /** Panel title */
  title: string;
  /** Message to show when list is empty */
  emptyMessage?: string;
  /** Flat list of items (use this OR sections, not both) */
  items?: ListPanelItem[];
  /** Grouped sections (use this OR items, not both) */
  sections?: ListPanelSection[];
  /** Panel-level actions (shown in header or footer) */
  actions?: PanelAction[];
}

/**
 * Union of panel configuration types (React-free version)
 */
export type PanelConfig = ListPanelConfig;

/**
 * Dynamic state exposed by a slot
 */
export interface SlotState {
  /** Badge content (number, string, or null to hide) */
  badge: number | string | null;
  /** Whether the slot should be visible */
  visible: boolean;
  /** Current panel configuration */
  panel: PanelConfig;
}

/**
 * Subscription callback for slot state changes
 */
export type SlotStateCallback = () => void;

/**
 * Observable state interface for slots (useSyncExternalStore compatible)
 */
export interface SlotStateStore {
  /** Get current state snapshot */
  getState(): SlotState;
  /** Subscribe to state changes, returns unsubscribe function */
  subscribe(callback: SlotStateCallback): () => void;
}

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
 * @param options - Configuration for the derived state
 * @returns A read-only slot state store
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
  const getState = (): SlotState => {
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
        version++;
        callback();
      });
    },
  };
}

// =============================================================================
// Default State Factories
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
