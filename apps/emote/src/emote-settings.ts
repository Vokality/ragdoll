import * as vscode from "vscode";
import { VALID_THEMES, VALID_VARIANTS } from "./types";
import type { ThemeId, VariantId } from "./types";

function isAllowed<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return typeof value === "string" && allowed.includes(value as T);
}

export class EmoteSettings {
  getTheme(): ThemeId {
    const value = vscode.workspace
      .getConfiguration("emote")
      .get<string>("theme");
    if (!isAllowed(value, VALID_THEMES)) {
      throw new Error("Emote theme configuration is missing or invalid");
    }
    return value;
  }

  setTheme(themeId: ThemeId): Thenable<void> {
    return vscode.workspace
      .getConfiguration("emote")
      .update("theme", themeId, vscode.ConfigurationTarget.Global);
  }

  getVariant(): VariantId {
    const value = vscode.workspace
      .getConfiguration("emote")
      .get<string>("variant");
    if (!isAllowed(value, VALID_VARIANTS)) {
      throw new Error("Emote variant configuration is missing or invalid");
    }
    return value;
  }

  setVariant(variantId: VariantId): Thenable<void> {
    return vscode.workspace
      .getConfiguration("emote")
      .update("variant", variantId, vscode.ConfigurationTarget.Global);
  }
}
