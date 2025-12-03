# Example Weather Extension

This is an example extension package that demonstrates how to create distributable Ragdoll extensions.

## What This Demonstrates

1. **Package Structure** - How to set up `package.json` with `ragdollExtension` config
2. **Extension Factory** - Using `createExtension()` to define tools
3. **Auto-Discovery** - How the ExtensionLoader finds and loads your package
4. **Multiple Export Formats** - Supporting various import patterns

## Installation

```bash
# In a project using @vokality/ragdoll-extensions
bun add @example/ragdoll-extension-weather
```

## Usage

### Auto-Discovery (Recommended)

If your project uses the ExtensionLoader, the extension is automatically discovered:

```typescript
import { createRegistry, createLoader } from "@vokality/ragdoll-extensions";
import path from "path";

const registry = createRegistry();
const loader = createLoader(registry, {
  searchPaths: [path.join(process.cwd(), "node_modules")],
});

// This will find and load the weather extension automatically
await loader.discoverAndLoad();
```

### Manual Registration

```typescript
import { createRegistry } from "@vokality/ragdoll-extensions";
import { createWeatherExtension } from "@example/ragdoll-extension-weather";

const registry = createRegistry();

const weatherExtension = createWeatherExtension({
  defaultUnits: "fahrenheit",
});

await registry.register(weatherExtension);
```

## Tools Provided

### `getWeather`

Get the current weather for a location.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `location` | string | Yes | City name (e.g., "New York", "London") |
| `units` | string | No | Temperature units: "celsius" or "fahrenheit" |

**Example:**

```typescript
const result = await registry.executeTool("getWeather", {
  location: "Tokyo",
  units: "celsius",
});

// Result:
// {
//   success: true,
//   data: {
//     location: "tokyo",
//     temperature: 28,
//     units: "celsius",
//     condition: "humid",
//     humidity: 85
//   }
// }
```

## Configuration

Configure via `package.json`:

```json
{
  "ragdollExtension": {
    "id": "weather",
    "config": {
      "defaultUnits": "celsius"
    }
  }
}
```

Or pass config when creating manually:

```typescript
createWeatherExtension({
  defaultUnits: "fahrenheit",
  apiKey: "your-api-key", // For real weather APIs
});
```

## Creating Your Own Extension

Use this example as a template:

1. **Create package.json** with `ragdollExtension` field:
   ```json
   {
     "name": "@your-org/ragdoll-extension-xyz",
     "ragdollExtension": true
   }
   ```

2. **Export your extension** (one of these):
   ```typescript
   // Option 1: Named export
   export const extension = createExtension({ ... });

   // Option 2: Factory function (receives config)
   export function createExtension(config) { ... }

   // Option 3: Default export
   export default myExtension;
   ```

3. **Publish to npm** and users can auto-discover it!

## License

MIT