import { z } from "zod";
import type {
  ConfigSchema,
  SerializedSlotState,
} from "@vokality/ragdoll-extensions";
import type { PresetIconName } from "@vokality/ragdoll-extensions/slots";

export type OperationResult =
  { success: true } | { success: false; error: string };

export type ApiKeyValidationResult =
  { valid: true } | { valid: false; error: string };

export const CHARACTER_THEME_IDS = [
  "default",
  "robot",
  "alien",
  "monochrome",
] as const;
export const CHARACTER_VARIANT_IDS = ["human", "einstein"] as const;
export type CharacterThemeId = (typeof CHARACTER_THEME_IDS)[number];
export type CharacterVariantId = (typeof CHARACTER_VARIANT_IDS)[number];

export interface CharacterSettings {
  theme: CharacterThemeId;
  variant: CharacterVariantId;
}

export type CharacterSettingsUpdate = Partial<CharacterSettings>;

export const DEFAULT_CHARACTER_SETTINGS = {
  theme: "default",
  variant: "human",
} as const satisfies CharacterSettings;

export interface ExtensionInfo {
  packageName: string;
  id: string;
  name: string;
  description: string;
  canDisable: boolean;
  hasConfigSchema: boolean;
  hasOAuth: boolean;
}

export interface SlotInfo {
  extensionId: string;
  slotId: string;
  label: string;
  icon: PresetIconName;
  priority: number;
}

export interface SlotChangeEvent {
  extensionId: string;
  slotId: string;
  state: SerializedSlotState;
}

export type VoidSlotActionType =
  | "panel-action"
  | "section-action"
  | "item-click"
  | "item-toggle"
  | "cell-click";

export type SlotActionType = VoidSlotActionType | "answer-submit";

/** Maximum typed-answer length accepted over IPC for cards panels. */
export const SLOT_ANSWER_MAX_LENGTH = 2000;

export type SlotActionRequest =
  | {
      actionType: VoidSlotActionType;
      actionId: string;
    }
  | {
      actionType: "answer-submit";
      actionId: string;
      payload: string;
    };

export interface OAuthState {
  status: "disconnected" | "connecting" | "connected" | "error" | "expired";
  isAuthenticated: boolean;
  expiresAt?: number;
  error?: string;
}

export interface OAuthConnectedEvent {
  extensionId: string;
}

export interface OAuthFailedEvent {
  extensionId: string;
  error: string;
}

export const IPC_CHANNELS = {
  auth: {
    hasKey: "auth:has-key",
    setKey: "auth:set-key",
    validateKey: "auth:validate-key",
    clearKey: "auth:clear-key",
  },
  shell: {
    openExternal: "shell:open-external",
  },
  chat: {
    sendMessage: "chat:send-message",
    cancelMessage: "chat:cancel-message",
    getConversation: "chat:get-conversation",
    clearConversation: "chat:clear-conversation",
    streamingText: "chat:streaming-text",
    conversationChanged: "chat:conversation-changed",
    functionCall: "chat:function-call",
    streamEnd: "chat:stream-end",
  },
  cards: {
    getActive: "cards:get-active",
    select: "cards:select",
    changed: "cards:changed",
  },
  settings: {
    get: "settings:get",
    set: "settings:set",
  },
  extensions: {
    getSlots: "extensions:get-slots",
    getSlotState: "extensions:get-slot-state",
    getDiscovered: "extensions:get-discovered",
    getDisabled: "extensions:get-disabled",
    setDisabled: "extensions:set-disabled",
    executeSlotAction: "extensions:execute-slot-action",
    slotStateChanged: "extensions:slot-state-changed",
    slotsChanged: "extensions:slots-changed",
    oauthGetState: "extensions:oauth-get-state",
    oauthStartFlow: "extensions:oauth-start-flow",
    oauthDisconnect: "extensions:oauth-disconnect",
    oauthConnected: "extensions:oauth-connected",
    oauthFailed: "extensions:oauth-failed",
    configGetStatus: "extensions:config-get-status",
    configGetSchema: "extensions:config-get-schema",
    configSetValues: "extensions:config-set-values",
    installFromGitHub: "extensions:install-from-github",
    uninstall: "extensions:uninstall",
    getUserInstalled: "extensions:get-user-installed",
    checkUpdates: "extensions:check-updates",
    update: "extensions:update",
  },
} as const;

export interface ExtensionConfigStatus {
  isConfigured: boolean;
  missingFields: string[];
  values: Record<string, unknown>;
}

export interface InstalledExtension {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
  repoUrl: string;
  installedAt: string;
}

