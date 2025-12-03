/**
 * Example Weather Extension for Ragdoll
 *
 * Demonstrates how to create an extension package that can be:
 * 1. Distributed via npm
 * 2. Auto-discovered by the ExtensionLoader
 * 3. Dynamically loaded at runtime
 *
 * To use this pattern for your own extension:
 * 1. Add "ragdollExtension": true (or config object) to package.json
 * 2. Export either:
 *    - A `createExtension(config?)` function
 *    - A named `extension` export
 *    - A default export
 */

import {
  createExtension,
  type RagdollExtension,
  type ToolResult,
  type ValidationResult,
} from "@vokality/ragdoll-extensions";

// =============================================================================
// Types
// =============================================================================

export type TemperatureUnits = "celsius" | "fahrenheit";

export interface WeatherExtensionConfig {
  defaultUnits?: TemperatureUnits;
  apiKey?: string;
}

export interface GetWeatherArgs {
  location: string;
  units?: TemperatureUnits;
}

export interface WeatherData {
  location: string;
  temperature: number;
  units: TemperatureUnits;
  condition: string;
  humidity: number;
}

// =============================================================================
// Constants
// =============================================================================

const VALID_UNITS: readonly TemperatureUnits[] = ["celsius", "fahrenheit"];

// =============================================================================
// Mock Weather Data (replace with real API in production)
// =============================================================================

const MOCK_WEATHER: Record<string, Omit<WeatherData, "location" | "units">> = {
  "new york": { temperature: 22, condition: "sunny", humidity: 45 },
  "london": { temperature: 15, condition: "cloudy", humidity: 72 },
  "tokyo": { temperature: 28, condition: "humid", humidity: 85 },
  "sydney": { temperature: 19, condition: "partly cloudy", humidity: 60 },
  "paris": { temperature: 18, condition: "rainy", humidity: 78 },
};

function getWeatherData(
  location: string,
  units: TemperatureUnits
): WeatherData | null {
  const normalizedLocation = location.toLowerCase().trim();
  const data = MOCK_WEATHER[normalizedLocation];

  if (!data) {
    return null;
  }

  let temperature = data.temperature;
  if (units === "fahrenheit") {
    temperature = Math.round((temperature * 9) / 5 + 32);
  }

  return {
    location: normalizedLocation,
    temperature,
    units,
    condition: data.condition,
    humidity: data.humidity,
  };
}

// =============================================================================
// Validators
// =============================================================================

function validateGetWeather(args: Record<string, unknown>): ValidationResult {
  if (!args.location || typeof args.location !== "string") {
    return { valid: false, error: "location is required and must be a string" };
  }

  if (args.location.trim().length === 0) {
    return { valid: false, error: "location cannot be empty" };
  }

  if (args.units !== undefined) {
    if (!VALID_UNITS.includes(args.units as TemperatureUnits)) {
      return {
        valid: false,
        error: `Invalid units '${args.units}'. Valid: ${VALID_UNITS.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

// =============================================================================
// Extension Factory
// =============================================================================

/**
 * Creates the weather extension with optional configuration.
 *
 * @param config - Optional configuration from package.json or manual override
 * @returns A RagdollExtension that provides weather tools
 *
 * @example
 * ```ts
 * // Manual registration
 * import { createWeatherExtension } from "@example/ragdoll-extension-weather";
 *
 * const weatherExt = createWeatherExtension({ defaultUnits: "fahrenheit" });
 * await registry.register(weatherExt);
 * ```
 */
export function createWeatherExtension(
  config: WeatherExtensionConfig = {}
): RagdollExtension {
  const defaultUnits = config.defaultUnits ?? "celsius";

  return createExtension({
    id: "weather",
    name: "Weather",
    version: "1.0.0",

    tools: [
      {
        definition: {
          type: "function",
          function: {
            name: "getWeather",
            description:
              "Get the current weather for a location. Returns temperature, condition, and humidity.",
            parameters: {
              type: "object",
              properties: {
                location: {
                  type: "string",
                  description:
                    "City name (e.g., 'New York', 'London', 'Tokyo')",
                },
                units: {
                  type: "string",
                  enum: VALID_UNITS,
                  description: `Temperature units (default: ${defaultUnits})`,
                },
              },
              required: ["location"],
            },
          },
        },
        handler: async (args, _context): Promise<ToolResult> => {
          const { location, units } = args as unknown as GetWeatherArgs;
          const resolvedUnits = units ?? defaultUnits;

          const weather = getWeatherData(location, resolvedUnits);

          if (!weather) {
            return {
              success: false,
              error: `Weather data not available for '${location}'. Try: New York, London, Tokyo, Sydney, or Paris.`,
            };
          }

          return {
            success: true,
            data: weather,
          };
        },
        validate: validateGetWeather,
      },
    ],

    onInitialize: (context) => {
      console.log(
        `[Weather Extension] Initialized with instance ID: ${context.instanceId}`
      );
      console.log(`[Weather Extension] Default units: ${defaultUnits}`);
    },

    onDestroy: () => {
      console.log("[Weather Extension] Destroyed");
    },
  });
}

// =============================================================================
// Exports
// =============================================================================

/**
 * Named export for auto-discovery by ExtensionLoader.
 * Uses default configuration.
 */
export const extension = createWeatherExtension();

/**
 * Default export (alternative for auto-discovery).
 * The loader will call this as a function if it's callable.
 */
export default createWeatherExtension;
