import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { RagdollPanel } from "./ragdoll-panel";
import type { FacialMood, BubbleTone } from "./types";

const MAX_COMMAND_FILE_BYTES = 2048;
const MIN_POLL_INTERVAL_MS = 100;
const MAX_POLL_INTERVAL_MS = 1500;
const POLL_BACKOFF_STEP_MS = 150;
const MAX_BUBBLE_CHARACTERS = 240;

const VALID_MOODS: readonly FacialMood[] = [
  "neutral",
  "smile",
  "frown",
  "laugh",
  "angry",
  "sad",
  "surprise",
  "confusion",
  "thinking",
] as const;
const VALID_ACTIONS = ["wink", "talk"] as const;
const VALID_TONES: readonly BubbleTone[] = ["default", "whisper", "shout"];
const VALID_THEMES = ["default", "robot", "alien", "monochrome"] as const;
type ThemeId = typeof VALID_THEMES[number];
type ActionId = (typeof VALID_ACTIONS)[number];

let outputChannel: vscode.OutputChannel | null = null;
const shownErrorKeys = new Set<string>();

// File-based IPC path
const IPC_DIR = path.join(os.tmpdir(), "ragdoll-vscode");
const COMMAND_FILE = path.join(IPC_DIR, "command.json");

// Stable MCP server location (doesn't change with extension version)
const EMOTE_DIR = path.join(os.homedir(), ".emote");
const STABLE_MCP_SERVER = path.join(EMOTE_DIR, "mcp-server.js");

function initOutputChannel(context: vscode.ExtensionContext): void {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Emote");
    context.subscriptions.push(outputChannel);
  }
}

function logMessage(level: "info" | "warn" | "error", message: string, metadata?: Record<string, unknown>): void {
  if (!outputChannel) {
    return;
  }
  const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(`[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`);
}

function notifyErrorOnce(key: string, message: string): void {
  if (shownErrorKeys.has(key)) {
    return;
  }
  shownErrorKeys.add(key);
  vscode.window.showErrorMessage(message, "Open Emote Output").then((selection) => {
    if (selection === "Open Emote Output") {
      outputChannel?.show(true);
    }
  });
}

function getThemeSetting(): ThemeId {
  const config = vscode.workspace.getConfiguration("emote");
  const theme = config.get<string>("theme", "default");
  return VALID_THEMES.includes(theme as ThemeId) ? (theme as ThemeId) : "default";
}

function setThemeSetting(themeId: ThemeId): Thenable<void> {
  const config = vscode.workspace.getConfiguration("emote");
  return config.update("theme", themeId, vscode.ConfigurationTarget.Global);
}

type MCPCommand = {
  type?: string;
  mood?: unknown;
  action?: unknown;
  duration?: unknown;
  yawDegrees?: unknown;
  pitchDegrees?: unknown;
  text?: unknown;
  tone?: unknown;
  themeId?: unknown;
};

type ValidatedCommand =
  | { type: "show" }
  | { type: "hide" }
  | { type: "clearAction" }
  | { type: "setMood"; mood: FacialMood; duration?: number }
  | { type: "triggerAction"; action: ActionId; duration?: number }
  | { type: "setHeadPose"; yawDegrees?: number; pitchDegrees?: number; duration?: number }
  | { type: "setSpeechBubble"; text: string | null; tone?: BubbleTone }
  | { type: "setTheme"; themeId: ThemeId };

type ValidationResult =
  | { ok: true; command: ValidatedCommand }
  | { ok: false; reason: string };

