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

export function getSlotIcon(icon: PresetIconName): ComponentType<IconProps> {
  return presetIcons[icon];
}
