import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  safeStorage,
  shell,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";
import type { Task, TaskState } from "@vokality/ragdoll";
import { z } from "zod";
import { getExtensionManager, type ExtensionManager } from "./services/extension-manager.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage paths
const USER_DATA_PATH = app.getPath("userData");
const STORAGE_FILE = path.join(USER_DATA_PATH, "chat-storage.json");

// Development mode check
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let extensionManager: ExtensionManager | null = null;

// Storage helpers
const TASK_STATUS_VALUES = ["todo", "in_progress", "blocked", "done"] as const;

const taskSchema: z.ZodType<Task> = z.object({
  id: z.string(),
  text: z.string(),
  status: z.enum(TASK_STATUS_VALUES),
  createdAt: z.number().int().nonnegative(),
  blockedReason: z.string().optional(),
});

const taskStateSchema: z.ZodType<TaskState> = z.object({
  tasks: z.array(taskSchema),
  activeTaskId: z.string().nullable(),
  isExpanded: z.boolean().default(false),
});

const conversationMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});

const spotifyTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresAt: z.number(),
  scope: z.string(),
});

const storageSchema = z
  .object({
    apiKey: z.string().optional(),
    apiKeyEncrypted: z.string().optional(),
    settings: z
      .object({
        theme: z.string().optional(),
        variant: z.string().optional(),
      })
      .optional(),
    conversation: z.array(conversationMessageSchema).optional(),
    tasks: taskStateSchema.optional(),
    spotifyClientId: z.string().optional(),
    spotifyTokens: spotifyTokensSchema.optional(),
  })
  .passthrough();

type StorageData = z.infer<typeof storageSchema>;

const DEFAULT_TASK_STATE: TaskState = {
  tasks: [],
  activeTaskId: null,
  isExpanded: false,
};

function cloneTaskState(state: TaskState): TaskState {
  return {
    tasks: state.tasks.map((task: Task) => ({ ...task })),
    activeTaskId: state.activeTaskId,
    isExpanded: state.isExpanded,
  };
}

function loadStorage(): StorageData {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      const result = storageSchema.safeParse(parsed);
      if (result.success) {
        return result.data;
      }
      console.warn("Invalid chat storage detected, falling back to defaults", result.error.flatten());
    }
  } catch (error) {
    console.error("Failed to load storage:", error);
  }
  return {};
}

function saveStorage(data: StorageData): void {
  try {
    const validated = storageSchema.parse(data);
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(validated, null, 2));
  } catch (error) {
    console.error("Failed to save storage:", error);
  }
}

function getStoredTaskState(): TaskState {
  const storage = loadStorage();
  return storage.tasks ? cloneTaskState(storage.tasks) : cloneTaskState(DEFAULT_TASK_STATE);
}

async function createWindow(): Promise<void> {
  // Load initial task state from storage
  const initialTaskState = getStoredTaskState();

  // Load Spotify config from storage
  const storage = loadStorage();
  const spotifyClientId = storage.spotifyClientId || process.env.SPOTIFY_CLIENT_ID;
  const spotifyTokens = storage.spotifyTokens;

  // Initialize extension manager with state management
  extensionManager = getExtensionManager({
    initialTaskState,
    onToolExecution: (name, args) => {
      // Forward character tools to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("chat:function-call", name, args);
      }
    },
    onTaskStateChange: (event) => {
      // Persist task state to storage
      const storage = loadStorage();
      storage.tasks = event.state;
      saveStorage(storage);

      // Notify renderer of state change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("tasks:state-changed", event);
      }
    },
    onPomodoroStateChange: (event) => {
      // Notify renderer of pomodoro state change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("pomodoro:state-changed", event);
      }
    },
    onSpotifyStateChange: (event) => {
      // Notify renderer of Spotify state change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("spotify:state-changed", event);
      }
    },
    onNotification: (notification) => {
      if (Notification.isSupported()) {
        new Notification({
          title: notification.title,
          body: notification.body,
          silent: notification.silent,
        }).show();
      }
    },
    // Spotify config - only enabled if client ID is configured
    spotify: spotifyClientId ? {
      clientId: spotifyClientId,
      redirectUri: "ragdoll://spotify-callback",
      initialTokens: spotifyTokens,
    } : undefined,
  });
  await extensionManager.initialize();

  mainWindow = new BrowserWindow({
    width: 480,
    height: 800,
    minWidth: 400,
    minHeight: 600,
    backgroundColor: "#0f172a",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// Register custom protocol for OAuth callbacks
if (process.defaultApp) {
  // Development: register with path to electron
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("ragdoll", process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // Production
  app.setAsDefaultProtocolClient("ragdoll");
}

// Handle protocol URLs on macOS
app.on("open-url", async (event, url) => {
  event.preventDefault();
  await handleProtocolUrl(url);
});

// Handle protocol URLs on Windows/Linux (single instance)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", async (_event, commandLine, _workingDirectory) => {
    // Someone tried to run a second instance, we should focus our window
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
    // Handle the protocol URL from command line (Windows/Linux)
    const url = commandLine.find((arg) => arg.startsWith("ragdoll://"));
    if (url) {
      await handleProtocolUrl(url);
    }
  });
}

