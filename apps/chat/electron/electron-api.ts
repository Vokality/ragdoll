import type {
  ModelProviderId,
  ModelProviderInfo,
  ProviderKey,
} from "./domain/model-provider.js";
import { fromMarkdown } from "mdast-util-from-markdown";
import { z } from "zod";
import type {
  ConfigSchema,
  SerializedSlotState,
} from "@vokality/ragdoll-extensions";
import type { PresetIconName } from "@vokality/ragdoll-extensions/slots";

export type OperationResult =
  { success: true } | { success: false; error: string };

export type { ModelProviderId, ModelProviderInfo, ProviderKey };

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

/** Public connection configuration; credentials never travel back to the renderer. */
export const connectionUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      !url.username &&
      !url.password &&
      !url.hash &&
      !url.search &&
      (url.protocol === "https:" ||
        (url.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))
    );
  }, "Use HTTPS (or local HTTP), without credentials, query parameters, or a fragment");

export const connectionAuthenticationSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("none") }),
  z.strictObject({ type: z.literal("bearer") }),
  z.strictObject({
    type: z.literal("oauth"),
    clientId: z.string().trim().min(1).optional(),
    clientMetadataUrl: z.url({ protocol: /^https$/ }).optional(),
    callbackPort: z.number().int().min(1024).max(65535).optional(),
  }),
]);
export const connectionConfigSchema = z.strictObject({
  name: z.string().trim().min(1).max(80),
  serverUrl: connectionUrlSchema,
  authentication: connectionAuthenticationSchema,
});
export const connectionRecordSchema = connectionConfigSchema.extend({
  id: z.uuid(),
  enabled: z.boolean(),
});
export const connectionSaveSchema = connectionConfigSchema
  .extend({
    id: z.uuid().optional(),
    bearerToken: z.string().trim().min(1).max(16384).optional(),
  })
  .superRefine((value, context) => {
    if (value.bearerToken && value.authentication.type !== "bearer")
      context.addIssue({
        code: "custom",
        message: "Tokens require bearer authentication",
      });
  });
export type ConnectionConfig = z.infer<typeof connectionConfigSchema>;
export type ConnectionRecord = z.infer<typeof connectionRecordSchema>;
export type ConnectionSave = z.infer<typeof connectionSaveSchema>;
export type ConnectionStatus =
  "disconnected" | "connecting" | "connected" | "needs_auth" | "error";
export interface ConnectionInfo extends ConnectionRecord {
  status: ConnectionStatus;
  toolCount: number;
  error?: string;
}

export const WORKING_MEMORY_LIMIT = 50;
export const memoryTierSchema = z.enum(["working", "long_term"]);
export const memoryFactSchema = z.strictObject({
  id: z.uuid(),
  text: z.string().trim().min(1).max(240),
  // Defaults migrate the original local notes without losing their IDs or text.
  tier: memoryTierSchema.default("working"),
  createdAt: z.number().int().nonnegative().default(0),
  lastUsedAt: z.number().int().nonnegative().default(0),
});
export type MemoryFact = z.infer<typeof memoryFactSchema>;
export type MemoryTier = z.infer<typeof memoryTierSchema>;
const memoryFactsSchema = z
  .array(memoryFactSchema)
  .superRefine((facts, ctx) => {
    if (
      facts.filter((fact) => fact.tier === "working").length >
      WORKING_MEMORY_LIMIT
    )
      ctx.addIssue({
        code: "custom",
        message: "Working memory holds at most 50 facts",
      });
    if (new Set(facts.map((fact) => fact.id)).size !== facts.length)
      ctx.addIssue({
        code: "custom",
        message: "Memory fact IDs must be unique",
      });
  });
export const userProfileSchema = z.strictObject({
  name: z.string().trim().min(1).max(80).nullable().default(null),
  nameDeclined: z.boolean().default(false),
  notes: memoryFactsSchema.default([]),
  longTermSummary: z.string().trim().min(1).max(2000).nullable().default(null),
  checkInsEnabled: z.boolean().default(true),
  revision: z.number().int().nonnegative().default(0),
});
export type UserProfile = z.infer<typeof userProfileSchema>;
export const profileEditSchema = z.strictObject({
  name: z.string().trim().min(1).max(80).nullable(),
  notes: z.array(memoryFactSchema.pick({ id: true, text: true, tier: true })),
  checkInsEnabled: z.boolean(),
  revision: z.number().int().nonnegative(),
});
export type ProfileEdit = z.infer<typeof profileEditSchema>;
export interface ExperienceSnapshot {
  profile: UserProfile;
  needsFirstAction: boolean;
  busy: boolean;
  error: string | null;
}
export type CharacterReaction =
  "working" | "completed" | "failed" | "welcome" | "timer-completed";

