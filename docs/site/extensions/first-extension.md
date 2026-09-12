# Your first extension

The repository's maintained starting point is [`examples/extension-weather`](https://github.com/Vokality/ragdoll/tree/main/examples/extension-weather). It includes a manifest, TypeScript configuration, a factory, and tests. Its weather data is a deterministic demonstration dataset, **not a live weather service**.

## Build the reference package

From the repository root after [setup](../getting-started.md):

```bash
bun run build:libraries
bun run --filter @example/ragdoll-extension-weather build
bun run --filter @example/ragdoll-extension-weather test
bun run --filter @example/ragdoll-extension-weather typecheck
```

Building an example does not automatically activate it in Lumen. See [distribution](./distribution.md) for installation.

## Test a first-party package in Lumen

For a first-party package under `packages/ragdoll-extension-*`:

1. Add the package as a `workspace:*` dependency in `apps/chat/package.json`.
2. Import its factory and canonical `package.json` descriptor in `apps/chat/electron/built-in-extensions.ts`, and register them in `BUILT_IN_EXTENSIONS` using `defineBuiltInExtension`.
3. Run `bun install` to register the workspace dependency. Add host integration coverage and include the package in `scripts/verify-packages.ts`.
4. Stop the previous development command, then run `bun run dev:chat`. It rebuilds the shared packages and Electron bundle before launching.
5. Verify the entry in **Settings → Extensions → Features**, its agent tools, and any visible card. Required configuration can delay activation; the descriptor still appears in Settings.

The [Notes package](https://github.com/Vokality/ragdoll/tree/main/packages/ragdoll-extension-notes) is a stateful example with a list and document card. Its package README describes the tools and limits. Creating a directory or building a package alone does not add it to the built-in catalog. Independently distributed extensions use the [release installation path](./distribution.md#install-in-lumen).

## Create your package

Copy the example to a new directory under `examples/`. Change its package name, descriptor ID and display name, runtime ID and name, tool names, and tests to describe your domain. Keep the `workspace:*` framework dependency while developing inside this monorepo, then run `bun install` to register the new workspace.

A minimal tools-only descriptor looks like this inside your package's `package.json`:

```json
{
  "ragdollExtension": {
    "id": "word-count",
    "name": "Word Count",
    "description": "Count whitespace-separated words",
    "entry": "./dist/index.js",
    "capabilities": ["tools"],
    "requiredCapabilities": [],
    "optionalCapabilities": [],
    "canDisable": true
  }
}
```

Keep the example's ESM package fields, exports, build scripts, and TypeScript setup. This descriptor is only one part of the package manifest.

## Implement a tool

Replace `src/index.ts` with a factory such as:

```ts
import {
  createExtension as defineExtension,
  type RagdollExtension,
} from "@vokality/ragdoll-extensions";

export function createExtension(): RagdollExtension {
  return defineExtension({
    id: "word-count",
    name: "Word Count",
    version: "1.0.0",
    requiredCapabilities: [],
    optionalCapabilities: [],
    tools: [{
      definition: {
        type: "function",
        function: {
          name: "countWords",
          description: "Count whitespace-separated words in supplied text.",
          parameters: {
            type: "object",
            properties: { text: { type: "string" } },
            required: ["text"],
          },
        },
      },
      handler: async (args) => {
        if (typeof args.text !== "string") {
          return { success: false, error: "text must be a string" };
        }
        const text = args.text.trim();
        return {
          success: true,
          data: { words: text === "" ? 0 : text.split(/\s+/u).length },
        };
      },
    }],
  });
}
```

The JSON schema describes arguments to the model. The handler still validates input at the boundary before using it. Return actual data or an explicit failure, not a claim that the operation succeeded. This intentionally simple counter splits on whitespace; it is not a language-aware tokenizer.

## Verify behavior

Replace the copied weather tests with cases for empty text, whitespace, normal input, and invalid arguments. Build and typecheck your new workspace using its package name with `bun run --filter`.

For stateful tools, test the resulting domain state as well as the tool result. A card and its agent tool should invoke the same operation so they cannot drift.
