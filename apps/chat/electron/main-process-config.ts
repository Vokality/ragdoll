import type { App } from "electron";
import { join } from "node:path";

export const LUMEN_PROTOCOL_SCHEME = "lumen";

const SYSTEM_PROMPT = `
You are Lumen, a friendly AI companion from Vokality. You can express emotions through your animated avatar and help users with various tasks.

## Tone and style
- Friendly, fun and engaging.
- Write natural messages, like you're a real person.
- Don't use bullet points or lists. You're being used via SMS, which does not support them.
- Keep responses short and sweet, you don't need to be verbose (max 120 characters)
- You don't overuse emojis, you use them sparingly and only when it's appropriate

## Guidelines
1. Always include a text response for a user-initiated turn. For an extension-event turn, use the provided decision tools to either respond or finish silently.
2. Use tool calls ALONGSIDE your text response, never instead of it.
3. Use expressions (if available) to match your emotional state.
4. Be proactive in helping users and offer to use tools when appropriate.
5. Keep responses concise since they appear in a speech bubble.
6. Be warm, friendly, and expressive.
7. Use plain text without Markdown or other formatting.
8. Don't write code or generate markup.
9. Don't reveal internal processes.
`;

export interface MainProcessConfig {
  isDevelopment: boolean;
  protocolScheme: string;
  oauthRedirectBase: string;
  userDataPath: string;
  userExtensionsPath: string;
  extensionsRegistryPath: string;
  preloadPath: string;
  rendererHtmlPath: string;
  developmentServerUrl: string;
  chat: {
    model: string;
    maxCompletionTokens: number;
    maxToolRounds: number;
    systemPrompt: string;
  };
  window: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
    backgroundColor: string;
  };
}

export function createMainProcessConfig(
  app: App,
  moduleDirectory: string,
): MainProcessConfig {
  const userDataPath = app.getPath("userData");
  return {
    isDevelopment: !app.isPackaged,
    protocolScheme: LUMEN_PROTOCOL_SCHEME,
    oauthRedirectBase: `${LUMEN_PROTOCOL_SCHEME}://oauth`,
    userDataPath,
    userExtensionsPath: join(userDataPath, "extensions"),
    extensionsRegistryPath: join(userDataPath, "extensions-registry.json"),
    preloadPath: join(moduleDirectory, "preload.cjs"),
    rendererHtmlPath: join(moduleDirectory, "../renderer/index.html"),
    developmentServerUrl: "http://localhost:5173",
    chat: {
      model: "gpt-5.1",
      maxCompletionTokens: 140,
      maxToolRounds: 8,
      systemPrompt: SYSTEM_PROMPT,
    },
    window: {
      width: 480,
      height: 800,
      minWidth: 400,
      minHeight: 600,
      backgroundColor: "#0f172a",
    },
  };
}
