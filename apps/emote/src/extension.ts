import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { RagdollPanel } from "./ragdoll-panel";
import type { FacialMood, BubbleTone } from "./types";

// File-based IPC path
const IPC_DIR = path.join(os.tmpdir(), "ragdoll-vscode");
const COMMAND_FILE = path.join(IPC_DIR, "command.json");

// Stable MCP server location (doesn't change with extension version)
const EMOTE_DIR = path.join(os.homedir(), ".emote");
const STABLE_MCP_SERVER = path.join(EMOTE_DIR, "mcp-server.js");

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

/**
 * Install/update MCP server to stable location
 * This runs on every activation to ensure the server is up to date
 */
function installMcpServer(extensionPath: string): void {
  try {
    // Ensure ~/.emote directory exists
    if (!fs.existsSync(EMOTE_DIR)) {
      fs.mkdirSync(EMOTE_DIR, { recursive: true });
    }

    // Copy mcp-server.js to stable location
    const sourcePath = path.join(extensionPath, "dist", "mcp-server.js");
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, STABLE_MCP_SERVER);
      console.log(`[Emote] MCP server installed to ${STABLE_MCP_SERVER}`);
    }
  } catch (error) {
    console.error("[Emote] Failed to install MCP server:", error);
  }
}

/**
 * Generate MCP configuration JSON for the user's config file
 * Uses the stable path that doesn't change with extension updates
 */
function getMcpConfig(): string {
  const config = {
    emote: {
      command: "node",
      args: [STABLE_MCP_SERVER],
    },
  };
  return JSON.stringify(config, null, 2);
}

/**
 * Copy MCP config to clipboard and show notification
 */
async function copyMcpConfig(): Promise<void> {
  const config = getMcpConfig();
  await vscode.env.clipboard.writeText(config);
  
  const configPath = os.platform() === "darwin" 
    ? "~/.cursor/mcp.json" 
    : os.platform() === "win32"
      ? "%USERPROFILE%\\.cursor\\mcp.json"
      : "~/.cursor/mcp.json";
  
  vscode.window.showInformationMessage(
    `Emote MCP config copied! Add it to mcpServers in ${configPath}`,
    "Open Config Location"
  ).then(selection => {
    if (selection === "Open Config Location") {
      const actualPath = path.join(os.homedir(), ".cursor", "mcp.json");
      vscode.commands.executeCommand("vscode.open", vscode.Uri.file(actualPath));
    }
  });
}

/**
 * Show first-time setup notification
 */
async function showSetupNotification(context: vscode.ExtensionContext): Promise<void> {
  const hasShownSetup = context.globalState.get<boolean>("mcpSetupShown");
  
  if (!hasShownSetup) {
    const selection = await vscode.window.showInformationMessage(
      "Emote: To enable AI control, add the MCP server to your config",
      "Copy Config",
      "Later"
    );
    
    if (selection === "Copy Config") {
      await copyMcpConfig();
    }
    
    // Mark as shown (don't show again)
    await context.globalState.update("mcpSetupShown", true);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("Emote extension activating...");

  // Ensure IPC directory exists
  if (!fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true });
  }

  // Install/update MCP server to stable location
  installMcpServer(context.extensionPath);

  // Show first-time setup notification
  showSetupNotification(context);

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

  // MCP setup command
  context.subscriptions.push(
    vscode.commands.registerCommand("emote.copyMcpConfig", () => {
      copyMcpConfig();
    })
  );

  // Control commands
  context.subscriptions.push(
    vscode.commands.registerCommand("emote.setMood", (mood: string, duration?: number) => {
      const panel = RagdollPanel.currentPanel ?? RagdollPanel.createOrShow(context.extensionUri);
      panel.postMessage({ type: "setMood", mood: mood as FacialMood, duration });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.triggerAction", (action: string, duration?: number) => {
      const panel = RagdollPanel.currentPanel ?? RagdollPanel.createOrShow(context.extensionUri);
      panel.postMessage({ type: "triggerAction", action: action as "wink" | "talk", duration });
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
      panel.postMessage({ type: "setSpeechBubble", text: text ?? null, tone: tone as BubbleTone | undefined });
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

function handleMCPCommand(command: MCPCommand, _context: vscode.ExtensionContext): void {
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
