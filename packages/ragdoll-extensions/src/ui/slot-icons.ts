/**
 * Preset icon registry and helpers for slot UI components.
 */

import type { ComponentType } from "react";
import type { PresetIconName } from "./types.js";
import type { IconProps } from "./icons.js";
import {
  ChecklistIcon,
  TimerIcon,
  CalendarIcon,
  BellIcon,
  SettingsIcon,
  BookmarkIcon,
  FlagIcon,
  StarIcon,
  MusicIcon,
} from "./icons.js";

type CustomIcon = { type: "component"; component: ComponentType<IconProps> };

export const presetIcons: Record<PresetIconName, ComponentType<IconProps>> = {
  checklist: ChecklistIcon,
  timer: TimerIcon,
  calendar: CalendarIcon,
  bell: BellIcon,
  settings: SettingsIcon,
  bookmark: BookmarkIcon,
  flag: FlagIcon,
  star: StarIcon,
  music: MusicIcon,
};

export function getSlotIcon(icon: PresetIconName | CustomIcon): ComponentType<IconProps> {
  if (typeof icon === "string") {
    return presetIcons[icon] ?? ChecklistIcon;
  }
  return icon.component;
}
