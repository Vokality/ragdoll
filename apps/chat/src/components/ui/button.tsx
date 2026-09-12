import type { ComponentProps, ReactNode } from "react";

export interface ButtonProps extends ComponentProps<"button"> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "plain";
  loading?: boolean;
  loadingLabel?: ReactNode;
}

/** Native button semantics, shared appearance, and one loading-state contract. */
export function Button({
  variant = "secondary",
  type = "button",
  loading = false,
  loadingLabel,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const variantClass = variant === "plain" ? "" : `btn-${variant}`;
  return (
    <button
      {...props}
      type={type}
      className={
        [variantClass, className].filter(Boolean).join(" ") || undefined
      }
      disabled={disabled || loading}
      aria-busy={loading || props["aria-busy"]}
    >
      {loading && <span className="spinner-sm" aria-hidden="true" />}
      {loading ? (loadingLabel ?? children) : children}
    </button>
  );
}

export interface IconButtonProps extends Omit<ButtonProps, "variant"> {
  variant?: ButtonProps["variant"] | "icon";
  "aria-label": string;
}

export function IconButton({
  className,
  variant = "icon",
  ...props
}: IconButtonProps) {
  return (
    <Button
      {...props}
      variant={variant === "icon" ? "plain" : variant}
      className={
        variant === "icon"
          ? ["icon-btn", className].filter(Boolean).join(" ")
          : className
      }
    />
  );
}