export const IPC_CHANNELS = {
  experience: {
    get: "experience:get",
    begin: "experience:begin",
    saveProfile: "experience:save-profile",
    changed: "experience:changed",
    reaction: "experience:reaction",
  },
  auth: {
    hasKey: "auth:has-key",
    providers: "auth:providers",
    selectProvider: "auth:select-provider",
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
  connections: {
    list: "connections:list",
    save: "connections:save",
    connect: "connections:connect",
    disconnect: "connections:disconnect",
    setEnabled: "connections:set-enabled",
    remove: "connections:remove",
    changed: "connections:changed",
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
  id: string;
  phase?: AssistantPhase | null;
  sources?: SourceCitation[];
  role: "user" | "assistant";
  content: string;
}

export interface ElectronAPI {
  getExperience(): Promise<ExperienceSnapshot>;
  beginExperience(): Promise<void>;
  saveProfile(input: ProfileEdit): Promise<void>;
  onExperienceChanged(callback: () => void): () => void;
  onCharacterReaction(
    callback: (reaction: CharacterReaction) => void,
  ): () => void;

  getConnections(): Promise<ConnectionInfo[]>;
  saveConnection(input: ConnectionSave): Promise<ConnectionInfo>;
  connectConnection(id: string): Promise<OperationResult>;
  disconnectConnection(id: string): Promise<OperationResult>;
  setConnectionEnabled(id: string, enabled: boolean): Promise<OperationResult>;
  removeConnection(id: string): Promise<OperationResult>;
  onConnectionsChanged(callback: () => void): () => void;

  hasApiKey(): Promise<boolean>;
  getModelProviders(): Promise<ModelProviderInfo[]>;
  selectModelProvider(provider: ModelProviderId): Promise<OperationResult>;
  setApiKey(key: ProviderKey): Promise<OperationResult>;
  validateApiKey(key: ProviderKey): Promise<ApiKeyValidationResult>;
  clearApiKey(provider?: ModelProviderId): Promise<OperationResult>;
  openExternal(url: string): Promise<OperationResult>;

  sendMessage(message: string): Promise<OperationResult>;
  cancelMessage(): Promise<OperationResult>;
  getConversation(): Promise<ChatMessageDto[]>;
  clearConversation(): Promise<OperationResult>;
  onStreamingText(
    callback: (text: string, messageId: string) => void,
  ): () => void;
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

export const sourceCitationSchema = z.strictObject({
  url: z.url().refine((value) => {
    const url = new URL(value);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.username &&
      !url.password
    );
  }, "Source must be a public HTTP(S) link"),
  title: z.string().trim().min(1),
});
export type SourceCitation = z.infer<typeof sourceCitationSchema>;

export type AssistantPhase = "commentary" | "final_answer";

export interface AgentResponse {
  phase?: AssistantPhase | null;
  content: string;
  sources?: SourceCitation[];
}

/** Normalize old inline citations as well as structured search results. */
export function citedResponse(
  content: string,
  sources: readonly SourceCitation[] = [],
): AgentResponse {
  const unique = new Map(sources.map((source) => [source.url, source]));
  // Parse Markdown so citation normalization never edits fenced/inline code or images.
  const tree = fromMarkdown(content);
  const removals: Array<{ start: number; end: number }> = [];
  type Node = (typeof tree.children)[number];
  const label = (node: Node): string =>
    "value" in node
      ? node.value
      : "children" in node
        ? node.children.map(label).join("")
        : "";
  const visit = (node: Node): void => {
    if (node.type === "link") {
      const parsed = sourceCitationSchema.safeParse({
        title: label(node),
        url: node.url,
      });
      const start = node.position?.start.offset;
      const end = node.position?.end.offset;
      if (parsed.success && start !== undefined && end !== undefined) {
        unique.set(parsed.data.url, unique.get(parsed.data.url) ?? parsed.data);
        removals.push({ start, end });
        return;
      }
    }
    if ("children" in node) node.children.forEach(visit);
  };
  tree.children.forEach(visit);
  if (unique.size) {
    for (const node of tree.children) {
      if (node.type !== "paragraph") continue;
      for (const child of node.children) {
        if (child.type !== "text") continue;
        const start = child.position?.start.offset;
        const end = child.position?.end.offset;
        if (start !== undefined && end !== undefined) {
          const suffix = (
            end === content.length
              ? /(?:^|\s)Sources?:[^\n]*$/i
              : /(?:^|\n)Sources?:[ \t]*$/i
          ).exec(content.slice(start, end));
          if (suffix) removals.push({ start: start + suffix.index, end });
        }
      }
    }
  }
  let text = content;
  for (const { start, end } of removals.sort((a, b) => b.start - a.start))
    text = text.slice(0, start) + text.slice(end);
  return unique.size
    ? { content: text.trim(), sources: [...unique.values()] }
    : { content: text.trim() };
}
