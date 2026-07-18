import type {
  CharacterThemeId,
  CharacterVariantId,
} from "../../electron/electron-api";

export interface ChatSettings {
  theme: CharacterThemeId;
  variant: CharacterVariantId;
}

export const DEFAULT_SETTINGS: ChatSettings = {
  theme: "default",
  variant: "human",
};

export function mergeSettings(
  partial?: Partial<ChatSettings> | null,
): ChatSettings {
  return {
    theme: partial?.theme ?? DEFAULT_SETTINGS.theme,
    variant: partial?.variant ?? DEFAULT_SETTINGS.variant,
  };
}
