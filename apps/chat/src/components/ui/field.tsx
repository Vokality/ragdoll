import {
  useId,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
} from "react";
import "./controls.css";

export interface FieldControlProps {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
}

interface FieldProps extends Omit<ComponentProps<"div">, "children"> {
  label: ReactNode;
  description?: ReactNode;
  descriptionPosition?: "before" | "after";
  error?: string | null;
  invalid?: boolean;
  required?: boolean;
  labelStyle?: CSSProperties;
  descriptionStyle?: CSSProperties;
  children: (control: FieldControlProps) => ReactNode;
}

/** Spread the supplied props onto exactly one control, even inside a wrapper. */
export function Field({
  id,
  label,
  description,
  descriptionPosition = "after",
  error,
  invalid = false,
  required = false,
  labelStyle,
  descriptionStyle,
  className,
  children,
  ...props
}: FieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const descriptionId = description ? `${controlId}-description` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const control: FieldControlProps = {
    id: controlId,
    "aria-describedby":
      [descriptionId, errorId].filter(Boolean).join(" ") || undefined,
    "aria-invalid": invalid || !!error || undefined,
    "aria-required": required || undefined,
  };
  const hint = description ? (
    <div
      id={descriptionId}
      className="ui-field-description"
      style={descriptionStyle}
    >
      {description}
    </div>
  ) : null;
  const fieldLabel = (
    <label htmlFor={controlId} style={labelStyle}>
      {label}
      {required && (
        <span className="ui-field-required" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
  return (
    <div
      {...props}
      className={["ui-field", className].filter(Boolean).join(" ")}
    >
      {descriptionPosition === "before" ? (
        <div className="ui-field-heading">
          {fieldLabel}
          {hint}
        </div>
      ) : (
        fieldLabel
      )}
      {children(control)}
      {error && (
        <p id={errorId} className="ui-field-error" role="alert">
          {error}
        </p>
      )}
      {descriptionPosition === "after" && hint}
    </div>
  );
}