function ensureCommandArtifacts(): void {
  if (!fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true });
  }

  if (!fs.existsSync(COMMAND_FILE)) {
    fs.writeFileSync(COMMAND_FILE, "");
    return;
  }

  const stats = fs.statSync(COMMAND_FILE);
  if (stats.size > MAX_COMMAND_FILE_BYTES) {
    fs.writeFileSync(COMMAND_FILE, "");
    logMessage("warn", "Command file exceeded safe size and was reset", {
      size: stats.size,
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function coerceNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function coerceDuration(value: unknown, min = 0, max = 30): number | undefined {
  const numeric = coerceNumber(value);
  if (numeric === undefined) {
    return undefined;
  }
  return clamp(numeric, min, max);
}

function isMood(value: unknown): value is FacialMood {
  return typeof value === "string" && (VALID_MOODS as readonly string[]).includes(value);
}

function isAction(value: unknown): value is ActionId {
  return typeof value === "string" && (VALID_ACTIONS as readonly string[]).includes(value);
}

function isTheme(value: unknown): value is ThemeId {
  return typeof value === "string" && (VALID_THEMES as readonly string[]).includes(value);
}

function isToneValue(value: unknown): value is BubbleTone {
  return typeof value === "string" && (VALID_TONES as readonly string[]).includes(value);
}

function coerceTone(value: unknown): BubbleTone | undefined {
  return isToneValue(value) ? value : undefined;
}

function validateMcpCommand(raw: MCPCommand): ValidationResult {
  if (!raw || typeof raw.type !== "string") {
    return { ok: false, reason: "Command missing type" };
  }

  switch (raw.type) {
    case "show":
    case "hide":
    case "clearAction":
      return { ok: true, command: { type: raw.type } };
    case "setMood": {
      if (typeof raw.mood !== "string") {
        return { ok: false, reason: "Mood command missing mood" };
      }
      if (!isMood(raw.mood)) {
        return { ok: false, reason: `Unknown mood "${raw.mood}"` };
      }
      const duration = coerceDuration(raw.duration, 0, 5);
      return {
        ok: true,
        command: { type: "setMood", mood: raw.mood, duration },
      };
    }
    case "triggerAction": {
      if (typeof raw.action !== "string") {
        return { ok: false, reason: "Action command missing action" };
      }
      if (!isAction(raw.action)) {
        return { ok: false, reason: `Unknown action "${raw.action}"` };
      }
      const duration = coerceDuration(raw.duration, 0.2, 5);
      return {
        ok: true,
        command: { type: "triggerAction", action: raw.action, duration },
      };
    }
    case "setHeadPose": {
      const yaw = coerceNumber(raw.yawDegrees);
      const pitch = coerceNumber(raw.pitchDegrees);
      const duration = coerceDuration(raw.duration, 0.05, 2);
      return {
        ok: true,
        command: {
          type: "setHeadPose",
          yawDegrees: yaw !== undefined ? clamp(yaw, -35, 35) : undefined,
          pitchDegrees: pitch !== undefined ? clamp(pitch, -20, 20) : undefined,
          duration,
        },
      };
    }
    case "setSpeechBubble": {
      const normalizedText =
        typeof raw.text === "string" ? raw.text.trim().slice(0, MAX_BUBBLE_CHARACTERS) : "";
      const textValue = normalizedText.length > 0 ? normalizedText : null;
      const tone = coerceTone(raw.tone);
      return {
        ok: true,
        command: { type: "setSpeechBubble", text: textValue, tone },
      };
    }
    case "setTheme": {
      if (typeof raw.themeId !== "string") {
        return { ok: false, reason: "Theme command missing themeId" };
      }
      if (!isTheme(raw.themeId)) {
        return { ok: false, reason: `Unknown theme "${raw.themeId}"` };
      }
      return { ok: true, command: { type: "setTheme", themeId: raw.themeId } };
    }
    default:
      return { ok: false, reason: `Unknown command type "${raw.type}"` };
  }
}

/**
 * Install/update MCP server to stable location
 * This runs on every activation to ensure the server is up to date
 */
function installMcpServer(extensionPath: string): void {
  try {
    const sourcePath = path.join(extensionPath, "dist", "mcp-server.js");
    if (!fs.existsSync(sourcePath)) {
      logMessage("warn", "MCP server build missing", { sourcePath });
      notifyErrorOnce(
        "mcp-server-missing",
        "Emote build is missing dist/mcp-server.js. Run `bun run build` and reload the window."
      );
      return;
    }

    if (!fs.existsSync(EMOTE_DIR)) {
      fs.mkdirSync(EMOTE_DIR, { recursive: true });
    }

    const tempTarget = path.join(EMOTE_DIR, `mcp-server.${Date.now()}.tmp`);
    fs.copyFileSync(sourcePath, tempTarget);
    fs.renameSync(tempTarget, STABLE_MCP_SERVER);
    try {
      fs.chmodSync(STABLE_MCP_SERVER, 0o744);
    } catch {
      // Windows may not support chmod; ignore.
    }

    logMessage("info", "MCP server installed", { target: STABLE_MCP_SERVER });
  } catch (error) {
    logMessage("error", "Failed to install MCP server", { error: String(error) });
    notifyErrorOnce(
      "install-mcp-server",
      "Emote could not install the MCP helper. Check the Emote output channel for details."
    );
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
  try {
    const config = getMcpConfig();
    await vscode.env.clipboard.writeText(config);

    const configPath =
      os.platform() === "darwin"
        ? "~/.cursor/mcp.json"
        : os.platform() === "win32"
          ? "%USERPROFILE%\\.cursor\\mcp.json"
          : "~/.cursor/mcp.json";

    vscode.window
      .showInformationMessage(
        `Emote MCP config copied! Add it to mcpServers in ${configPath}`,
        "Open Config Location"
      )
      .then((selection) => {
        if (selection === "Open Config Location") {
          const actualPath = path.join(os.homedir(), ".cursor", "mcp.json");
          const uri = vscode.Uri.file(actualPath);
          vscode.commands.executeCommand("vscode.open", uri);
        }
      });
  } catch (error) {
    logMessage("error", "Failed to copy MCP config", { error: String(error) });
    notifyErrorOnce(
      "copy-mcp-config",
      "Emote could not copy the MCP config to your clipboard. Try again after closing other clipboard apps."
    );
  }
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
  initOutputChannel(context);
  logMessage("info", "Emote extension activating...");

  ensureCommandArtifacts();
  installMcpServer(context.extensionPath);
  void showSetupNotification(context);

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
      if (RagdollPanel.currentPanel) {
        RagdollPanel.hide();
        return;
      }
      const panel = RagdollPanel.createOrShow(context.extensionUri);
      const theme = getThemeSetting();
      panel.postMessage({ type: "setTheme", themeId: theme });
    })
  );

  // MCP setup command
  context.subscriptions.push(
    vscode.commands.registerCommand("emote.copyMcpConfig", () => {
      void copyMcpConfig();
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
    vscode.commands.registerCommand("emote.setTheme", async (themeId?: string) => {
      // If themeId is provided, use it directly (e.g., from MCP command)
      if (themeId && VALID_THEMES.includes(themeId as ThemeId)) {
        void setThemeSetting(themeId as ThemeId);
        if (RagdollPanel.currentPanel) {
          RagdollPanel.currentPanel.postMessage({ type: "setTheme", themeId });
        }
        return;
      }

      // Otherwise, show quick pick dialog for user selection
      const themeOptions: Array<{ label: string; description: string; id: ThemeId }> = [
        { label: "Default", description: "Warm, human-like appearance", id: "default" },
        { label: "Robot", description: "Metallic, futuristic robot", id: "robot" },
        { label: "Alien", description: "Green, otherworldly alien", id: "alien" },
        { label: "Monochrome", description: "Classic black and white", id: "monochrome" },
      ];

      const currentTheme = getThemeSetting();
      const selected = await vscode.window.showQuickPick(themeOptions, {
        placeHolder: `Select theme (current: ${currentTheme})`,
      });

      if (selected) {
        void setThemeSetting(selected.id);
        if (RagdollPanel.currentPanel) {
          RagdollPanel.currentPanel.postMessage({ type: "setTheme", themeId: selected.id });
        }
      }
    })
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("emote.theme")) {
        const theme = getThemeSetting();
        logMessage("info", "Theme setting changed", { theme });
        if (RagdollPanel.currentPanel) {
          RagdollPanel.currentPanel.postMessage({ type: "setTheme", themeId: theme });
        }
      }
    })
  );

  // Start file watcher for MCP commands
  startFileWatcher(context);

  logMessage("info", "Emote extension activated");
  logMessage("info", "Listening for MCP commands", { commandFile: COMMAND_FILE });
}

