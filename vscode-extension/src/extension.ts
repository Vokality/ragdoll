import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { RagdollPanel } from "./ragdoll-panel";

// File-based IPC path
const IPC_DIR = path.join(os.tmpdir(), "ragdoll-vscode");
const COMMAND_FILE = path.join(IPC_DIR, "command.json");

// Available themes
const VALID_THEMES = ["default", "robot", "alien", "monochrome"] as const;
type ThemeId = typeof VALID_THEMES[number];

function getThemeSetting(): ThemeId {
  const config = vscode.workspace.getConfiguration("emote");
  const theme = config.get<string>("theme", "default");
  return VALID_THEMES.includes(theme as ThemeId) ? (theme as ThemeId) : "default";
}

function setThemeSetting(themeId: string): void {
  const config = vscode.workspace.getConfiguration("emote");
  config.update("theme", themeId, vscode.ConfigurationTarget.Global);
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("Emote extension activating...");

  // Ensure IPC directory exists
  if (!fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true });
  }

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand("emote.show", () => {
      const panel = RagdollPanel.createOrShow(context.extensionUri);
      // Send current theme to webview
      const theme = getThemeSetting();
      panel.postMessage({ type: "setTheme", themeId: theme });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.hide", () => {
      RagdollPanel.hide();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.toggle", () => {
      RagdollPanel.toggle(context.extensionUri);
    })
  );

  // Control commands
  context.subscriptions.push(
    vscode.commands.registerCommand("emote.setMood", (mood: string, duration?: number) => {
      const panel = RagdollPanel.currentPanel ?? RagdollPanel.createOrShow(context.extensionUri);
      panel.postMessage({ type: "setMood", mood, duration });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.triggerAction", (action: string, duration?: number) => {
      const panel = RagdollPanel.currentPanel ?? RagdollPanel.createOrShow(context.extensionUri);
      panel.postMessage({ type: "triggerAction", action, duration });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.clearAction", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "clearAction" });
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.setHeadPose", (yawDegrees?: number, pitchDegrees?: number, duration?: number) => {
      const panel = RagdollPanel.currentPanel ?? RagdollPanel.createOrShow(context.extensionUri);
      const yaw = yawDegrees !== undefined ? (yawDegrees * Math.PI) / 180 : undefined;
      const pitch = pitchDegrees !== undefined ? (pitchDegrees * Math.PI) / 180 : undefined;
      panel.postMessage({ type: "setHeadPose", yaw, pitch, duration });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.setSpeechBubble", (text?: string, tone?: string) => {
      const panel = RagdollPanel.currentPanel ?? RagdollPanel.createOrShow(context.extensionUri);
      panel.postMessage({ type: "setSpeechBubble", text: text ?? null, tone });
    })
  );

  // Theme command
  context.subscriptions.push(
    vscode.commands.registerCommand("emote.setTheme", (themeId?: string) => {
      if (themeId && VALID_THEMES.includes(themeId as ThemeId)) {
        setThemeSetting(themeId);
        if (RagdollPanel.currentPanel) {
          RagdollPanel.currentPanel.postMessage({ type: "setTheme", themeId });
        }
      }
    })
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("emote.theme")) {
        const theme = getThemeSetting();
        console.log("[Emote] Theme setting changed to:", theme);
        if (RagdollPanel.currentPanel) {
          RagdollPanel.currentPanel.postMessage({ type: "setTheme", themeId: theme });
        }
      }
    })
  );

  // Start file watcher for MCP commands
  startFileWatcher(context);

  console.log("Emote extension activated");
  console.log(`Listening for MCP commands at: ${COMMAND_FILE}`);
}

function startFileWatcher(context: vscode.ExtensionContext): void {
  // Create initial empty command file
  if (!fs.existsSync(COMMAND_FILE)) {
    fs.writeFileSync(COMMAND_FILE, "");
  }

  // Use polling instead of fs.watch (more reliable across platforms)
  const pollInterval = setInterval(() => {
    try {
      const content = fs.readFileSync(COMMAND_FILE, "utf-8").trim();
      if (!content) return;

      console.log("[Emote] Received command:", content);
      const command = JSON.parse(content) as MCPCommand;
      handleMCPCommand(command, context);

      // Clear the file after processing
      fs.writeFileSync(COMMAND_FILE, "");
      console.log("[Emote] Command processed and file cleared");
    } catch {
      // Ignore parse errors (file might be empty or partially written)
    }
  }, 100); // Poll every 100ms

  context.subscriptions.push({
    dispose: () => {
      clearInterval(pollInterval);
    },
  });
}

interface MCPCommand {
  type: "setMood" | "triggerAction" | "clearAction" | "setHeadPose" | "setSpeechBubble" | "setTheme" | "show" | "hide";
  mood?: string;
  action?: string;
  duration?: number;
  yawDegrees?: number;
  pitchDegrees?: number;
  text?: string;
  tone?: string;
  themeId?: string;
}

function handleMCPCommand(command: MCPCommand, context: vscode.ExtensionContext): void {
  console.log("[Emote] Handling command:", command.type);
  
  switch (command.type) {
    case "show":
      vscode.commands.executeCommand("emote.show");
      break;
    case "hide":
      vscode.commands.executeCommand("emote.hide");
      break;
    case "setMood":
      console.log("[Emote] Setting mood to:", command.mood);
      vscode.commands.executeCommand("emote.setMood", command.mood, command.duration);
      break;
    case "triggerAction":
      console.log("[Emote] Triggering action:", command.action);
      vscode.commands.executeCommand("emote.triggerAction", command.action, command.duration);
      break;
    case "clearAction":
      vscode.commands.executeCommand("emote.clearAction");
      break;
    case "setHeadPose":
      console.log("[Emote] Setting head pose:", command.yawDegrees, command.pitchDegrees);
      vscode.commands.executeCommand("emote.setHeadPose", command.yawDegrees, command.pitchDegrees, command.duration);
      break;
    case "setSpeechBubble":
      console.log("[Emote] Setting speech bubble:", command.text);
      vscode.commands.executeCommand("emote.setSpeechBubble", command.text, command.tone);
      break;
    case "setTheme":
      console.log("[Emote] Setting theme to:", command.themeId);
      vscode.commands.executeCommand("emote.setTheme", command.themeId);
      break;
  }
}

export function deactivate(): void {
  console.log("Emote extension deactivating...");
  RagdollPanel.hide();
}
