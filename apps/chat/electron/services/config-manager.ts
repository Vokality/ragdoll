/**
 * Extension Config Manager - Handles configuration for extensions.
 *
 * This manager:
 * - Stores extension configuration values
 * - Validates against config schema
 * - Tracks which required fields are missing
 * - Provides HostConfigCapability to extensions
 */

import type {
  ConfigSchema,
  ConfigValues,
  ExtensionConfigStatus,
  HostConfigCapability,
} from "@vokality/ragdoll-extensions";
import type { ServiceLogger } from "./service-logger.js";

// =============================================================================
// Types
// =============================================================================

export interface ConfigManagerConfig {
  /** Extension ID */
  extensionId: string;
  /** Config schema from package.json */
  schema: ConfigSchema;
  /** Load config values from storage */
  loadValues: () => Promise<ConfigValues | null>;
  /** Save config values to storage */
  saveValues: (values: ConfigValues) => Promise<void>;
  /** Logger */
  logger: ServiceLogger;
}

type ConfigChangeListener = (values: ConfigValues) => void;

// =============================================================================
// Config Manager
// =============================================================================

export class ConfigManager implements HostConfigCapability {
  private readonly config: ConfigManagerConfig;
  private values: ConfigValues = {};
  private listeners: Set<ConfigChangeListener> = new Set();
  private initialized = false;
  private updates = Promise.resolve();

  constructor(config: ConfigManagerConfig) {
    this.config = config;

    // Initialize with defaults from schema
    for (const [key, field] of Object.entries(config.schema)) {
      if (field.default !== undefined) {
        const error = this.validateValue(key, field.default, field);
        if (error) throw new Error(error);
        this.values[key] = field.default;
      }
    }
  }

  /**
   * Initialize the manager - load existing values from storage
   */
  initialize(): Promise<void> {
    return this.enqueue(async () => {
      if (this.initialized) return;
      const stored = await this.config.loadValues();
      if (stored) {
        this.validateValues(stored);
        this.values = { ...this.values, ...stored };
      }
      this.initialized = true;
    });
  }

  // ===========================================================================
  // HostConfigCapability Implementation
  // ===========================================================================

  getSchema(): ConfigSchema {
    return this.config.schema;
  }

  getValues(): ConfigValues {
    return { ...this.values };
  }

  getStatus(): ExtensionConfigStatus {
    const missingFields: string[] = [];

    for (const [key, field] of Object.entries(this.config.schema)) {
      if (
        field.required &&
        (this.values[key] === undefined || this.values[key] === "")
      ) {
        missingFields.push(key);
      }
    }

    // Create values with secrets redacted for display
    const redactedValues: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(this.config.schema)) {
      const value = this.values[key];
      // secret property only exists on string and number types
      const isSecret = "secret" in field && field.secret;
      if (isSecret && value !== undefined && value !== "") {
        redactedValues[key] = "********";
      } else {
        redactedValues[key] = value;
      }
    }

    return {
      isConfigured: missingFields.length === 0,
      missingFields,
      values: redactedValues,
    };
  }

  subscribe(listener: ConfigChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setValue(key: string, value: string | number | boolean): Promise<void> {
    return this.setValues({ [key]: value });
  }

  isConfigured(): boolean {
    return this.getStatus().isConfigured;
  }

  // ===========================================================================
  // Additional Methods
  // ===========================================================================

  /**
   * Set multiple values at once
   */
  async setValues(values: ConfigValues): Promise<void> {
    const changes = { ...values };
    this.validateValues(changes);
    await this.enqueue(async () => {
      const nextValues = { ...this.values, ...changes };
      await this.config.saveValues(nextValues);
      this.values = nextValues;
      this.emitChange();
      this.log("debug", "Config values updated");
    });
  }

  /**
   * Clear all config values
   */
  clear(): Promise<void> {
    return this.enqueue(async () => {
      const nextValues: ConfigValues = {};
      for (const [key, field] of Object.entries(this.config.schema)) {
        if (field.default !== undefined) nextValues[key] = field.default;
      }
      await this.config.saveValues(nextValues);
      this.values = nextValues;
      this.emitChange();
    });
  }

  private enqueue(operation: () => Promise<void>): Promise<void> {
    const result = this.updates.then(operation);
    this.updates = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  private validateValues(values: ConfigValues): void {
    for (const [key, value] of Object.entries(values)) {
      if (!Object.hasOwn(this.config.schema, key))
        throw new Error(`Unknown config field: ${key}`);
      const error = this.validateValue(key, value, this.config.schema[key]);
      if (error) throw new Error(error);
    }
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private validateValue(
    key: string,
    value: unknown,
    field: ConfigSchema[string],
  ): string | null {
    // Type check
    if (
      (field.type === "string" || field.type === "select") &&
      typeof value !== "string"
    ) {
      return `${key} must be a string`;
    }
    if (
      field.type === "number" &&
      (typeof value !== "number" || !Number.isFinite(value))
    ) {
      return `${key} must be a finite number`;
    }
    if (field.type === "boolean" && typeof value !== "boolean") {
      return `${key} must be a boolean`;
    }

    // String-specific validation
    if (field.type === "string" && typeof value === "string") {
      if (field.minLength !== undefined && value.length < field.minLength) {
        return `${key} must be at least ${field.minLength} characters`;
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        return `${key} must be at most ${field.maxLength} characters`;
      }
      if (field.pattern) {
        const regex = new RegExp(field.pattern);
        if (!regex.test(value)) {
          return `${key} does not match required pattern`;
        }
      }
    }

    // Number-specific validation
    if (field.type === "number" && typeof value === "number") {
      if (field.min !== undefined && value < field.min) {
        return `${key} must be at least ${field.min}`;
      }
      if (field.max !== undefined && value > field.max) {
        return `${key} must be at most ${field.max}`;
      }
    }

    // Select validation
    if (field.type === "select" && typeof value === "string") {
      const validValues = field.options.map((o) => o.value);
      if (!validValues.includes(value)) {
        return `${key} must be one of: ${validValues.join(", ")}`;
      }
    }

    return null;
  }

  private emitChange(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.getValues());
      } catch (error) {
        this.log("error", "Error in config listener:", error);
      }
    }
  }

  private log(
    level: "debug" | "info" | "warn" | "error",
    ...args: unknown[]
  ): void {
    this.config.logger[level](`[Config:${this.config.extensionId}]`, ...args);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.listeners.clear();
  }
}
