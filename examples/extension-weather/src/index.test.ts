import { describe, expect, it } from "bun:test";
import {
  createRegistry,
  type ExtensionHostCapability,
  type ExtensionHostEnvironment,
  type HostConfigCapability,
} from "@vokality/ragdoll-extensions";
import {
  createExtensionPackageDescriptor,
  parseExtensionPackageJson,
} from "@vokality/ragdoll-extensions/loader";
import packageJson from "../package.json" with { type: "json" };
import { createExtension } from "./index.js";

function configHost(
  values: Record<string, string | number | boolean>,
): ExtensionHostEnvironment {
  const config: HostConfigCapability = {
    getSchema: () => ({}),
    getValues: () => values,
    getStatus: () => ({
      isConfigured: true,
      missingFields: [],
      values,
    }),
    subscribe: () => () => undefined,
    setValue: async () => undefined,
    isConfigured: () => true,
  };
  return {
    capabilities: new Set<ExtensionHostCapability>(["config"]),
    config,
  };
}

describe("Weather extension", () => {
  it("declares optional host config in package and runtime manifests", () => {
    const descriptor = createExtensionPackageDescriptor(
      parseExtensionPackageJson(JSON.stringify(packageJson)),
    );
    expect(descriptor?.optionalCapabilities).toEqual(["config"]);
    expect(createExtension().manifest.optionalCapabilities).toEqual(["config"]);
  });

  it("uses factory defaultUnits when host config is absent", async () => {
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension({ defaultUnits: "fahrenheit" }), {
      host: { capabilities: new Set() },
    });
    const result = await registry.executeTool("getWeather", {
      location: "Paris",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ units: "fahrenheit" });
    await registry.destroy();
  });

  it("prefers host.config defaultUnits over factory arguments", async () => {
    const registry = createRegistry({
      now: Date.now,
      onListenerError: () => undefined,
    });
    await registry.register(createExtension({ defaultUnits: "celsius" }), {
      host: configHost({ defaultUnits: "fahrenheit" }),
    });
    const result = await registry.executeTool("getWeather", {
      location: "Paris",
    });
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({ units: "fahrenheit" });
    await registry.destroy();
  });
});
