/**
 * Extension Configuration Schema Types
 *
 * Uses Zod for runtime validation and type inference.
 * Extensions can declare their configuration requirements in package.json
 * or programmatically using Zod schemas.
 */

import { z } from "zod";

// =============================================================================
// JSON Config Schema (for package.json declarations)
// =============================================================================

/**
 * JSON-serializable config field definition (for package.json)
 * This is parsed and converted to a Zod schema at runtime.
 */
export const ConfigFieldSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("string"),
    label: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    default: z.string().optional(),
    secret: z.boolean().optional(),
    placeholder: z.string().optional(),
    minLength: z.number().optional(),
    maxLength: z.number().optional(),
    pattern: z.string().optional(),
  }),
  z.object({
    type: z.literal("number"),
    label: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    default: z.number().optional(),
    secret: z.boolean().optional(),
    placeholder: z.string().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
  }),
  z.object({
    type: z.literal("boolean"),
    label: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    default: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("select"),
    label: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional(),
    default: z.string().optional(),
    options: z.array(
      z.object({
        value: z.string(),
        label: z.string(),
      }),
    ),
  }),
]);

export type ConfigField = z.infer<typeof ConfigFieldSchema>;

/**
 * Configuration schema - map of field names to field definitions
 */
export const ConfigSchemaSchema = z.record(z.string(), ConfigFieldSchema);
export type ConfigSchema = z.infer<typeof ConfigSchemaSchema>;

// =============================================================================
// OAuth Configuration Types
// =============================================================================

/**
 * OAuth provider configuration schema
 */
const secureOAuthEndpointSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === "https:", {
    message: "OAuth endpoints must use HTTPS",
  });

export const OAuthConfigSchema = z
  .object({
    /** Provider identifier (used in redirect URL) */
    provider: z.string(),
    /** OAuth authorization endpoint URL */
    authorizationUrl: secureOAuthEndpointSchema,
    /** OAuth token exchange endpoint URL */
    tokenUrl: secureOAuthEndpointSchema,
    /** OAuth scopes to request */
    scopes: z
      .array(z.string().min(1))
      .min(1)
      .refine((values) => new Set(values).size === values.length, {
        message: "OAuth scopes must not contain duplicates",
      }),
    /** Configuration field containing the public OAuth client ID */
    clientIdConfigKey: z.string().min(1),
    /** Fixed loopback callback port when required by the provider */
    callbackPort: z.number().int().min(1024).max(65535).optional(),
    /** Native extension OAuth always uses PKCE */
    pkce: z.literal(true),
    /** Additional authorization parameters */
    additionalAuthParams: z.record(z.string(), z.string()).optional(),
    /** Additional token request parameters */
    additionalTokenParams: z.record(z.string(), z.string()).optional(),
  })
  .strict();

export type OAuthConfig = z.infer<typeof OAuthConfigSchema>;

/**
 * OAuth tokens schema
 */
export const OAuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiresAt: z.number().optional(),
  scope: z.string().optional(),
  tokenType: z.string().optional(),
});

export type OAuthTokens = z.infer<typeof OAuthTokensSchema>;

/**
 * OAuth connection status
 */
export const OAuthConnectionStatusSchema = z.enum([
  "disconnected",
  "connecting",
  "connected",
  "error",
  "expired",
]);

export type OAuthConnectionStatus = z.infer<typeof OAuthConnectionStatusSchema>;

/**
 * OAuth state schema
 */
export const OAuthStateSchema = z.object({
  status: OAuthConnectionStatusSchema,
  isAuthenticated: z.boolean(),
  error: z.string().optional(),
  expiresAt: z.number().optional(),
});

export type OAuthState = z.infer<typeof OAuthStateSchema>;

// =============================================================================
// Host OAuth Capability Types
// =============================================================================

/**
 * OAuth capability provided by the host environment to extensions
 */
export interface HostOAuthCapability {
  /** Get the current OAuth state */
  getState(): OAuthState;

  /** Subscribe to OAuth state changes */
  subscribe(listener: (state: OAuthState) => void): () => void;

  /** Start the OAuth authorization flow */
  startFlow(): Promise<string>;

