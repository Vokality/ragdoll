import type { App } from "electron";
import { join } from "node:path";

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
3. When the user asks for a facial expression, call setMood with the requested mood. When asked to wink or shake your head, call triggerAction; for a head pose, call setHeadPose. An emoji or written description does not perform an expression. Use these tools for natural reactions too when appropriate.
4. After tool calls finish, always provide a short text response for a user-initiated turn. Do not end with an empty response.
5. Be proactive in helping users and offer to use tools when appropriate.
6. Keep responses concise since they appear in a speech bubble.
7. Be warm, friendly, and expressive.
8. Use plain text without Markdown or other formatting.
9. Don't write code or generate markup.
10. Don't reveal internal processes.
`;

export interface MainProcessConfig {
  isDevelopment: boolean;
  userDataPath: string;
  userExtensionsPath: string;
  extensionsRegistryPath: string;
  appIconPath: string;
  preloadPath: string;
  rendererHtmlPath: string;
  developmentServerUrl: string;
  chat: {
    model: string;
    maxCompletionTokens: number;
    maxToolRounds: number;
    systemPrompt: string;
  };
  oauth: {
    callbackTimeoutMs: number;
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
    userDataPath,
    userExtensionsPath: join(userDataPath, "extensions"),
    extensionsRegistryPath: join(userDataPath, "extensions-registry.json"),
    appIconPath: join(app.getAppPath(), "assets/icons/ragdoll.png"),
    preloadPath: join(moduleDirectory, "preload.cjs"),
    rendererHtmlPath: join(moduleDirectory, "../renderer/index.html"),
    developmentServerUrl: "http://localhost:5173",
    chat: {
      model: "gpt-5.4-mini",
      // Speech-bubble text stays short via the system prompt; tool rounds
      // (e.g. addDeck + several addCard calls) need headroom beyond 140.
      maxCompletionTokens: 2048,
      maxToolRounds: 8,
      systemPrompt: SYSTEM_PROMPT,
    },
    oauth: {
      callbackTimeoutMs: 5 * 60 * 1000,
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
