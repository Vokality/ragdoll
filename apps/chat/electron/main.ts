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
import { getExtensionManager, type ExtensionManager } from "./services/extension-manager.js";
import { getExtensionInstaller, type ExtensionInstaller } from "./services/extension-installer.js";
import { createStorageRepository } from "./infrastructure/storage-repository.js";

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
let extensionInstaller: ExtensionInstaller | null = null;
let statePoller: ReturnType<typeof setInterval> | null = null;

async function createWindow(): Promise<void> {
  const storage = storageRepo.read();
  const disabledExtensions = storage.settings?.disabledExtensions ?? [];

  // User extensions directory (for user-installed extensions)
  const userExtensionsPath = path.join(USER_DATA_PATH, "extensions");
  if (!fs.existsSync(userExtensionsPath)) {
    fs.mkdirSync(userExtensionsPath, { recursive: true });
  }

  // Extension search paths differ between dev and production
  let searchPaths: string[];
  if (isDev) {
    // Development: search workspace packages and node_modules
    const workspaceRoot = path.resolve(__dirname, "../../../..");
    searchPaths = [
      path.join(workspaceRoot, "node_modules"),
      path.join(workspaceRoot, "packages"),
      userExtensionsPath,
    ];
  } else {
    // Production: search bundled node_modules (in asar) and user extensions
    searchPaths = [
      path.join(__dirname, "../node_modules"),  // Bundled extensions in app.asar
      userExtensionsPath,                        // User-installed extensions
    ];
  }

  extensionManager = getExtensionManager({
    userDataPath: USER_DATA_PATH,
    searchPaths,
    autoDiscover: true,
    disabledExtensions,
    onToolExecution: (name, args) => {
      logExtensions("Tool executed", { name, args });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("chat:function-call", name, args);
      }
    },
    onStateChange: (extensionId, channelId, state) => {
      logExtensions("State change", { extensionId, channelId });
      // Forward to renderer via generic IPC channel
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("extension-state:changed", {
          extensionId,
          channelId,
          state,
        });
      }
    },
    onSlotStateChange: (extensionId, slotId, state) => {
      logExtensions("Slot state change", { extensionId, slotId });
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("extension-slot:changed", {
          extensionId,
          slotId,
          state,
        });
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
    openExternal: (url: string) => shell.openExternal(url),
    oauthRedirectBase: "lumen://oauth",
  });
  await extensionManager.initialize();
  logExtensions("Extension manager initialized", extensionManager.getStats());

  // Initialize extension installer for user-installed extensions
  extensionInstaller = getExtensionInstaller(USER_DATA_PATH);

  // Periodically broadcast state channels to keep renderer timers (like Pomodoro) in sync
  if (statePoller) {
    clearInterval(statePoller);
  }
  statePoller = setInterval(() => {
    if (!extensionManager || !mainWindow || mainWindow.isDestroyed()) return;
    const channels = extensionManager.getAllStateChannels();
    channels.forEach(({ extensionId, channelId, state }) => {
      mainWindow?.webContents.send("extension-state:changed", {
        extensionId,
        channelId,
        state,
      });
    });
  }, 1000);

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

// Register custom protocol for OAuth callbacks (lumen://oauth/:extensionId?code=xxx)
const PROTOCOL_SCHEME = "lumen";
if (process.defaultApp) {
  // During development, we need to register ourselves as the default handler
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(PROTOCOL_SCHEME, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
  }
} else {
  // In production
  app.setAsDefaultProtocolClient(PROTOCOL_SCHEME);
}

/**
 * Handle OAuth callback URLs (lumen://oauth/:extensionId?code=xxx)
 */
function handleOAuthUrl(url: string): void {
  try {
    const parsed = new URL(url);
    // Expected format: lumen://oauth/extensionId?code=xxx
    if (parsed.host !== "oauth") {
      logExtensions("Ignoring non-OAuth URL:", url);
      return;
    }

    const extensionId = parsed.pathname.slice(1); // Remove leading /
    const code = parsed.searchParams.get("code");
    const error = parsed.searchParams.get("error");

    if (error) {
      console.error(`OAuth error for ${extensionId}:`, error);
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("oauth:error", { extensionId, error });
      }
      return;
    }

    if (code && extensionId && extensionManager) {
      logExtensions(`OAuth callback for ${extensionId}`);
      extensionManager.handleOAuthCallback(extensionId, code).then(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("oauth:success", { extensionId });
          mainWindow.focus();
        }
      }).catch((err) => {
        console.error(`OAuth callback failed for ${extensionId}:`, err);
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("oauth:error", {
            extensionId,
            error: err instanceof Error ? err.message : "Unknown error",
          });
        }
      });
    }
  } catch (err) {
    console.error("Failed to parse OAuth URL:", err);
  }
}

// Handle single instance (prevent multiple windows)
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

    // Handle deep link on Windows/Linux (protocol URL passed as argument)
    const url = commandLine.find((arg) => arg.startsWith(`${PROTOCOL_SCHEME}://`));
    if (url) {
      handleOAuthUrl(url);
    }
  });

  // Handle deep link on macOS
  app.on("open-url", (_event, url) => {
    handleOAuthUrl(url);
  });
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
  if (statePoller) {
    clearInterval(statePoller);
    statePoller = null;
  }
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
// IPC Handlers - Extensions
// ============================================