/**
 * Handle ragdoll:// protocol URLs
 */
async function handleProtocolUrl(url: string): Promise<void> {
  console.log("[Protocol] Received URL:", url);

  try {
    const parsed = new URL(url);

    // Handle Spotify OAuth callback: ragdoll://spotify-callback?code=...
    if (parsed.hostname === "spotify-callback" || parsed.pathname === "//spotify-callback") {
      const code = parsed.searchParams.get("code");
      const error = parsed.searchParams.get("error");

      if (error) {
        console.error("[Protocol] Spotify auth error:", error);
        mainWindow?.webContents.send("spotify:auth-error", error);
        return;
      }

      if (code) {
        console.log("[Protocol] Exchanging Spotify code...");
        const tokens = await extensionManager?.exchangeSpotifyCode(code);

        if (tokens) {
          // Persist tokens
          const storage = loadStorage();
          storage.spotifyTokens = tokens;
          saveStorage(storage);

          console.log("[Protocol] Spotify tokens saved, notifying renderer...");
          mainWindow?.webContents.send("spotify:auth-success");

          // Focus the window
          if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
          }
        } else {
          console.error("[Protocol] Failed to exchange code");
          mainWindow?.webContents.send("spotify:auth-error", "Failed to exchange authorization code");
        }
      }
    }
  } catch (err) {
    console.error("[Protocol] Error handling URL:", err);
  }
}

// App lifecycle
app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// ============================================
// IPC Handlers - Auth
// ============================================

ipcMain.handle("auth:has-key", async (): Promise<boolean> => {
  const storage = loadStorage();
  return !!storage.apiKeyEncrypted;
});

ipcMain.handle("auth:set-key", async (_, key: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!key || typeof key !== "string") {
      return { success: false, error: "Invalid API key" };
    }

    // Basic format validation
    if (!key.startsWith("sk-") || key.length < 20) {
      return { success: false, error: "Invalid API key format" };
    }

    // Encrypt and store
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = safeStorage.encryptString(key);
      const storage = loadStorage();
      storage.apiKeyEncrypted = encrypted.toString("base64");
      saveStorage(storage);
      return { success: true };
    } else {
      // Fallback for systems without secure storage
      const storage = loadStorage();
      storage.apiKeyEncrypted = Buffer.from(key).toString("base64");
      saveStorage(storage);
      return { success: true };
    }
  } catch (error) {
    console.error("Failed to set API key:", error);
    return { success: false, error: "Failed to store API key" };
  }
});

ipcMain.handle("auth:get-key", async (): Promise<string | null> => {
  try {
    const storage = loadStorage();
    if (!storage.apiKeyEncrypted) {
      return null;
    }

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = Buffer.from(storage.apiKeyEncrypted, "base64");
      return safeStorage.decryptString(encrypted);
    } else {
      return Buffer.from(storage.apiKeyEncrypted, "base64").toString();
    }
  } catch (error) {
    console.error("Failed to get API key:", error);
    return null;
  }
});

ipcMain.handle("auth:clear-key", async (): Promise<{ success: boolean }> => {
  try {
    const storage = loadStorage();
    delete storage.apiKeyEncrypted;
    saveStorage(storage);
    return { success: true };
  } catch (error) {
    console.error("Failed to clear API key:", error);
    return { success: false };
  }
});

