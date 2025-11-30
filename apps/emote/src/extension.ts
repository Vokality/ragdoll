import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import * as net from "net";
import { RagdollPanel } from "./ragdoll-panel";
import type {
  FacialMood,
  BubbleTone,
  PomodoroDuration,
  TaskStatus,
  Task,
} from "./types";

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
const VALID_ACTIONS = ["wink", "talk", "shake"] as const;
const VALID_TONES: readonly BubbleTone[] = ["default", "whisper", "shout"];
const VALID_THEMES = ["default", "robot", "alien", "monochrome"] as const;
type ThemeId = (typeof VALID_THEMES)[number];
type ActionId = (typeof VALID_ACTIONS)[number];

let outputChannel: vscode.OutputChannel | null = null;
const shownErrorKeys = new Set<string>();
let currentTasks: Task[] = [];
let currentPomodoroState: {
  state: string;
  remainingTime: number;
  isBreak: boolean;
} | null = null;

export function updateTasks(tasks: Task[]): void {
  currentTasks = tasks;
}

export function getTasks(): Task[] {
  return currentTasks;
}

export function updatePomodoroState(state: {
  state: string;
  remainingTime: number;
  isBreak: boolean;
}): void {
  currentPomodoroState = state;
}

export function getPomodoroState(): {
  state: string;
  remainingTime: number;
  isBreak: boolean;
} | null {
  return currentPomodoroState;
}

// Socket-based IPC paths
const IPC_DIR = path.join(os.tmpdir(), "ragdoll-vscode");
const SOCKET_PATH =
  os.platform() === "win32"
    ? "\\\\.\\pipe\\ragdoll-emote"
    : path.join(IPC_DIR, "emote.sock");

// Stable MCP server location (doesn't change with extension version)
const EMOTE_DIR = path.join(os.homedir(), ".emote");
const STABLE_MCP_SERVER = path.join(EMOTE_DIR, "mcp-server.js");

function initOutputChannel(context: vscode.ExtensionContext): void {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel("Emote");
    context.subscriptions.push(outputChannel);
  }
}

function logMessage(
  level: "info" | "warn" | "error",
  message: string,
  metadata?: Record<string, unknown>,
): void {
  if (!outputChannel) {
    return;
  }
  const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
  const timestamp = new Date().toISOString();
  outputChannel.appendLine(
    `[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`,
  );
}

function notifyErrorOnce(key: string, message: string): void {
  if (shownErrorKeys.has(key)) {
    return;
  }
  shownErrorKeys.add(key);
  vscode.window
    .showErrorMessage(message, "Open Emote Output")
    .then((selection) => {
      if (selection === "Open Emote Output") {
        outputChannel?.show(true);
      }
    });
}

function getThemeSetting(): ThemeId {
  const config = vscode.workspace.getConfiguration("emote");
  const theme = config.get<string>("theme", "default");
  return VALID_THEMES.includes(theme as ThemeId)
    ? (theme as ThemeId)
    : "default";
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
  sessionDuration?: unknown;
  breakDuration?: unknown;
  taskId?: unknown;
  status?: unknown;
  blockedReason?: unknown;
};

const VALID_TASK_STATUSES: readonly TaskStatus[] = [
  "todo",
  "in_progress",
  "blocked",
  "done",
];

type ValidatedCommand =
  | { type: "show" }
  | { type: "hide" }
  | { type: "clearAction" }
  | { type: "setMood"; mood: FacialMood; duration?: number }
  | { type: "triggerAction"; action: ActionId; duration?: number }
  | {
      type: "setHeadPose";
      yawDegrees?: number;
      pitchDegrees?: number;
      duration?: number;
    }
  | { type: "setSpeechBubble"; text: string | null; tone?: BubbleTone }
  | { type: "setTheme"; themeId: ThemeId }
  | {
      type: "startPomodoro";
      sessionDuration?: PomodoroDuration;
      breakDuration?: PomodoroDuration;
    }
  | { type: "pausePomodoro" }
  | { type: "resetPomodoro" }
  | { type: "getPomodoroState" }
  | { type: "addTask"; text: string; status?: TaskStatus }
  | {
      type: "updateTaskStatus";
      taskId: string;
      status: TaskStatus;
      blockedReason?: string;
    }
  | { type: "setActiveTask"; taskId: string }
  | { type: "removeTask"; taskId: string }
  | { type: "completeActiveTask" }
  | { type: "clearCompletedTasks" }
  | { type: "clearAllTasks" }
  | { type: "expandTasks" }
  | { type: "collapseTasks" }
  | { type: "toggleTasks" }
  | { type: "listTasks" }
  | { type: "listTasks" };