ipcMain.handle("extensions:get-available", async () => {
  if (!extensionManager) return [];
  return extensionManager.getAvailableExtensions();
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

ipcMain.handle("extensions:get-discovered", async () => {
  if (!extensionManager) return [];
  return extensionManager.getDiscoveredExtensions();
});

// ============================================
// IPC Handlers - Extension State Channels
// ============================================

ipcMain.handle("extensions:get-all-state-channels", async () => {
  if (!extensionManager) return [];
  return extensionManager.getAllStateChannels();
});

ipcMain.handle("extensions:get-state-channel", async (_, channelId: string) => {
  if (!extensionManager) return null;
  return extensionManager.getStateChannelState(channelId);
});

// ============================================
// IPC Handlers - Extension OAuth
// ============================================

ipcMain.handle("extensions:oauth-get-state", async (_, extensionId: string) => {
  if (!extensionManager) return null;
  return extensionManager.getOAuthState(extensionId);
});

ipcMain.handle("extensions:oauth-start-flow", async (_, extensionId: string) => {
  if (!extensionManager) {
    return { success: false, error: "Extension manager not initialized" };
  }
  try {
    await extensionManager.startOAuthFlow(extensionId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

ipcMain.handle("extensions:oauth-disconnect", async (_, extensionId: string) => {
  if (!extensionManager) {
    return { success: false, error: "Extension manager not initialized" };
  }
  try {
    await extensionManager.disconnectOAuth(extensionId);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
});

// ============================================
// IPC Handlers - Extension Config
// ============================================

ipcMain.handle("extensions:config-get-status", async (_, extensionId: string) => {
  if (!extensionManager) return null;
  return extensionManager.getConfigStatus(extensionId);
});

ipcMain.handle("extensions:config-get-schema", async (_, extensionId: string) => {
  if (!extensionManager) return null;
  return extensionManager.getConfigSchema(extensionId);
});

ipcMain.handle(
  "extensions:config-set-value",
  async (_, extensionId: string, key: string, value: string | number | boolean) => {
    if (!extensionManager) {
      return { success: false, error: "Extension manager not initialized" };
    }
    try {
      await extensionManager.setConfigValue(extensionId, key, value);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }
);

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
// IPC Handlers - Extension Package Management
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

ipcMain.handle("extensions:get-slots", async () => {
  if (!extensionManager) {
    return [];
  }
  return extensionManager.getAllSlots();
});

ipcMain.handle("extensions:get-slot-state", async (_event, slotId: string) => {
  if (!extensionManager) return null;
  return extensionManager.getSlotState(slotId);
});

ipcMain.handle(
  "extensions:execute-slot-action",
  async (_event, slotId: string, actionType: string, actionId: string) => {
    if (!extensionManager) {
      return { success: false, error: "Extension manager not initialized" };
    }
    return extensionManager.executeSlotAction(slotId, actionType, actionId);
  }
);

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
      // After executing a tool, broadcast the latest state for all channels to keep the UI in sync
      if (mainWindow && !mainWindow.isDestroyed()) {
        const channels = extensionManager.getAllStateChannels();
        channels.forEach(({ extensionId, channelId, state }) => {
          mainWindow?.webContents.send("extension-state:changed", {
            extensionId,
            channelId,
            state,
          });
        });
      }
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
// IPC Handlers - Extension Installation
// ============================================

ipcMain.handle("extensions:install-from-github", async (_, repoUrl: string) => {
  if (!extensionInstaller) {
    return { success: false, error: "Extension installer not initialized" };
  }
  const result = await extensionInstaller.installFromGitHub(repoUrl);

  // If successful, reload extensions to pick up the new one
  if (result.success && extensionManager) {
    await extensionManager.discoverAndLoadPackages();
  }

  return result;
});

ipcMain.handle("extensions:uninstall", async (_, extensionId: string) => {
  if (!extensionInstaller) {
    return { success: false, error: "Extension installer not initialized" };
  }

  // First unload from extension manager
  if (extensionManager) {
    const loadedPackages = extensionManager.getLoadedPackages();
    const pkg = loadedPackages.find((p) => p.includes(extensionId));
    if (pkg) {
      await extensionManager.unloadPackage(pkg);
    }
  }

  return extensionInstaller.uninstall(extensionId);
});

ipcMain.handle("extensions:get-user-installed", async () => {
  if (!extensionInstaller) {
    return [];
  }
  return extensionInstaller.getInstalledExtensions();
});

ipcMain.handle("extensions:check-updates", async () => {
  if (!extensionInstaller) {
    return [];
  }
  return extensionInstaller.checkForUpdates();
});

ipcMain.handle("extensions:update", async (_, extensionId: string) => {
  if (!extensionInstaller) {
    return { success: false, error: "Extension installer not initialized" };
  }

  // First unload the old version
  if (extensionManager) {
    const loadedPackages = extensionManager.getLoadedPackages();
    const pkg = loadedPackages.find((p) => p.includes(extensionId));
    if (pkg) {
      await extensionManager.unloadPackage(pkg);
    }
  }

  const result = await extensionInstaller.update(extensionId);

  // If successful, reload extensions
  if (result.success && extensionManager) {
    await extensionManager.discoverAndLoadPackages();
  }

  return result;
});

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
