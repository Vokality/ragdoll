import {
  app,
  BrowserWindow,
  ipcMain,
  safeStorage,
  shell,
} from "electron";
import * as path from "path";
import * as fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage paths
const USER_DATA_PATH = app.getPath("userData");
const STORAGE_FILE = path.join(USER_DATA_PATH, "chat-storage.json");

// Development mode check
const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;

let mainWindow: BrowserWindow | null = null;

// Storage helpers
interface StorageData {
  apiKeyEncrypted?: string;
  settings?: {
    theme?: string;
    variant?: string;
  };
  conversation?: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
}

function loadStorage(): StorageData {
  try {
    if (fs.existsSync(STORAGE_FILE)) {
      const data = fs.readFileSync(STORAGE_FILE, "utf-8");
      return JSON.parse(data) as StorageData;
    }
  } catch (error) {
    console.error("Failed to load storage:", error);
  }
  return {};
}

function saveStorage(data: StorageData): void {
  try {
    fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to save storage:", error);
  }
}

function createWindow(): void {
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

// App lifecycle
app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
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
// IPC Handlers - Chat (OpenAI)
// ============================================

// Import the OpenAI service and MCP tools
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

    // Send message and stream response
    await sendChatMessage(
      apiKey,
      message,
      conversationHistory,
      // Streaming text callback
      (text: string) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("chat:streaming-text", text);
        }
      },
      // Function call callback
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

