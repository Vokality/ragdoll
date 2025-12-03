/**
 * UI Slot Types for Extension-Contributed UI
 *
 * Extensions can contribute UI slots that appear in the app's slot bar.
 * Each slot has an icon button and an associated panel that opens when clicked.
 */

import type { ComponentType, ReactNode } from "react";

// =============================================================================
// Icon Types
// =============================================================================

/**
 * Predefined icon names available for slots
 */
export type PresetIconName =
  | "checklist"
  | "timer"
  | "calendar"
  | "bell"
  | "settings"
  | "bookmark"
  | "flag"
  | "star"
  | "music";

/**
 * Icon specification - either a preset name or a custom React component
 */
export type SlotIcon =
  | PresetIconName
  | { type: "component"; component: ComponentType<{ size?: number }> };

// =============================================================================
// Panel Item Types (for list panels)
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

// =============================================================================
// Panel Configuration Types
// =============================================================================

/**
 * Configuration for a list-based panel
 */
export interface ListPanelConfig {
  type: "list";
  /** Panel title */
  title: string;
  /** Message to show when list is empty */
  emptyMessage?: string;
  /** Empty state icon */
  emptyIcon?: ReactNode;
  /** Flat list of items (use this OR sections, not both) */
  items?: ListPanelItem[];
  /** Grouped sections (use this OR items, not both) */
  sections?: ListPanelSection[];
  /** Panel-level actions (shown in header or footer) */
  actions?: PanelAction[];
}

/**
 * Configuration for a custom panel with full control
 */
export interface CustomPanelConfig {
  type: "custom";
  /** Panel title (optional, component can render its own) */
  title?: string;
  /** Custom component to render */
  component: ComponentType<CustomPanelProps>;
}

/**
 * Props passed to custom panel components
 */
export interface CustomPanelProps {
  /** Call to close the panel */
  onClose: () => void;
}

/**
 * Union of all panel configuration types
 */
export type PanelConfig = ListPanelConfig | CustomPanelConfig;

// =============================================================================
// Slot State Types
// =============================================================================

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
// Extension UI Slot Definition
// =============================================================================

/**
 * Complete UI slot definition provided by an extension
 */
export interface ExtensionUISlot {
  /** Unique identifier (should be namespaced, e.g., "tasks.main") */
  id: string;
  /** Accessibility label for the button */
  label: string;
  /** Icon to display */
  icon: SlotIcon;
  /** Ordering priority (higher = appears first, default: 0) */
  priority?: number;
  /** Observable state store */
  state: SlotStateStore;
}

// =============================================================================
// Slot Registry Types
// =============================================================================

/**
 * Event types emitted by the UI slot registry
 */
export type SlotRegistryEventType =
  | "slot:registered"
  | "slot:unregistered"
  | "slots:changed";

/**
 * Event payload for slot registry events
 */
export interface SlotRegistryEvent {
  type: SlotRegistryEventType;
  slotId: string;
  timestamp: number;
}

/**
 * Callback for slot registry events
 */
export type SlotRegistryEventCallback = (event: SlotRegistryEvent) => void;

// =============================================================================
// Slot Button Props (for rendering)
// =============================================================================

/**
 * Props for rendering a slot button
 */
export interface SlotButtonProps {
  /** The slot to render */
  slot: ExtensionUISlot;
  /** Whether this slot's panel is currently open */
  isActive?: boolean;
  /** Called when button is clicked */
  onClick?: () => void;
}

/**
 * Props for rendering a slot panel
 */
export interface SlotPanelProps {
  /** The slot whose panel to render */
  slot: ExtensionUISlot;
  /** Called to close the panel */
  onClose: () => void;
}
