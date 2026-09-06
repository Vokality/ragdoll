# Example Weather Extension

A self-contained Ragdoll extension package demonstrating the canonical
manifest, `createExtension(config?)` export, and host-owned configuration.

## Build

```bash
bun run --filter @example/ragdoll-extension-weather build
```

## Package contract

`package.json` declares the extension ID, entrypoint, provided tool
capability, config schema, and optional `config` host capability.
`src/index.ts` exports one factory. The loader calls `createExtension`
and passes the host's stored config values; the runtime also reads
`host.config` so settings changes apply without a factory-only default.

```ts
import { createExtension } from "@example/ragdoll-extension-weather";
import {
  createRegistry,
  type ExtensionHostEnvironment,
} from "@vokality/ragdoll-extensions";

const host: ExtensionHostEnvironment = {
  capabilities: new Set(["config"]),
  config: {
    getSchema: () => ({}),
    getValues: () => ({ defaultUnits: "fahrenheit" }),
    getStatus: () => ({
      isConfigured: true,
      missingFields: [],
      values: { defaultUnits: "fahrenheit" },
    }),
    subscribe: () => () => undefined,
    setValue: async () => undefined,
    isConfigured: () => true,
  },
};

const weather = createExtension();
const registry = createRegistry({
  now: Date.now,
  onListenerError: console.error,
});
await registry.register(weather, { host });
```

Factory arguments are an in-process override used only when the host does
not grant `config` (for example packed-package smoke tests). Lumen stores
`defaultUnits` in host application storage and injects `host.config`.

```ts
import { createLoader } from "@vokality/ragdoll-extensions/loader";

await loader.loadPackage("@example/ragdoll-extension-weather", {
  defaultUnits: "celsius",
});
```

## Tool

`getWeather` accepts a city name and optional `celsius` or `fahrenheit`
units. It uses deterministic mock data so the example needs no network or
secret.

Use this package as the structural template for new extensions; replace
its domain behavior and package metadata rather than adding host-specific
imports. For OAuth and required secret config, follow Spotify and
[docs/extension-host-oauth.md](../../docs/extension-host-oauth.md).