ipcMain.handle("auth:validate-key", async (_, key: string): Promise<{ valid: boolean; error?: string }> => {
  try {
    // Import OpenAI dynamically to avoid issues if not installed
    const { default: OpenAI } = await import("openai");
    const openai = new OpenAI({ apiKey: key });

    // Make a simple API call to validate
    await openai.models.list();
    return { valid: true };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    if (errorMessage.includes("401") || errorMessage.includes("invalid_api_key")) {
      return { valid: false, error: "Invalid API key" };
    }
    if (errorMessage.includes("429")) {
      return { valid: false, error: "Rate limited. Please try again later." };
    }
    return { valid: false, error: errorMessage };
  }
});

// ============================================
// IPC Handlers - Settings
// ============================================

ipcMain.handle("settings:get", async () => {
  const storage = loadStorage();
  return storage.settings ?? { theme: "default", variant: "human" };
});

ipcMain.handle("settings:set", async (_, settings: { theme?: string; variant?: string }) => {
  const storage = loadStorage();
  storage.settings = { ...storage.settings, ...settings };
  saveStorage(storage);
  return { success: true };
});

// ============================================
// IPC Handlers - Conversation
// ============================================

ipcMain.handle("chat:get-conversation", async () => {
  const storage = loadStorage();
  return storage.conversation ?? [];
});

ipcMain.handle("chat:clear-conversation", async () => {
  const storage = loadStorage();
  storage.conversation = [];
  saveStorage(storage);
  return { success: true };
});

ipcMain.handle("chat:save-conversation", async (_, conversation: Array<{ role: "user" | "assistant"; content: string }>) => {
  const storage = loadStorage();
  storage.conversation = conversation;
  saveStorage(storage);
  return { success: true };
});

// ============================================
// IPC Handlers - Tasks
// ============================================

ipcMain.handle("tasks:get-state", async (): Promise<TaskState> => {
  // Get state from extension manager if available, otherwise from storage
  if (extensionManager) {
    const state = extensionManager.getTaskState();
    if (state) return state;
  }
  return getStoredTaskState();
});

ipcMain.handle("tasks:save-state", async (_, state: TaskState): Promise<{ success: boolean; error?: string }> => {
  try {
    const parsed = taskStateSchema.parse(state);
    // Load state into extension manager
    if (extensionManager) {
      extensionManager.loadTaskState(parsed);
    }
    // Also persist to storage
    const storage = loadStorage();
    storage.tasks = cloneTaskState(parsed);
    saveStorage(storage);
    return { success: true };
  } catch (error) {
    console.error("Failed to persist tasks:", error);
    return { success: false, error: "Invalid task payload" };
  }
});

// Pomodoro state handler
ipcMain.handle("pomodoro:get-state", async () => {
  if (!extensionManager) {
    return null;
  }
  return extensionManager.getPomodoroState();
});

// ============================================
// IPC Handlers - Spotify
// ============================================

ipcMain.handle("spotify:is-enabled", async () => {
  return extensionManager?.isSpotifyEnabled() ?? false;
});

ipcMain.handle("spotify:is-authenticated", async () => {
  return extensionManager?.isSpotifyAuthenticated() ?? false;
});

ipcMain.handle("spotify:get-auth-url", async (_, state?: string) => {
  return extensionManager?.getSpotifyAuthUrl(state) ?? null;
});

