import { GearSixIcon } from "@phosphor-icons/react/dist/csr/GearSix";
import { InfoIcon } from "@phosphor-icons/react/dist/csr/Info";
import { XCircleIcon } from "@phosphor-icons/react/dist/csr/XCircle";
import { WarningIcon } from "@phosphor-icons/react/dist/csr/Warning";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/csr/CheckCircle";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { PaperPlaneTiltIcon } from "@phosphor-icons/react/dist/csr/PaperPlaneTilt";
import { StopIcon } from "@phosphor-icons/react/dist/csr/Stop";
import { EyeIcon } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon } from "@phosphor-icons/react/dist/csr/EyeSlash";
import { ArrowRightIcon } from "@phosphor-icons/react/dist/csr/ArrowRight";
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/csr/ArrowUpRight";
import { GlobeHemisphereWestIcon } from "@phosphor-icons/react/dist/csr/GlobeHemisphereWest";
import { KeyIcon } from "@phosphor-icons/react/dist/csr/Key";

const glyphs = {
  settings: GearSixIcon,
  info: InfoIcon,
  error: XCircleIcon,
  warning: WarningIcon,
  success: CheckCircleIcon,
  close: XIcon,
  send: PaperPlaneTiltIcon,
  stop: StopIcon,
  eye: EyeIcon,
  "eye-off": EyeSlashIcon,
  "arrow-right": ArrowRightIcon,
  external: ArrowUpRightIcon,
  globe: GlobeHemisphereWestIcon,
  key: KeyIcon,
};

/** Decorative icons inherit the control's color and accessible name. */
export function Icon({
  name,
  size = 18,
  color = "currentColor",
}: {
  name: keyof typeof glyphs;
  size?: number;
  color?: string;
}) {
  const Glyph = glyphs[name];
  return (
    <Glyph
      size={size}
      color={color}
      weight={name === "stop" ? "fill" : "duotone"}
      aria-hidden="true"
      focusable={false}
      style={{ flexShrink: 0 }}
    />
  );
}
