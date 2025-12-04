/**
 * Extension UI Module
 *
 * Provides components and utilities for extensions to contribute UI elements
 * to the application. Extensions can register UI slots that appear in the
 * slot bar, each with an icon button and an associated panel.
 *
 * @example
 * ```tsx
 * import {
 *   SlotBar,
 *   createSlotState,
 *   createDerivedSlotState,
 *   useSlotState,
 *   type ExtensionUISlot,
 * } from "@vokality/ragdoll-extensions/ui";
 *
 * // Create a slot with managed state
 * const slotState = createSlotState({
 *   badge: 0,
 *   visible: false,
 *   panel: { type: "list", title: "My Items", items: [] },
 * });
 *
 * const mySlot: ExtensionUISlot = {
 *   id: "my-extension.main",
 *   label: "My Extension",
 *   icon: "star",
 *   state: slotState,
 * };
 *
 * // Use in app
 * function App() {
 *   return <SlotBar slots={[mySlot]} />;
 * }
 * ```
 */

// =============================================================================
// Types
// =============================================================================

export type {
  // Icon types
  PresetIconName,
  SlotIcon,

  // Panel item types
  ItemStatus,
  ListPanelItem,
  PanelAction,
  ListPanelSection,

  // Panel configuration types
  ListPanelConfig,
  CustomPanelConfig,
  CustomPanelProps,
  PanelConfig,

  // Slot state types
  SlotState,
  SlotStateCallback,
  SlotStateStore,

  // Slot definition types
  ExtensionUISlot,

  // Registry types
  SlotRegistryEventType,
  SlotRegistryEvent,
  SlotRegistryEventCallback,

  // Component prop types
  SlotButtonProps,
  SlotPanelProps,
} from "./types.js";

// =============================================================================
// State Management
// =============================================================================

export {
  createSlotState,
  createDerivedSlotState,
  createHiddenSlotState,
  createListSlotState,
  type MutableSlotStateStore,
  type DerivedSlotStateOptions,
} from "./create-slot-state.js";

// =============================================================================
// React Hooks
// =============================================================================

export {
  useSlotState,
  useSlotStateStore,
  useSlotBadge,
  useSlotVisible,
  useSlotRegistry,
  useVisibleSlots,
  useActiveSlot,
  type SlotRegistry,
} from "./hooks.js";

// =============================================================================
// React Components
// =============================================================================

export { SlotButton, SlotButtonStateless } from "./slot-button.js";
export { SlotPanel, SlotPanelBase } from "./slot-panel.js";
export { SlotBar, ControlledSlotBar, type SlotBarProps, type ControlledSlotBarProps } from "./slot-bar.js";
export { useExtensionSlots } from "./bridge/use-extension-slots.js";
export {
  createElectronHostBridge,
  type ExtensionHostBridge,
  type ElectronHostAPI,
} from "./bridge/extension-host.js";

// =============================================================================
// Icons
// =============================================================================

export { presetIcons, getSlotIcon } from "./slot-icons.js";
export type { IconProps } from "./icons.js";