ipcMain.handle("spotify:exchange-code", async (_, code: string) => {
  try {
    const tokens = await extensionManager?.exchangeSpotifyCode(code);
    if (tokens) {
      // Persist tokens to storage
      const storage = loadStorage();
      (storage as Record<string, unknown>).spotifyTokens = tokens;
      saveStorage(storage);
      return { success: true, tokens };
    }
    return { success: false, error: "Failed to exchange code" };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("spotify:get-access-token", async () => {
  return extensionManager?.getSpotifyAccessToken() ?? null;
});

ipcMain.handle("spotify:get-playback-state", async () => {
  return extensionManager?.getSpotifyPlaybackState() ?? null;
});

ipcMain.handle("spotify:update-playback-state", async (_, playback) => {
  extensionManager?.updateSpotifyPlaybackState(playback);
  return { success: true };
});

ipcMain.handle("spotify:disconnect", async () => {
  extensionManager?.disconnectSpotify();
  // Clear persisted tokens
  const storage = loadStorage();
  delete storage.spotifyTokens;
  saveStorage(storage);
  return { success: true };
});

ipcMain.handle("spotify:get-client-id", async () => {
  const storage = loadStorage();
  return storage.spotifyClientId || process.env.SPOTIFY_CLIENT_ID || null;
});

ipcMain.handle("spotify:set-client-id", async (_, clientId: string) => {
  const storage = loadStorage();
  storage.spotifyClientId = clientId;
  saveStorage(storage);
  return { success: true };
});

ipcMain.handle("spotify:play", async () => {
  try {
    await extensionManager?.spotifyPlay();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("spotify:pause", async () => {
  try {
    await extensionManager?.spotifyPause();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("spotify:next", async () => {
  try {
    await extensionManager?.spotifyNext();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

ipcMain.handle("spotify:previous", async () => {
  try {
    await extensionManager?.spotifyPrevious();
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
});

// ============================================
// IPC Handlers - Extensions
// ============================================

ipcMain.handle("extensions:get-stats", async () => {
  if (!extensionManager) {
    return { extensionCount: 0, toolCount: 0 };
  }
  return extensionManager.getStats();
});

ipcMain.handle("extensions:get-tools", async () => {
  if (!extensionManager) {
    return [];
  }
  return extensionManager.getTools();
});

ipcMain.handle("extensions:discover-packages", async () => {
  if (!extensionManager) {
    return [];
  }
  return extensionManager.discoverPackages();
});

ipcMain.handle("extensions:get-loaded-packages", async () => {
  if (!extensionManager) {
    return [];
  }
  return extensionManager.getLoadedPackages();
});

ipcMain.handle(
  "extensions:load-package",
  async (_, packageName: string, config?: Record<string, unknown>) => {
    if (!extensionManager) {
      return { packageName, extensionId: "", success: false, error: "Extension manager not initialized" };
    }
    return extensionManager.loadPackage(packageName, config);
  }
);

ipcMain.handle("extensions:unload-package", async (_, packageName: string) => {
  if (!extensionManager) {
    return false;
  }
  return extensionManager.unloadPackage(packageName);
});

ipcMain.handle(
  "extensions:reload-package",
  async (_, packageName: string, config?: Record<string, unknown>) => {
    if (!extensionManager) {
      return { packageName, extensionId: "", success: false, error: "Extension manager not initialized" };
    }
    return extensionManager.reloadPackage(packageName, config);
  }
);

ipcMain.handle("extensions:discover-and-load", async () => {
  if (!extensionManager) {
    return [];
  }
  return extensionManager.discoverAndLoadPackages();
});

// ============================================
// IPC Handlers - Chat (OpenAI)
// ============================================

import { sendChatMessage } from "./services/openai-service.js";

ipcMain.handle("chat:send-message", async (event, message: string, conversationHistory: Array<{ role: "user" | "assistant"; content: string }>) => {
  try {
    // Get API key
    const storage = loadStorage();
    if (!storage.apiKeyEncrypted) {
      return { success: false, error: "No API key configured" };
    }

    let apiKey: string;
    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = Buffer.from(storage.apiKeyEncrypted, "base64");
      apiKey = safeStorage.decryptString(encrypted);
    } else {
      apiKey = Buffer.from(storage.apiKeyEncrypted, "base64").toString();
    }

    // Ensure extension manager is initialized
    if (!extensionManager) {
      return { success: false, error: "Extension manager not initialized" };
    }

    // Send message and stream response
    await sendChatMessage(
      apiKey,
      message,
      conversationHistory,
      extensionManager,
      // Streaming text callback
      (text: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("chat:streaming-text", text);
        }
      },
      // Function call callback (already handled by extension manager, but keep for compatibility)
      (name: string, args: Record<string, unknown>) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("chat:function-call", name, args);
        }
      },
      // Stream end callback
      () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("chat:stream-end");
        }
      }
    );

    return { success: true };
  } catch (error) {
    console.error("Chat error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: errorMessage };
  }
});
