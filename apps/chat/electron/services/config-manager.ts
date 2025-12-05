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
} from "@vokality/ragdoll-extensions/core";

// =============================================================================
// Types
// =============================================================================

export interface ConfigManagerConfig {
  /** Extension ID */
  extensionId: string;
  /** Config schema from package.json */
  schema?: ConfigSchema;
  /** Load config values from storage */
  loadValues: () => Promise<ConfigValues | null>;
  /** Save config values to storage */
  saveValues: (values: ConfigValues) => Promise<void>;
  /** Logger */
  logger?: {
    debug: (...args: unknown[]) => void;
    info: (...args: unknown[]) => void;
    warn: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
}

type ConfigChangeListener = (values: ConfigValues) => void;

// =============================================================================
// Config Manager
// =============================================================================

export class ConfigManager implements HostConfigCapability {
  private config: ConfigManagerConfig;
  private values: ConfigValues = {};
  private listeners: Set<ConfigChangeListener> = new Set();
  private initialized = false;

  constructor(config: ConfigManagerConfig) {
    this.config = config;

    // Initialize with defaults from schema
    if (config.schema) {
      for (const [key, field] of Object.entries(config.schema)) {
        if (field.default !== undefined) {
          this.values[key] = field.default as string | number | boolean;
        }
      }
    }
  }

  /**
   * Initialize the manager - load existing values from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      const stored = await this.config.loadValues();
      if (stored) {
        this.values = { ...this.values, ...stored };
      }
    } catch (error) {
      this.log("error", "Failed to load config:", error);
    }

    this.initialized = true;
  }

  // ===========================================================================
  // HostConfigCapability Implementation
  // ===========================================================================

  getSchema(): ConfigSchema | undefined {
    return this.config.schema;
  }

  getValues(): ConfigValues {
    return { ...this.values };
  }

  getStatus(): ExtensionConfigStatus {
    const schema = this.config.schema;
    const missingFields: string[] = [];

    if (schema) {
      for (const [key, field] of Object.entries(schema)) {
        if (field.required && (this.values[key] === undefined || this.values[key] === "")) {
          missingFields.push(key);
        }
      }
    }

    // Create values with secrets redacted for display
    const redactedValues: Record<string, unknown> = {};
    if (schema) {
      for (const [key, field] of Object.entries(schema)) {
        const value = this.values[key];
        // secret property only exists on string and number types
        const isSecret = "secret" in field && field.secret;
        if (isSecret && value) {
          redactedValues[key] = "********";
        } else {
          redactedValues[key] = value;
        }
      }
    } else {
      Object.assign(redactedValues, this.values);
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

  async setValue(key: string, value: string | number | boolean): Promise<void> {
    const schema = this.config.schema;

    // Validate against schema if present
    if (schema && schema[key]) {
      const field = schema[key];
      const error = this.validateValue(key, value, field);
      if (error) {
        throw new Error(error);
      }
    }

    this.values[key] = value;

    // Save to storage
    await this.config.saveValues(this.values);

    // Notify listeners
    this.emitChange();

    this.log("debug", `Config value set: ${key}`);
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
    const schema = this.config.schema;

    // Validate all values first
    if (schema) {
      for (const [key, value] of Object.entries(values)) {
        if (schema[key]) {
          const error = this.validateValue(key, value, schema[key]);
          if (error) {
            throw new Error(error);
          }
        }
      }
    }

    // Apply all values
    Object.assign(this.values, values);

    // Save to storage
    await this.config.saveValues(this.values);

    // Notify listeners
    this.emitChange();

    this.log("debug", `Config values updated`);
  }

  /**
   * Clear all config values
   */
  async clear(): Promise<void> {
    this.values = {};

    // Re-apply defaults
    if (this.config.schema) {
      for (const [key, field] of Object.entries(this.config.schema)) {
        if (field.default !== undefined) {
          this.values[key] = field.default as string | number | boolean;
        }
      }
    }

    await this.config.saveValues(this.values);
    this.emitChange();
  }

  // ===========================================================================
  // Private Helpers
  // ===========================================================================

  private validateValue(
    key: string,
    value: unknown,
    field: ConfigSchema[string]
  ): string | null {
    // Type check
    if (field.type === "string" && typeof value !== "string") {
      return `${key} must be a string`;
    }
    if (field.type === "number" && typeof value !== "number") {
      return `${key} must be a number`;
    }
    if (field.type === "boolean" && typeof value !== "boolean") {
      return `${key} must be a boolean`;
    }

    // String-specific validation
    if (field.type === "string" && typeof value === "string") {
      const stringField = field as { minLength?: number; maxLength?: number; pattern?: string };
      if (stringField.minLength !== undefined && value.length < stringField.minLength) {
        return `${key} must be at least ${stringField.minLength} characters`;
      }
      if (stringField.maxLength !== undefined && value.length > stringField.maxLength) {
        return `${key} must be at most ${stringField.maxLength} characters`;
      }
      if (stringField.pattern) {
        const regex = new RegExp(stringField.pattern);
        if (!regex.test(value)) {
          return `${key} does not match required pattern`;
        }
      }
    }

    // Number-specific validation
    if (field.type === "number" && typeof value === "number") {
      const numberField = field as { min?: number; max?: number };
      if (numberField.min !== undefined && value < numberField.min) {
        return `${key} must be at least ${numberField.min}`;
      }
      if (numberField.max !== undefined && value > numberField.max) {
        return `${key} must be at most ${numberField.max}`;
      }
    }

    // Select validation
    if (field.type === "select" && typeof value === "string") {
      const selectField = field as { options: Array<{ value: string }> };
      const validValues = selectField.options.map((o) => o.value);
      if (!validValues.includes(value)) {
        return `${key} must be one of: ${validValues.join(", ")}`;
      }
    }

    return null;
  }

  private emitChange(): void {
    const values = this.getValues();
    for (const listener of this.listeners) {
      try {
        listener(values);
      } catch (error) {
        this.log("error", "Error in config listener:", error);
      }
    }
  }

  private log(level: "debug" | "info" | "warn" | "error", ...args: unknown[]): void {
    const logger = this.config.logger;
    if (logger) {
      logger[level](`[Config:${this.config.extensionId}]`, ...args);
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.listeners.clear();
  }
}

// =============================================================================
// Factory Function
// =============================================================================

export function createConfigManager(config: ConfigManagerConfig): ConfigManager {
  return new ConfigManager(config);
}
