/**
 * Host environment capability contracts shared with every extension at runtime.
 */

import type {
  ConfigSchema,
  ConfigValues,
  ExtensionConfigStatus,
  HostOAuthCapability,
} from "./config-schema.js";

/**
 * Core capability buckets that a host environment can expose.
 */
export type ExtensionHostCapability =
  | "storage"
  | "notifications"
  | "timers"
  | "scheduler"
  | "ipc"
  | "logger"
  | "oauth"
  | "config";

/**
 * Notification payload forwarded to the host.
 */
export interface NotificationRequest {
  title: string;
  body?: string;
  silent?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Callback invoked when an extension requests a notification.
 */
export type NotificationCallback = (notification: NotificationRequest) => void;

/**
 * Storage surface scoped per extension.
 */
export interface HostStorageCapability {
  read<T = unknown>(extensionId: string, key: string): Promise<T | undefined>;
  write<T = unknown>(extensionId: string, key: string, value: T): Promise<void>;
  delete(extensionId: string, key: string): Promise<void>;
  list(extensionId: string): Promise<string[]>;
  getDataPath?(extensionId: string): Promise<string> | string;
}

/**
 * Timers surface for scheduling callbacks.
 */
export interface HostTimersCapability {
  setTimeout(callback: () => void, delayMs: number): unknown;
  clearTimeout(handle: unknown): void;
  setInterval(callback: () => void, intervalMs: number): unknown;
  clearInterval(handle: unknown): void;
}

export type HostSchedulerPriority = "low" | "normal" | "high";

export interface HostScheduleOptions {
  delayMs?: number;
  priority?: HostSchedulerPriority;
}

/**
 * Cooperative scheduler for longer running work.
 */
export interface HostSchedulerCapability {
  schedule(task: () => Promise<void> | void, options?: HostScheduleOptions): Promise<void>;
}

/**
 * IPC bridge for broadcasting and subscribing to host channels.
 */
export interface HostIpcBridge {
  publish(channelId: string, payload: unknown): Promise<void> | void;
  subscribe(channelId: string, listener: (payload: unknown) => void): () => void;
}

/**
 * Structured logger for extensions.
 */
export interface HostLoggerCapability {
  debug(message: string, metadata?: Record<string, unknown>): void;
  info(message: string, metadata?: Record<string, unknown>): void;
  warn(message: string, metadata?: Record<string, unknown>): void;
  error(message: string, metadata?: Record<string, unknown>): void;
}

/**
 * Configuration capability for extensions that declare a configSchema.
 * Allows extensions to read/write their configuration values.
 */
export interface HostConfigCapability {
  /**
   * Get the config schema for this extension (from package.json)
   */
  getSchema(): ConfigSchema | undefined;

  /**
   * Get current configuration values
   */
  getValues(): ConfigValues;

  /**
   * Get configuration status (is configured, missing fields, etc.)
   */
  getStatus(): ExtensionConfigStatus;

  /**
   * Subscribe to config value changes
   */
  subscribe(listener: (values: ConfigValues) => void): () => void;

  /**
   * Update a config value (triggers persistence)
   * Note: Host may validate against schema
   */
  setValue(key: string, value: string | number | boolean): Promise<void>;

  /**
   * Check if the extension is fully configured
   */
  isConfigured(): boolean;
}

/**
 * Environment object delivered to every extension at runtime.
 */
export interface ExtensionHostEnvironment {
  readonly capabilities: ReadonlySet<ExtensionHostCapability>;
  readonly storage?: HostStorageCapability;
  readonly notifications?: NotificationCallback;
  readonly timers?: HostTimersCapability;
  readonly scheduler?: HostSchedulerCapability;
  readonly ipc?: HostIpcBridge;
  readonly logger?: HostLoggerCapability;

  /**
   * OAuth capability - present if extension declares oauth in package.json
   * Host handles the OAuth flow and token management
   */
  readonly oauth?: HostOAuthCapability;

  /**
   * Config capability - present if extension declares configSchema in package.json
   * Host handles config storage and UI for collecting values
   */
  readonly config?: HostConfigCapability;

  getDataPath?(extensionId: string): Promise<string> | string;
  readLegacyData?<T = unknown>(key: string): Promise<T | undefined>;
  schedulePersistence?(extensionId: string, reason?: string): Promise<void> | void;
}
