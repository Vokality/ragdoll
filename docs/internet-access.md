# Agent internet access

Lumen exposes `lumen_search_web({ query })` alongside its app and extension tools. It uses the existing OpenAI API key and model through a separate Responses API request with `web_search`, `external_web_access: true`, and required tool use. The main conversation continues using its existing Chat Completions tool loop.

The tool can search current information and inspect public pages by URL. It is hosted web access, not an unrestricted browser or filesystem/network shell. No additional search-provider key is required.

The search adapter requires a completed search and an answer containing URL citation annotations. It returns the answer and validated source titles/URLs to the main agent. Search failures are reported as tool failures; cancelled user turns abort the search request.

The agent runner returns structured `{ content, sources }` responses. Sources come from validated search annotations, are deduplicated by URL, and persist with the assistant message through IPC and reloads. The renderer shows compact, keyboard-accessible source pills below the message, including for previously saved Markdown citations. The model is instructed to omit inline citations; no extra model request or response tool is needed. Existing Electron navigation policy opens sources in the user's browser.

Search calls, answers, and source metadata use the same durable tool history as other actions. Search requests set `store: false`; Lumen stores execution history locally.

Based on OpenAI's [web-search guide](https://developers.openai.com/api/docs/guides/tools-web-search) and [GPT-5.4 Mini model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini). The Responses web-search path supports live-access control; Chat Completions web search requires specialized search models. Web-grounded results must display visible, clickable citations.

Source pills use Google’s favicon lookup, sending only the source hostname and no referrer. Missing icons fall back to a globe; icon requests do not delay the answer. The renderer image policy permits that service and its gstatic image redirects.
