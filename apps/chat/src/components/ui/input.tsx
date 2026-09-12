import type { ComponentProps } from "react";

export type TextInputProps = Omit<ComponentProps<"input">, "type"> & {
  type?: "text" | "password" | "email" | "url" | "tel" | "search" | "number";
};

export function TextInput({ type = "text", ...props }: TextInputProps) {
  return <input {...props} type={type} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} />;
}

export function Select(props: ComponentProps<"select">) {
  return <select {...props} />;
}

export function Checkbox(props: Omit<ComponentProps<"input">, "type">) {
  return <input {...props} type="checkbox" />;
}
