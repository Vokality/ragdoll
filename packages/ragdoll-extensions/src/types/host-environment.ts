/**
 * Host environment capability contracts shared with every extension at runtime.
 */

/**
 * Core capability buckets that a host environment can expose.
 */
export type ExtensionHostCapability =
  | "storage"
  | "notifications"
  | "timers"
  | "scheduler"
  | "ipc"
  | "logger";

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
  getDataPath?(extensionId: string): Promise<string> | string;
  readLegacyData?<T = unknown>(key: string): Promise<T | undefined>;
  schedulePersistence?(extensionId: string, reason?: string): Promise<void> | void;
}
