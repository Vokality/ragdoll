import {
  app,
  BrowserWindow,
  ipcMain,
  Notification,
  safeStorage,
  shell,
} from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import type { TaskState } from "@vokality/ragdoll-extension-tasks";
import { getExtensionManager, BUILT_IN_EXTENSIONS, type ExtensionManager } from "./services/extension-manager.js";
import {
  createStorageRepository,
  cloneTaskState,
} from "./infrastructure/storage-repository.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage paths
const USER_DATA_PATH = app.getPath("userData");
const storageRepo = createStorageRepository(USER_DATA_PATH);

// Development mode check
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
const extensionsDebugEnabled = process.env.RAGDOLL_DEBUG_EXTENSIONS !== "false";
const logExtensions = (...args: unknown[]): void => {
  if (extensionsDebugEnabled) {
    console.info("[Main][Extensions]", ...args);
  }
};

let mainWindow: BrowserWindow | null = null;
let extensionManager: ExtensionManager | null = null;

async function createWindow(): Promise<void> {
  const initialTaskState = storageRepo.getTaskState();
  const storage = storageRepo.read();
  const spotifyClientId = storage.spotifyClientId || process.env.SPOTIFY_CLIENT_ID;
  const spotifyTokens = storage.spotifyTokens;

  const disabledExtensions = storage.settings?.disabledExtensions ?? [];
  extensionManager = getExtensionManager({
    userDataPath: USER_DATA_PATH,
    initialTaskState,
    disabledExtensions,
    onToolExecution: (name, args) => {
      logExtensions("Tool executed", { name, args });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("chat:function-call", name, args);
      }
    },
    onTaskStateChange: (event) => {
      logExtensions("Task state event", {
        type: event.type,
        taskCount: event.state.tasks?.length ?? 0,
      });
      storageRepo.update((draft) => {
        draft.tasks = cloneTaskState(event.state);
      });

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("tasks:state-changed", event);
      }
    },
    onPomodoroStateChange: (event) => {
      logExtensions("Pomodoro state event", {
        type: event.type,
        phase: event.state.phase,
        remainingMs: event.state.remainingMs,
      });
      // Notify renderer of pomodoro state change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("pomodoro:state-changed", event);
      }
    },
    onSpotifyStateChange: (event) => {
      logExtensions("Spotify state event", {
        type: event.type,
      });
      // Notify renderer of Spotify state change
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("spotify:state-changed", event);
      }
    },
    onNotification: (notification) => {
      logExtensions("Notification", notification.title ?? notification.body);
      if (Notification.isSupported()) {
        new Notification({
          title: notification.title,
          body: notification.body,
          silent: notification.silent,
        }).show();
      }
    },
    // Spotify config - only enabled if client ID is configured
    spotify: spotifyClientId
      ? {
          clientId: spotifyClientId,
          redirectUri: "lumen://spotify-callback",
          initialTokens: spotifyTokens,
        }
      : undefined,
  });
  await extensionManager.initialize();
  logExtensions("Extension manager initialized", extensionManager.getStats());

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
    app.setAsDefaultProtocolClient("lumen", process.execPath, [path.resolve(process.argv[1])]);
  }

} else {
  // Production
  app.setAsDefaultProtocolClient("lumen");
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
    const url = commandLine.find((arg) => arg.startsWith("lumen://"));
    if (url) {
      await handleProtocolUrl(url);
    }
  });
}

/**
 * Handle lumen:// protocol URLs
 */
async function handleProtocolUrl(url: string): Promise<void> {
  console.log("[Protocol] Received URL:", url);

  try {
    const parsed = new URL(url);

    // Handle Spotify OAuth callback: lumen://spotify-callback?code=...
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
          storageRepo.update((draft) => {
            draft.spotifyTokens = tokens;
          });

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
  const storage = storageRepo.read();
  return !!storage.apiKeyEncrypted;
});