type ValidationResult =
  | { ok: true; command: ValidatedCommand }
  | { ok: false; reason: string };

function ensureIpcDirectory(): void {
  if (os.platform() !== "win32" && !fs.existsSync(IPC_DIR)) {
    fs.mkdirSync(IPC_DIR, { recursive: true });
  }
}

function cleanupStaleSocket(): void {
  // Windows named pipes don't leave stale files
  if (os.platform() === "win32") {
    return;
  }
  try {
    if (fs.existsSync(SOCKET_PATH)) {
      fs.unlinkSync(SOCKET_PATH);
      logMessage("info", "Removed stale socket file");
    }
  } catch {
    // Ignore - will fail on listen if still in use
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function coerceNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function coerceDuration(value: unknown, min = 0, max = 30): number | undefined {
  const numeric = coerceNumber(value);
  if (numeric === undefined) {
    return undefined;
  }
  return clamp(numeric, min, max);
}

function isMood(value: unknown): value is FacialMood {
  return (
    typeof value === "string" &&
    (VALID_MOODS as readonly string[]).includes(value)
  );
}

function isAction(value: unknown): value is ActionId {
  return (
    typeof value === "string" &&
    (VALID_ACTIONS as readonly string[]).includes(value)
  );
}

function isTheme(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    (VALID_THEMES as readonly string[]).includes(value)
  );
}

function isToneValue(value: unknown): value is BubbleTone {
  return (
    typeof value === "string" &&
    (VALID_TONES as readonly string[]).includes(value)
  );
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
        typeof raw.text === "string"
          ? raw.text.trim().slice(0, MAX_BUBBLE_CHARACTERS)
          : "";
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
    case "startPomodoro": {
      const sessionDuration = coerceNumber(raw.sessionDuration);
      const breakDuration = coerceNumber(raw.breakDuration);
      const validDurations: PomodoroDuration[] = [5, 15, 30, 60, 120];
      const validSession =
        sessionDuration === undefined ||
        validDurations.includes(sessionDuration as PomodoroDuration);
      const validBreak =
        breakDuration === undefined ||
        validDurations.includes(breakDuration as PomodoroDuration);
      if (!validSession || !validBreak) {
        return {
          ok: false,
          reason:
            "Invalid pomodoro duration. Must be 5, 15, 30, 60, or 120 minutes",
        };
      }
      return {
        ok: true,
        command: {
          type: "startPomodoro",
          sessionDuration: sessionDuration as PomodoroDuration | undefined,
          breakDuration: breakDuration as PomodoroDuration | undefined,
        },
      };
    }
    case "pausePomodoro":
      return { ok: true, command: { type: "pausePomodoro" } };
    case "resetPomodoro":
      return { ok: true, command: { type: "resetPomodoro" } };
    case "getPomodoroState":
      return { ok: true, command: { type: "getPomodoroState" } };
    case "addTask": {
      if (typeof raw.text !== "string" || raw.text.trim().length === 0) {
        return { ok: false, reason: "Task requires text" };
      }
      const status =
        typeof raw.status === "string" &&
        VALID_TASK_STATUSES.includes(raw.status as TaskStatus)
          ? (raw.status as TaskStatus)
          : undefined;
      return {
        ok: true,
        command: { type: "addTask", text: raw.text.trim(), status },
      };
    }
    case "updateTaskStatus": {
      if (typeof raw.taskId !== "string") {
        return { ok: false, reason: "updateTaskStatus requires taskId" };
      }
      if (
        typeof raw.status !== "string" ||
        !VALID_TASK_STATUSES.includes(raw.status as TaskStatus)
      ) {
        return {
          ok: false,
          reason:
            "updateTaskStatus requires valid status (todo, in_progress, blocked, done)",
        };
      }
      const blockedReason =
        typeof raw.blockedReason === "string" ? raw.blockedReason : undefined;
      return {
        ok: true,
        command: {
          type: "updateTaskStatus",
          taskId: raw.taskId,
          status: raw.status as TaskStatus,
          blockedReason,
        },
      };
    }
    case "setActiveTask": {
      if (typeof raw.taskId !== "string") {
        return { ok: false, reason: "setActiveTask requires taskId" };
      }
      return {
        ok: true,
        command: { type: "setActiveTask", taskId: raw.taskId },
      };
    }
    case "removeTask": {
      if (typeof raw.taskId !== "string") {
        return { ok: false, reason: "removeTask requires taskId" };
      }
      return { ok: true, command: { type: "removeTask", taskId: raw.taskId } };
    }
    case "completeActiveTask":
      return { ok: true, command: { type: "completeActiveTask" } };
    case "clearCompletedTasks":
      return { ok: true, command: { type: "clearCompletedTasks" } };
    case "clearAllTasks":
      return { ok: true, command: { type: "clearAllTasks" } };
    case "expandTasks":
      return { ok: true, command: { type: "expandTasks" } };
    case "collapseTasks":
      return { ok: true, command: { type: "collapseTasks" } };
    case "toggleTasks":
      return { ok: true, command: { type: "toggleTasks" } };
    case "listTasks":
      return { ok: true, command: { type: "listTasks" } };
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
        "Emote build is missing dist/mcp-server.js. Run `bun run build` and reload the window.",
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
    logMessage("error", "Failed to install MCP server", {
      error: String(error),
    });
    notifyErrorOnce(
      "install-mcp-server",
      "Emote could not install the MCP helper. Check the Emote output channel for details.",
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
        "Open Config Location",
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
      "Emote could not copy the MCP config to your clipboard. Try again after closing other clipboard apps.",
    );
  }
}

