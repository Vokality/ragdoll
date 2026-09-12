# Lumen model providers

Lumen supports OpenAI (`gpt-5.6-sol`) and Grok (`grok-4.6`), both with low reasoning effort. Choose a provider during setup or through **Settings → AI provider**. Each provider has its own encrypted local API key. Switching keeps the conversation, personal memory, extensions, and MCP connections. The selected provider is captured once per turn; a selection made while a turn is running applies to the next turn.

Existing installations retain their OpenAI key. The storage read boundary migrates the old `apiKeyEncrypted` field to `providerKeysEncrypted.openai`; that first read persists the migration and removes the old field. Setup can reuse or remove a saved provider key. Key validation checks the provider's models endpoint; it does not guarantee access to the configured model or sufficient credit.

## Boundary

`electron/services/model-provider.ts` defines the small provider facade:

- `info`: browser-safe identity, model, and key setup metadata;
- `sessions`: creates a response session for inference and memory summaries;
- `validateKey`: checks credentials against that provider;
- `createWebSearch`: returns text and validated citations through the shared search contract.

`ProviderAgentFactory` binds one provider and credential snapshot to each turn. `PersonalAgent` and `ToolCallingAgentRunner` own memory, tool execution, retries, durable history, cancellation, and event decisions. These services and their contracts do not import provider SDK types. The renderer gets ready-to-display provider status and existing chat DTOs through validated IPC, never saved secrets or protocol output.

OpenAI and Grok share a Responses protocol adapter. It retains full provider output, including encrypted reasoning, privately within a session, and returns only text messages and function calls. Callers submit new input for each round; they do not replay provider output. A new turn creates a new session from the persisted provider-neutral conversation. OpenAI message phases are preserved; Grok requests omit those OpenAI-specific history fields. Hosted search uses each provider's supported tool options and the same credentials as the main turn. Numeric citation labels from xAI become source hostnames before reaching the renderer.

To add a provider, add its stable ID to the domain schema and register a `ModelProvider`. A provider with a different protocol implements the same session and search interfaces. The agent loop, extension packages, conversation persistence, and renderer do not need that provider's SDK. This boundary lives inside Lumen; it does not add dependencies to the character or extension frameworks.

## References and verification

The adapters follow [OpenAI reasoning and replay](https://developers.openai.com/api/docs/guides/reasoning), [xAI Responses and encrypted replay](https://docs.x.ai/developers/model-capabilities/text/generate-text), [xAI web search](https://docs.x.ai/developers/tools/web-search), [xAI citations](https://docs.x.ai/developers/tools/citations), and the [Grok 4.6 model contract](https://docs.x.ai/developers/models/grok-4.6).

Unit regressions exercise both adapters through the real SDK with an injected HTTP transport: endpoint and key routing, tool rounds, encrypted replay, text streaming, and search citations. Separate tests cover provider snapshots, migration, isolated key removal, and failed validation. Electron browser regressions exercise the production preload and auth IPC plus setup provider selection at compact window sizes. These fixtures do not spend API credits or prove live provider availability.
