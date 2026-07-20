import * as vscode from "vscode";
import { EmoteCommandService } from "./emote-command-service";
import { EmoteLogger } from "./emote-logger";
import { EmoteSettings } from "./emote-settings";
import { McpSetupService } from "./mcp-setup-service";
import { RagdollPanel } from "./ragdoll-panel";
import { SocketCommandServer } from "./socket-command-server";

export function activate(context: vscode.ExtensionContext): void {
  const logger = new EmoteLogger(context);
  const settings = new EmoteSettings();
  const commands = new EmoteCommandService(context.extensionUri, settings);
  const mcpSetup = new McpSetupService(logger);
  const socketServer = new SocketCommandServer(commands, logger);

  const register = (
    id: string,
    callback: (...args: unknown[]) => unknown,
  ): void => {
    context.subscriptions.push(vscode.commands.registerCommand(id, callback));
  };

  logger.info("Emote extension activating");
  mcpSetup.install(context.extensionPath);
  void mcpSetup.showFirstRunPrompt(context);

  register("emote.show", () => commands.executeRaw({ type: "show" }));
  register("emote.hide", () => commands.executeRaw({ type: "hide" }));
  register("emote.toggle", () => commands.toggle());
  register("emote.copyMcpConfig", () => mcpSetup.copyConfiguration());
  register("emote.setMood", (mood, duration) =>
    commands.executeRaw({ type: "setMood", mood, duration }),
  );
  register("emote.triggerAction", (action, duration) =>
    commands.executeRaw({ type: "triggerAction", action, duration }),
  );
  register("emote.clearAction", () =>
    commands.executeRaw({ type: "clearAction" }),
  );
  register("emote.setHeadPose", (yawDegrees, pitchDegrees, duration) =>
    commands.executeRaw({
      type: "setHeadPose",
      yawDegrees,
      pitchDegrees,
      duration,
    }),
  );
  register("emote.setSpeechBubble", (text, tone) =>
    commands.executeRaw({ type: "setSpeechBubble", text, tone }),
  );
  register("emote.setTheme", (themeId) =>
    themeId === undefined
      ? commands.selectTheme()
      : commands.executeRaw({ type: "setTheme", themeId }),
  );
  register("emote.setVariant", (variantId) =>
    variantId === undefined
      ? commands.selectVariant()
      : commands.executeRaw({ type: "setVariant", variantId }),
  );

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration("emote.theme")) commands.syncTheme();
      if (event.affectsConfiguration("emote.variant")) commands.syncVariant();
    }),
  );

  socketServer.start();
  context.subscriptions.push(socketServer);
  logger.info("Emote extension activated");
}

export function deactivate(): void {
  RagdollPanel.hide();
}