/**
 * Show first-time setup notification
 */
async function showSetupNotification(
  context: vscode.ExtensionContext,
): Promise<void> {
  const hasShownSetup = context.globalState.get<boolean>("mcpSetupShown");

  if (!hasShownSetup) {
    const selection = await vscode.window.showInformationMessage(
      "Emote: To enable AI control, add the MCP server to your config",
      "Copy Config",
      "Later",
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

  installMcpServer(context.extensionPath);
  void showSetupNotification(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.show", () => {
      const panel = RagdollPanel.createOrShow(context.extensionUri);
      // Send current theme to webview
      const theme = getThemeSetting();
      panel.postMessage({ type: "setTheme", themeId: theme });
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.hide", () => {
      RagdollPanel.hide();
    }),
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
    }),
  );

  // MCP setup command
  context.subscriptions.push(
    vscode.commands.registerCommand("emote.copyMcpConfig", () => {
      void copyMcpConfig();
    }),
  );

  // Control commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.setMood",
      (mood: string, duration?: number) => {
        const panel =
          RagdollPanel.currentPanel ??
          RagdollPanel.createOrShow(context.extensionUri);
        panel.postMessage({
          type: "setMood",
          mood: mood as FacialMood,
          duration,
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.triggerAction",
      (action: string, duration?: number) => {
        const panel =
          RagdollPanel.currentPanel ??
          RagdollPanel.createOrShow(context.extensionUri);
        panel.postMessage({
          type: "triggerAction",
          action: action as "wink" | "talk" | "shake",
          duration,
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.clearAction", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "clearAction" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.setHeadPose",
      (yawDegrees?: number, pitchDegrees?: number, duration?: number) => {
        const panel =
          RagdollPanel.currentPanel ??
          RagdollPanel.createOrShow(context.extensionUri);
        const yaw =
          yawDegrees !== undefined ? (yawDegrees * Math.PI) / 180 : undefined;
        const pitch =
          pitchDegrees !== undefined
            ? (pitchDegrees * Math.PI) / 180
            : undefined;
        panel.postMessage({ type: "setHeadPose", yaw, pitch, duration });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.setSpeechBubble",
      (text?: string, tone?: string) => {
        const panel =
          RagdollPanel.currentPanel ??
          RagdollPanel.createOrShow(context.extensionUri);
        panel.postMessage({
          type: "setSpeechBubble",
          text: text ?? null,
          tone: tone as BubbleTone | undefined,
        });
      },
    ),
  );

  // Theme command
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.setTheme",
      async (themeId?: string) => {
        // If themeId is provided, use it directly (e.g., from MCP command)
        if (themeId && VALID_THEMES.includes(themeId as ThemeId)) {
          void setThemeSetting(themeId as ThemeId);
          if (RagdollPanel.currentPanel) {
            RagdollPanel.currentPanel.postMessage({
              type: "setTheme",
              themeId,
            });
          }
          return;
        }

        // Otherwise, show quick pick dialog for user selection
        const themeOptions: Array<{
          label: string;
          description: string;
          id: ThemeId;
        }> = [
          {
            label: "Default",
            description: "Warm, human-like appearance",
            id: "default",
          },
          {
            label: "Robot",
            description: "Metallic, futuristic robot",
            id: "robot",
          },
          {
            label: "Alien",
            description: "Green, otherworldly alien",
            id: "alien",
          },
          {
            label: "Monochrome",
            description: "Classic black and white",
            id: "monochrome",
          },
        ];

        const currentTheme = getThemeSetting();
        const selected = await vscode.window.showQuickPick(themeOptions, {
          placeHolder: `Select theme (current: ${currentTheme})`,
        });

        if (selected) {
          void setThemeSetting(selected.id);
          if (RagdollPanel.currentPanel) {
            RagdollPanel.currentPanel.postMessage({
              type: "setTheme",
              themeId: selected.id,
            });
          }
        }
      },
    ),
  );

  // Pomodoro commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.startPomodoro",
      (sessionDuration?: number, breakDuration?: number) => {
        const panel =
          RagdollPanel.currentPanel ??
          RagdollPanel.createOrShow(context.extensionUri);
        panel.postMessage({
          type: "startPomodoro",
          sessionDuration: sessionDuration as PomodoroDuration | undefined,
          breakDuration: breakDuration as PomodoroDuration | undefined,
        });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.pausePomodoro", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "pausePomodoro" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.resetPomodoro", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "resetPomodoro" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.getPomodoroState", () => {
      // This will be handled by webview response
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "getPomodoroState" });
      }
      return null;
    }),
  );

  // Task commands
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.addTask",
      (text: string, status?: TaskStatus) => {
        const panel =
          RagdollPanel.currentPanel ??
          RagdollPanel.createOrShow(context.extensionUri);
        panel.postMessage({ type: "addTask", text, status });
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "emote.updateTaskStatus",
      (taskId: string, status: TaskStatus, blockedReason?: string) => {
        if (RagdollPanel.currentPanel) {
          RagdollPanel.currentPanel.postMessage({
            type: "updateTaskStatus",
            taskId,
            status,
            blockedReason,
          });
        }
      },
    ),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.setActiveTask", (taskId: string) => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({
          type: "setActiveTask",
          taskId,
        });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.removeTask", (taskId: string) => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "removeTask", taskId });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.completeActiveTask", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "completeActiveTask" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.clearCompletedTasks", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "clearCompletedTasks" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.clearAllTasks", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "clearAllTasks" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.expandTasks", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "expandTasks" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.collapseTasks", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "collapseTasks" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.toggleTasks", () => {
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "toggleTasks" });
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand("emote.listTasks", () => {
      // Request tasks from webview first
      if (RagdollPanel.currentPanel) {
        RagdollPanel.currentPanel.postMessage({ type: "listTasks" });
      }
      // Return current stored tasks (will be updated by webview)
      return getTasks();
    }),
  );

  // Watch for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("emote.theme")) {
        const theme = getThemeSetting();
        logMessage("info", "Theme setting changed", { theme });
        if (RagdollPanel.currentPanel) {
          RagdollPanel.currentPanel.postMessage({
            type: "setTheme",
            themeId: theme,
          });
        }
      }
    }),
  );

  // Start socket server for MCP commands
  startSocketServer(context);

  logMessage("info", "Emote extension activated");
}

