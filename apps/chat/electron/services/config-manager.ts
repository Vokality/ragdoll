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
  private config: ConfigManagerConfig;
  private values: ConfigValues = {};
  private listeners: Set<ConfigChangeListener> = new Set();
  private initialized = false;

  constructor(config: ConfigManagerConfig) {
    this.config = config;

    // Initialize with defaults from schema
    for (const [key, field] of Object.entries(config.schema)) {
      if (field.default !== undefined) {
        this.values[key] = field.default as string | number | boolean;
      }
    }
  }

  /**
   * Initialize the manager - load existing values from storage
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const stored = await this.config.loadValues();
    if (stored) {
      for (const [key, value] of Object.entries(stored)) {
        const field = this.config.schema[key];
        if (!field) throw new Error(`Unknown config field: ${key}`);
        const error = this.validateValue(key, value, field);
        if (error) throw new Error(error);
      }
      this.values = { ...this.values, ...stored };
    }

    this.initialized = true;
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
      if (isSecret && value) {
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

  async setValue(key: string, value: string | number | boolean): Promise<void> {
    const field = this.config.schema[key];
    if (!field) throw new Error(`Unknown config field: ${key}`);
    const error = this.validateValue(key, value, field);
    if (error) throw new Error(error);

    const nextValues = { ...this.values, [key]: value };
    await this.config.saveValues(nextValues);
    this.values = nextValues;

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
    // Validate all values first
    for (const [key, value] of Object.entries(values)) {
      const field = this.config.schema[key];
      if (!field) throw new Error(`Unknown config field: ${key}`);
      const error = this.validateValue(key, value, field);
      if (error) {
        throw new Error(error);
      }
    }

    const nextValues = { ...this.values, ...values };
    await this.config.saveValues(nextValues);
    this.values = nextValues;

    // Notify listeners
    this.emitChange();

    this.log("debug", `Config values updated`);
  }

  /**
   * Clear all config values
   */
  async clear(): Promise<void> {
    const nextValues: ConfigValues = {};

    // Re-apply defaults
    for (const [key, field] of Object.entries(this.config.schema)) {
      if (field.default !== undefined) {
        nextValues[key] = field.default as string | number | boolean;
      }
    }

    await this.config.saveValues(nextValues);
    this.values = nextValues;
    this.emitChange();
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
      const stringField = field as {
        minLength?: number;
        maxLength?: number;
        pattern?: string;
      };
      if (
        stringField.minLength !== undefined &&
        value.length < stringField.minLength
      ) {
        return `${key} must be at least ${stringField.minLength} characters`;
      }
      if (
        stringField.maxLength !== undefined &&
        value.length > stringField.maxLength
      ) {
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
