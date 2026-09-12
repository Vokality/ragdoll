import type { Icon } from "@phosphor-icons/react";
import { ListChecksIcon as ListChecksGlyph } from "@phosphor-icons/react/dist/csr/ListChecks";
import { TimerIcon as TimerGlyph } from "@phosphor-icons/react/dist/csr/Timer";
import { CalendarBlankIcon as CalendarBlankGlyph } from "@phosphor-icons/react/dist/csr/CalendarBlank";
import { BellIcon as BellGlyph } from "@phosphor-icons/react/dist/csr/Bell";
import { GearSixIcon as GearSixGlyph } from "@phosphor-icons/react/dist/csr/GearSix";
import { BookmarkSimpleIcon as BookmarkSimpleGlyph } from "@phosphor-icons/react/dist/csr/BookmarkSimple";
import { FlagIcon as FlagGlyph } from "@phosphor-icons/react/dist/csr/Flag";
import { StarIcon as StarGlyph } from "@phosphor-icons/react/dist/csr/Star";
import { MusicNotesIcon as MusicNotesGlyph } from "@phosphor-icons/react/dist/csr/MusicNotes";
import { GridFourIcon as GridFourGlyph } from "@phosphor-icons/react/dist/csr/GridFour";
import { PaletteIcon as PaletteGlyph } from "@phosphor-icons/react/dist/csr/Palette";
import { NotebookIcon as NotebookGlyph } from "@phosphor-icons/react/dist/csr/Notebook";
import { CardsThreeIcon as CardsThreeGlyph } from "@phosphor-icons/react/dist/csr/CardsThree";
import { ListBulletsIcon as ListBulletsGlyph } from "@phosphor-icons/react/dist/csr/ListBullets";
import { GameControllerIcon as GameControllerGlyph } from "@phosphor-icons/react/dist/csr/GameController";

export interface IconProps {
  size?: number;
}

/** A consistent decorative duotone treatment for every semantic slot preset. */
function SlotGlyph({ glyph: Glyph, size = 20 }: IconProps & { glyph: Icon }) {
  return (
    <Glyph size={size} weight="duotone" aria-hidden="true" focusable={false} />
  );
}

export function ChecklistIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={ListChecksGlyph} />;
}
export function TimerIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={TimerGlyph} />;
}
export function CalendarIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={CalendarBlankGlyph} />;
}
export function BellIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={BellGlyph} />;
}
export function SettingsIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={GearSixGlyph} />;
}
export function BookmarkIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={BookmarkSimpleGlyph} />;
}
export function FlagIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={FlagGlyph} />;
}
export function StarIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={StarGlyph} />;
}
export function MusicIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={MusicNotesGlyph} />;
}
export function GridIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={GridFourGlyph} />;
}
export function CanvasIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={PaletteGlyph} />;
}
export function NotebookIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={NotebookGlyph} />;
}
export function CardsIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={CardsThreeGlyph} />;
}
export function ListIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={ListBulletsGlyph} />;
}
export function GameIcon(props: IconProps) {
  return <SlotGlyph {...props} glyph={GameControllerGlyph} />;
}