function startSocketServer(context: vscode.ExtensionContext): void {
  ensureIpcDirectory();
  cleanupStaleSocket();

  const server = net.createServer((socket) => {
    let buffer = "";

    socket.on("data", (data) => {
      buffer += data.toString();

      // Process complete messages (newline-delimited JSON)
      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const message = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);

        if (!message) {
          continue;
        }

        try {
          const command = JSON.parse(message) as MCPCommand;
          const result = validateMcpCommand(command);

          if (result.ok) {
            // Special handling for commands that return data
            if (result.command.type === "listTasks") {
              // Request fresh tasks from webview
              if (RagdollPanel.currentPanel) {
                RagdollPanel.currentPanel.postMessage({ type: "listTasks" });
              }
              // Return current stored tasks (webview will update them)
              const tasks = getTasks();
              logMessage("info", "Processed MCP command", {
                type: result.command.type,
              });
              socket.write(
                JSON.stringify({ ok: true, type: result.command.type, tasks }) +
                  "\n",
              );
            } else if (result.command.type === "getPomodoroState") {
              // Request fresh pomodoro state from webview
              if (RagdollPanel.currentPanel) {
                RagdollPanel.currentPanel.postMessage({
                  type: "getPomodoroState",
                });
              }
              // Return current stored state (webview will update it)
              const state = getPomodoroState();
              logMessage("info", "Processed MCP command", {
                type: result.command.type,
              });
              socket.write(
                JSON.stringify({ ok: true, type: result.command.type, state }) +
                  "\n",
              );
            } else {
              handleValidatedCommand(result.command);
              logMessage("info", "Processed MCP command", {
                type: result.command.type,
              });
              socket.write(
                JSON.stringify({ ok: true, type: result.command.type }) + "\n",
              );
            }
          } else {
            logMessage("warn", "Rejected MCP command", {
              reason: result.reason,
            });
            socket.write(
              JSON.stringify({ ok: false, error: result.reason }) + "\n",
            );
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logMessage("warn", "Failed to parse MCP command", {
            error: errorMessage,
          });
          socket.write(
            JSON.stringify({ ok: false, error: "Invalid JSON" }) + "\n",
          );
        }
      }
    });

    socket.on("error", (error) => {
      logMessage("warn", "Socket client error", { error: error.message });
    });
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      logMessage(
        "warn",
        "Socket already in use - another VS Code window may be active",
        {
          path: SOCKET_PATH,
        },
      );
    } else {
      logMessage("error", "Socket server error", { error: error.message });
      notifyErrorOnce(
        "socket-server-error",
        "Emote could not start the command server. Check the Emote output channel for details.",
      );
    }
  });

  server.listen(SOCKET_PATH, () => {
    logMessage("info", "Socket server listening", { path: SOCKET_PATH });
  });

  context.subscriptions.push({
    dispose: () => {
      server.close();
      // Clean up socket file on Unix
      if (os.platform() !== "win32") {
        try {
          if (fs.existsSync(SOCKET_PATH)) {
            fs.unlinkSync(SOCKET_PATH);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
      logMessage("info", "Socket server stopped");
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
      void vscode.commands.executeCommand(
        "emote.setMood",
        command.mood,
        command.duration,
      );
      break;
    case "triggerAction":
      void vscode.commands.executeCommand(
        "emote.triggerAction",
        command.action,
        command.duration,
      );
      break;
    case "setHeadPose":
      void vscode.commands.executeCommand(
        "emote.setHeadPose",
        command.yawDegrees,
        command.pitchDegrees,
        command.duration,
      );
      break;
    case "setSpeechBubble":
      void vscode.commands.executeCommand(
        "emote.setSpeechBubble",
        command.text,
        command.tone,
      );
      break;
    case "setTheme":
      void vscode.commands.executeCommand("emote.setTheme", command.themeId);
      break;
    case "startPomodoro":
      void vscode.commands.executeCommand(
        "emote.startPomodoro",
        command.sessionDuration,
        command.breakDuration,
      );
      break;
    case "pausePomodoro":
      void vscode.commands.executeCommand("emote.pausePomodoro");
      break;
    case "resetPomodoro":
      void vscode.commands.executeCommand("emote.resetPomodoro");
      break;
    case "addTask":
      void vscode.commands.executeCommand(
        "emote.addTask",
        command.text,
        command.status,
      );
      break;
    case "updateTaskStatus":
      void vscode.commands.executeCommand(
        "emote.updateTaskStatus",
        command.taskId,
        command.status,
        command.blockedReason,
      );
      break;
    case "setActiveTask":
      void vscode.commands.executeCommand(
        "emote.setActiveTask",
        command.taskId,
      );
      break;
    case "removeTask":
      void vscode.commands.executeCommand("emote.removeTask", command.taskId);
      break;
    case "completeActiveTask":
      void vscode.commands.executeCommand("emote.completeActiveTask");
      break;
    case "clearCompletedTasks":
      void vscode.commands.executeCommand("emote.clearCompletedTasks");
      break;
    case "clearAllTasks":
      void vscode.commands.executeCommand("emote.clearAllTasks");
      break;
    case "expandTasks":
      void vscode.commands.executeCommand("emote.expandTasks");
      break;
    case "collapseTasks":
      void vscode.commands.executeCommand("emote.collapseTasks");
      break;
    case "toggleTasks":
      void vscode.commands.executeCommand("emote.toggleTasks");
      break;
  }
}

export function deactivate(): void {
  logMessage("info", "Emote extension deactivating...");
  RagdollPanel.hide();
}
