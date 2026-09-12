import type { ComponentProps } from "react";

interface SwitchProps extends Omit<
  ComponentProps<"button">,
  | "type"
  | "role"
  | "aria-checked"
  | "aria-pressed"
  | "children"
  | "onClick"
  | "onChange"
> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  "aria-label": string;
}

export function Switch({
  checked,
  onCheckedChange,
  className,
  ...props
}: SwitchProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      className={["switch", checked ? "on" : "", className]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="switch-knob" aria-hidden="true" />
    </button>
  );
}