  /** Get the current access token (refreshes if needed) */
  getAccessToken(): Promise<string | null>;

  /** Disconnect / logout - clears stored tokens */
  disconnect(): Promise<void>;

  /** Check if currently authenticated with valid tokens */
  isAuthenticated(): boolean;
}

/**
 * OAuth event types
 */
export type OAuthEventType =
  | "oauth:connected"
  | "oauth:disconnected"
  | "oauth:error"
  | "oauth:token-refreshed"
  | "oauth:expired";

/**
 * OAuth event payload
 */
export interface OAuthEvent {
  type: OAuthEventType;
  state: OAuthState;
  timestamp: number;
}

export type OAuthEventCallback = (event: OAuthEvent) => void;

// =============================================================================
// Config Values Types
// =============================================================================

/**
 * Resolved configuration values
 */
export type ConfigValues = Record<string, string | number | boolean>;

/**
 * Configuration status for an extension
 */
export interface ExtensionConfigStatus {
  /** Whether all required config fields have values */
  isConfigured: boolean;
  /** List of missing required fields */
  missingFields: string[];
  /** Current config values (secrets redacted) */
  values: Record<string, unknown>;
}

// =============================================================================
// Zod Schema Builders
// =============================================================================

/**
 * Convert a JSON config schema to a Zod schema for runtime validation.
 */
export function configSchemaToZod(
  schema: ConfigSchema,
): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, field] of Object.entries(schema)) {
    let fieldSchema: z.ZodTypeAny;

    switch (field.type) {
      case "string": {
        let s = z.string();
        if (field.minLength !== undefined) s = s.min(field.minLength);
        if (field.maxLength !== undefined) s = s.max(field.maxLength);
        if (field.pattern) s = s.regex(new RegExp(field.pattern));
        fieldSchema = s;
        break;
      }
      case "number": {
        let n = z.number();
        if (field.min !== undefined) n = n.min(field.min);
        if (field.max !== undefined) n = n.max(field.max);
        fieldSchema = n;
        break;
      }
      case "boolean": {
        fieldSchema = z.boolean();
        break;
      }
      case "select": {
        const values = field.options.map((o) => o.value) as [
          string,
          ...string[],
        ];
        fieldSchema = z.enum(values);
        break;
      }
    }

    // Handle optional/required and defaults
    if (field.default !== undefined) {
      fieldSchema = fieldSchema.default(field.default);
    }
    if (!field.required) {
      fieldSchema = fieldSchema.optional();
    }

    shape[key] = fieldSchema;
  }

  return z.object(shape);
}

/**
 * Validate config values against a config schema.
 * Returns { success: true, data } or { success: false, error }.
 */
export function validateConfigValues(
  schema: ConfigSchema,
  values: Record<string, unknown>,
): { success: true; data: ConfigValues } | { success: false; error: string } {
  const zodSchema = configSchemaToZod(schema);
  const result = zodSchema.safeParse(values);

  if (result.success) {
    return { success: true, data: result.data as ConfigValues };
  }

  // Format Zod errors into a readable message
  const issues = result.error.issues ?? [];
  const errors = issues.map((e) => {
    const path = e.path.map(String).join(".");
    return `${path}: ${e.message}`;
  });
  return { success: false, error: errors.join("; ") };
}

/**
 * Get missing required fields from a config schema.
 */
export function getMissingRequiredFields(
  schema: ConfigSchema,
  values: Record<string, unknown>,
): string[] {
  const missing: string[] = [];

  for (const [key, field] of Object.entries(schema)) {
    if (field.required) {
      const value = values[key];
      if (value === undefined || value === null || value === "") {
        missing.push(key);
      }
    }
  }

  return missing;
}

/**
 * Apply defaults from a config schema to values.
 */
export function applyConfigDefaults(
  schema: ConfigSchema,
  values: Record<string, unknown>,
): ConfigValues {
  const result: ConfigValues = { ...values } as ConfigValues;

  for (const [key, field] of Object.entries(schema)) {
    if (result[key] === undefined && field.default !== undefined) {
      result[key] = field.default as string | number | boolean;
    }
  }

  return result;
}

// Re-export z for extensions that want to use Zod directly
export { z };