function startFileWatcher(context: vscode.ExtensionContext): void {
  ensureCommandArtifacts();

  let pollDelay = MIN_POLL_INTERVAL_MS;
  let disposed = false;
  let pendingTimer: NodeJS.Timeout | undefined;
  let lastSyntaxError: string | null = null;

  const scheduleNextPoll = () => {
    if (disposed) {
      return;
    }
    pendingTimer = setTimeout(poll, pollDelay);
  };

  const poll = () => {
    if (disposed) {
      return;
    }

    try {
      const content = fs.readFileSync(COMMAND_FILE, "utf-8").trim();
      if (!content) {
        pollDelay = Math.min(MAX_POLL_INTERVAL_MS, pollDelay + POLL_BACKOFF_STEP_MS);
        return;
      }

      pollDelay = MIN_POLL_INTERVAL_MS;
      const command = JSON.parse(content) as MCPCommand;
      const result = validateMcpCommand(command);

      if (result.ok) {
        handleValidatedCommand(result.command);
        logMessage("info", "Processed MCP command", { type: result.command.type });
      } else {
        vscode.window.showErrorMessage(`Emote MCP command ignored: ${result.reason}`);
        logMessage("warn", "Rejected MCP command", { reason: result.reason });
      }

      fs.writeFileSync(COMMAND_FILE, "");
      lastSyntaxError = null;
    } catch (error) {
      if (error instanceof SyntaxError) {
        if (error.message !== lastSyntaxError) {
          logMessage("warn", "Command JSON parse failed", { message: error.message });
          lastSyntaxError = error.message;
        }
      } else {
        logMessage("error", "Failed to read MCP command file", { error: String(error) });
        notifyErrorOnce(
          "command-file-read",
          "Emote could not read MCP commands. See the Emote output channel for details."
        );
      }
      pollDelay = Math.min(MAX_POLL_INTERVAL_MS, pollDelay + POLL_BACKOFF_STEP_MS);
    } finally {
      scheduleNextPoll();
    }
  };

  poll();

  context.subscriptions.push({
    dispose: () => {
      disposed = true;
      if (pendingTimer) {
        clearTimeout(pendingTimer);
      }
    },
  });
}

function handleValidatedCommand(command: ValidatedCommand): void {
  switch (command.type) {
    case "show":
      void vscode.commands.executeCommand("emote.show");
      break;
    case "hide":
      void vscode.commands.executeCommand("emote.hide");
      break;
    case "clearAction":
      void vscode.commands.executeCommand("emote.clearAction");
      break;
    case "setMood":
      void vscode.commands.executeCommand("emote.setMood", command.mood, command.duration);
      break;
    case "triggerAction":
      void vscode.commands.executeCommand("emote.triggerAction", command.action, command.duration);
      break;
    case "setHeadPose":
      void vscode.commands.executeCommand(
        "emote.setHeadPose",
        command.yawDegrees,
        command.pitchDegrees,
        command.duration
      );
      break;
    case "setSpeechBubble":
      void vscode.commands.executeCommand("emote.setSpeechBubble", command.text, command.tone);
      break;
    case "setTheme":
      void vscode.commands.executeCommand("emote.setTheme", command.themeId);
      break;
  }
}

export function deactivate(): void {
  logMessage("info", "Emote extension deactivating...");
  RagdollPanel.hide();
}
