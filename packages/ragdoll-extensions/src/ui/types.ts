import type {
  ExtensionSlot,
  GridPanelCell,
  GridPanelConfig,
  GridPanelResult,
  ItemStatus,
  ListPanelConfig,
  ListPanelItem,
  ListPanelSection,
  PanelAction,
  PanelConfig,
  PresetIconName,
  SlotState,
  SlotStateCallback,
  SlotStateStore,
} from "../slots.js";

export type {
  GridPanelCell,
  GridPanelConfig,
  GridPanelResult,
  ItemStatus,
  ListPanelConfig,
  ListPanelItem,
  ListPanelSection,
  PanelAction,
  PanelConfig,
  PresetIconName,
  SlotState,
  SlotStateCallback,
  SlotStateStore,
};

export type SlotIcon = PresetIconName;
export type ExtensionUISlot = ExtensionSlot;

export type SlotRegistryEventType =
  "slot:registered" | "slot:unregistered" | "slots:changed";

export interface SlotRegistryEvent {
  type: SlotRegistryEventType;
  slotId: string;
  timestamp: number;
}

export type SlotRegistryEventCallback = (event: SlotRegistryEvent) => void;

export interface SlotButtonProps {
  slot: ExtensionUISlot;
  isActive?: boolean;
  onClick?: () => void;
}

export interface SlotPanelProps {
  slot: ExtensionUISlot;
  onClose: () => void;
}
