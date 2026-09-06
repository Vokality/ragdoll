/**
 * Example Weather Extension for Ragdoll
 *
 * Demonstrates how to create an extension package that can be:
 * 1. Distributed via npm
 * 2. Auto-discovered by the ExtensionLoader
 * 3. Dynamically loaded at runtime
 *
 * Host-owned configuration is the source of truth. Factory arguments are an
 * optional override for in-process registration when no host config is present.
 *
 * To use this pattern for your own extension:
 * 1. Add a `ragdollExtension` manifest to package.json
 * 2. Export a `createExtension(config?)` function
 */

import {
  createExtension as defineExtension,
  type ExtensionHostEnvironment,
  type RagdollExtension,
  type ToolResult,
  type ValidationResult,
} from "@vokality/ragdoll-extensions";

export type TemperatureUnits = "celsius" | "fahrenheit";

export interface WeatherExtensionConfig {
  defaultUnits?: TemperatureUnits;
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

const VALID_UNITS: readonly TemperatureUnits[] = ["celsius", "fahrenheit"];

const MOCK_WEATHER: Record<string, Omit<WeatherData, "location" | "units">> = {
  "new york": { temperature: 22, condition: "sunny", humidity: 45 },
  london: { temperature: 15, condition: "cloudy", humidity: 72 },
  tokyo: { temperature: 28, condition: "humid", humidity: 85 },
  sydney: { temperature: 19, condition: "partly cloudy", humidity: 60 },
  paris: { temperature: 18, condition: "rainy", humidity: 78 },
};

function getWeatherData(
  location: string,
  units: TemperatureUnits,
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

function resolveDefaultUnits(
  host: ExtensionHostEnvironment,
  factoryConfig: WeatherExtensionConfig,
): TemperatureUnits {
  const fromHost = host.config?.getValues().defaultUnits;
  if (fromHost === "celsius" || fromHost === "fahrenheit") {
    return fromHost;
  }
  return factoryConfig.defaultUnits ?? "celsius";
}

/**
 * Creates the weather extension with optional factory configuration.
 *
 * When the host grants `config`, `defaultUnits` is read from `host.config`
 * at tool execution time. Factory arguments apply only when host config is
 * absent (manual in-process registration).
 */
export function createExtension(
  config: WeatherExtensionConfig = {},
): RagdollExtension {
  return defineExtension({
    id: "weather",
    name: "Weather",
    version: "1.0.0",
    description: "Example weather lookup tools",
    optionalCapabilities: ["config"],
    tools: (host) => [
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
                  description:
                    "Temperature units (default comes from host config)",
                },
              },
              required: ["location"],
            },
          },
        },
        handler: async (args): Promise<ToolResult> => {
          const { location, units } = args as unknown as GetWeatherArgs;
          const resolvedUnits = units ?? resolveDefaultUnits(host, config);

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
  });
}