ipcMain.handle("auth:set-key", async (_, key: string): Promise<{ success: boolean; error?: string }> => {
  try {
    if (!key || typeof key !== "string") {
      return { success: false, error: "Invalid API key" };
    }

    if (!key.startsWith("sk-") || key.length < 20) {
      return { success: false, error: "Invalid API key format" };
    }

    const encryptedValue = safeStorage.isEncryptionAvailable()
      ? safeStorage.encryptString(key).toString("base64")
      : Buffer.from(key).toString("base64");

    storageRepo.update((draft) => {
      draft.apiKeyEncrypted = encryptedValue;
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to set API key:", error);
    return { success: false, error: "Failed to store API key" };
  }
});

ipcMain.handle("auth:get-key", async (): Promise<string | null> => {
  try {
    const storage = storageRepo.read();
    if (!storage.apiKeyEncrypted) {
      return null;
    }

    if (safeStorage.isEncryptionAvailable()) {
      const encrypted = Buffer.from(storage.apiKeyEncrypted, "base64");
      return safeStorage.decryptString(encrypted);
    }
    return Buffer.from(storage.apiKeyEncrypted, "base64").toString();
  } catch (error) {
    console.error("Failed to get API key:", error);
    return null;
  }
});

ipcMain.handle("auth:clear-key", async (): Promise<{ success: boolean }> => {
  try {
    storageRepo.update((draft) => {
      delete draft.apiKeyEncrypted;
    });
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
  const storage = storageRepo.read();
  return storage.settings ?? { theme: "default", variant: "human" };
});

ipcMain.handle("settings:set", async (_, settings: { theme?: string; variant?: string }) => {
  storageRepo.update((draft) => {
    draft.settings = { ...draft.settings, ...settings };
  });
  return { success: true };
});

// ============================================
// IPC Handlers - Extensions (Built-in)
// ============================================

ipcMain.handle("extensions:get-available", async () => {
  return BUILT_IN_EXTENSIONS;
});

ipcMain.handle("extensions:get-disabled", async () => {
  const storage = storageRepo.read();
  return storage.settings?.disabledExtensions ?? [];
});

ipcMain.handle("extensions:set-disabled", async (_, disabledExtensions: string[]) => {
  storageRepo.update((draft) => {
    draft.settings = { ...draft.settings, disabledExtensions };
  });
  return { success: true, requiresRestart: true };
});

// ============================================
// IPC Handlers - Conversation
// ============================================

ipcMain.handle("chat:get-conversation", async () => {
  const storage = storageRepo.read();
  return storage.conversation ?? [];
});

ipcMain.handle("chat:clear-conversation", async () => {
  storageRepo.update((draft) => {
    draft.conversation = [];
  });
  return { success: true };
});

ipcMain.handle("chat:save-conversation", async (_, conversation: Array<{ role: "user" | "assistant"; content: string }>) => {
  storageRepo.update((draft) => {
    draft.conversation = conversation;
  });
  return { success: true };
});

// ============================================
// IPC Handlers - Tasks
// ============================================

ipcMain.handle("tasks:get-state", async (): Promise<TaskState> => {
  let state: TaskState | null = null;
  if (extensionManager) {
    state = extensionManager.getTaskState();
  }
  const result = state ?? storageRepo.getTaskState();
  logExtensions("IPC tasks:get-state", {
    usedManager: !!state,
    taskCount: result.tasks.length,
  });
  return result;
});


// Pomodoro state handler
ipcMain.handle("pomodoro:get-state", async () => {
  if (!extensionManager) {
    logExtensions("IPC pomodoro:get-state", { available: false });
    return null;
  }
  const state = extensionManager.getPomodoroState();
  logExtensions("IPC pomodoro:get-state", {
    available: !!state,
    phase: state?.phase,
  });
  return state;
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
      storageRepo.update((draft) => {
        draft.spotifyTokens = tokens;
      });
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
  storageRepo.update((draft) => {
    delete draft.spotifyTokens;
  });
  return { success: true };
});

ipcMain.handle("spotify:get-client-id", async () => {
  const storage = storageRepo.read();
  return storage.spotifyClientId || process.env.SPOTIFY_CLIENT_ID || null;
});

ipcMain.handle("spotify:set-client-id", async (_, clientId: string) => {
  storageRepo.update((draft) => {
    draft.spotifyClientId = clientId;
  });
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

ipcMain.handle(
  "extensions:execute-tool",
  async (_event, toolName: string, args?: Record<string, unknown>) => {
    logExtensions("IPC execute-tool", { toolName, args });
    if (!extensionManager) {
      logExtensions("Extension manager missing for tool execution", toolName);
      return { success: false, error: "Extension manager not initialized" };
    }
    try {
      const result = await extensionManager.executeTool(toolName, args ?? {});
      logExtensions("Tool execution result", { toolName, success: result.success });
      return result;
    } catch (error) {
      console.error("Failed to execute tool", toolName, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
);

// ============================================
// IPC Handlers - Chat (OpenAI)
// ============================================

import { sendChatMessage } from "./services/openai-service.js";

ipcMain.handle("chat:send-message", async (event, message: string, conversationHistory: Array<{ role: "user" | "assistant"; content: string }>) => {
  try {
    const storage = storageRepo.read();
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
