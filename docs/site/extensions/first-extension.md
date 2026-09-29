# Your first extension

Start from [`examples/extension-weather`](https://github.com/Vokality/ragdoll/tree/main/examples/extension-weather). It has a manifest, TypeScript configuration, a factory, and tests. The weather data is a fixed demo dataset, not a live weather feed.

## Build the example

After [setting up the repository](../getting-started.md), run from its root:

```bash
bun run build:libraries
bun run --filter @example/ragdoll-extension-weather build
bun run --filter @example/ragdoll-extension-weather test
bun run --filter @example/ragdoll-extension-weather typecheck
```

Building the example doesn't install it in Lumen. [Testing and distribution](./distribution.md) covers installation.

## Test a first-party package in Lumen

To load a package from `packages/ragdoll-extension-*` as a Lumen built-in:

1. Add it to `apps/chat/package.json` as a `workspace:*` dependency.
2. In `apps/chat/electron/built-in-extensions.ts`, import its factory and its `package.json` descriptor, and add an entry to `BUILT_IN_EXTENSIONS` with `defineBuiltInExtension`.
3. Run `bun install` to link the workspace dependency. Add host integration tests and add the package to `scripts/verify-packages.ts`.
4. Stop any running `bun run dev:chat` and start it again. Startup rebuilds the shared packages and the Electron bundle.
5. Check that the extension appears under Settings → Extensions → Features, that the agent can call its tools, and that its card opens. An extension with required configuration stays inactive until it's configured, but it still shows up in Settings.

The [Notes package](https://github.com/Vokality/ragdoll/tree/main/packages/ragdoll-extension-notes) is a good stateful example: a list card, a document card, and a README that lists its tools and limits. A package only becomes a built-in through the steps above. Extensions you distribute separately go through the [release install path](./distribution.md#install-in-lumen).

## Create your package

Copy the example to a new directory under `examples/`. Rename the package, the descriptor ID and display name, the runtime ID and name, and the tools, and rewrite the tests for your domain. Keep the `workspace:*` framework dependency while you develop inside the monorepo, and run `bun install` so Bun picks up the new workspace.

A tools-only descriptor in `package.json` looks like this:

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

The descriptor is one field among many. Keep the example's ESM package fields, `exports`, build scripts, and TypeScript setup.

## Implement a tool

Replace `src/index.ts` with a factory like this one:

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
    tools: [
      {
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
      },
    ],
  });
}
```

The JSON schema tells the model what arguments to send, but the model can still send something else, so the handler checks `text` before using it. Return the real result, or `success: false` with an error. The example splits on whitespace, which is fine for a demo and wrong for languages that don't use spaces between words.

## Test it

Replace the copied weather tests with cases for empty text, whitespace-only text, normal input, and a missing or non-string `text`. Build and typecheck the new workspace with `bun run --filter <your-package-name>`.

For tools that change state, assert on the resulting state as well as the tool's return value. If a card button and a tool do the same thing, have both call one function so they can't drift apart.