export type InstallResult =
  | {
      success: true;
      extensionId: string;
      name: string;
      version: string;
      requiresConfiguration?: boolean;
      message?: string;
    }
  | { success: false; error: string };

export interface UpdateCheckResult {
  extensionId: string;
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  repoUrl: string;
}

export interface ChatMessageDto {
  sources?: SourceCitation[];
  role: "user" | "assistant";
  content: string;
}

export interface ElectronAPI {
  hasApiKey(): Promise<boolean>;
  setApiKey(key: string): Promise<OperationResult>;
  validateApiKey(key: string): Promise<ApiKeyValidationResult>;
  clearApiKey(): Promise<OperationResult>;
  openExternal(url: string): Promise<OperationResult>;

  sendMessage(message: string): Promise<OperationResult>;
  cancelMessage(): Promise<OperationResult>;
  getConversation(): Promise<ChatMessageDto[]>;
  clearConversation(): Promise<OperationResult>;
  onStreamingText(callback: (text: string) => void): () => void;
  onConversationChanged(
    callback: (conversation: ChatMessageDto[]) => void,
  ): () => void;
  onFunctionCall(
    callback: (name: string, args: Record<string, unknown>) => void,
  ): () => void;
  onStreamEnd(callback: () => void): () => void;

  getSettings(): Promise<CharacterSettings>;
  setSettings(settings: CharacterSettingsUpdate): Promise<OperationResult>;

  getActiveExtensionCard(): Promise<string | null>;
  selectExtensionCard(slotId: string | null): Promise<OperationResult>;
  onActiveExtensionCardChanged(
    callback: (slotId: string | null) => void,
  ): () => void;

  getExtensionSlots(): Promise<SlotInfo[]>;
  getSlotState(slotId: string): Promise<SerializedSlotState | null>;
  getDiscoveredExtensions(): Promise<ExtensionInfo[]>;
  getDisabledExtensions(): Promise<string[]>;
  setDisabledExtensions(extensionIds: string[]): Promise<OperationResult>;
  onSlotStateChanged(callback: (event: SlotChangeEvent) => void): () => void;
  onExtensionSlotsChanged(callback: () => void): () => void;
  executeSlotAction(
    slotId: string,
    request: SlotActionRequest,
  ): Promise<OperationResult>;

  getOAuthState(extensionId: string): Promise<OAuthState | null>;
  startOAuthFlow(extensionId: string): Promise<OperationResult>;
  disconnectOAuth(extensionId: string): Promise<OperationResult>;
  onOAuthConnected(callback: (event: OAuthConnectedEvent) => void): () => void;
  onOAuthFailed(callback: (event: OAuthFailedEvent) => void): () => void;
  getConfigStatus(extensionId: string): Promise<ExtensionConfigStatus | null>;
  getConfigSchema(extensionId: string): Promise<ConfigSchema | null>;
  setConfigValues(
    extensionId: string,
    values: Record<string, string | number | boolean>,
  ): Promise<OperationResult>;

  installExtensionFromGitHub(repoUrl: string): Promise<InstallResult>;
  uninstallExtension(extensionId: string): Promise<OperationResult>;
  getUserInstalledExtensions(): Promise<InstalledExtension[]>;
  checkExtensionUpdates(): Promise<UpdateCheckResult[]>;
  updateExtension(extensionId: string): Promise<InstallResult>;
}

export const sourceCitationSchema = z
  .object({
    url: z.url().refine((value) => {
      const url = new URL(value);
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        !url.username &&
        !url.password
      );
    }, "Source must be a public HTTP(S) link"),
    title: z.string().trim().min(1),
  })
  .strict();
export type SourceCitation = z.infer<typeof sourceCitationSchema>;

export interface AgentResponse {
  content: string;
  sources?: SourceCitation[];
}

/** Normalize old inline citations as well as structured search results. */
export function citedResponse(
  content: string,
  sources: readonly SourceCitation[] = [],
): AgentResponse {
  const unique = new Map(sources.map((source) => [source.url, source]));
  const text = content
    .replace(
      /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
      (match, title: string, url: string) => {
        const parsed = sourceCitationSchema.safeParse({ title, url });
        if (!parsed.success) return match;
        if (!unique.has(url)) unique.set(url, parsed.data);
        return "";
      },
    )
    .replace(/(?:^|\s)Sources?:\s*(?=\n|$)/gi, "")
    .trim();
  return unique.size
    ? {
        content: text.replace(/(?:^|\s)Sources?:[^\n]*$/i, "").trim(),
        sources: [...unique.values()],
      }
    : { content: text };
}
