# Example Weather Extension

A self-contained Ragdoll extension package demonstrating the canonical manifest and factory export.

## Build

```bash
bun run --filter @example/ragdoll-extension-weather build
```

## Package contract

`package.json` declares the extension ID, entrypoint, provided tool capability, config schema, and absence of required host capabilities. `src/index.ts` exports one canonical factory:

```ts
import { createExtension } from "@example/ragdoll-extension-weather";

const weather = createExtension({ defaultUnits: "fahrenheit" });
await registry.register(weather, { host });
```

The package loader calls the same factory and supplies validated host config:

```ts
import { createLoader } from "@vokality/ragdoll-extensions/loader";

const loader = createLoader(registry, {
  packageRoots: [{ path: extensionsDirectory, layout: "installed" }],
  fileSystem: hostFileSystem,
  hostEnvironment: host,
});

await loader.loadPackage("@example/ragdoll-extension-weather", {
  defaultUnits: "celsius",
});
```

## Tool

`getWeather` accepts a city name and optional `celsius` or `fahrenheit` units. It uses deterministic mock data so the example needs no network or secret.

Use this package as the structural template for new extensions; replace its domain behavior and package metadata rather than adding host-specific imports.
