import { pathToFileURL } from "node:url";
import { isAuthorizedRenderer } from "../ipc/renderer-authority.js";
import { BrowserWindow, type IpcMainInvokeEvent } from "electron";
import type { MainProcessConfig } from "../main-process-config.js";
import type { ExternalNavigationService } from "./external-navigation-service.js";
import type { RendererEventService } from "./renderer-event-service.js";

export class WindowService {
  private window: BrowserWindow | null = null;
  private creation: Promise<BrowserWindow> | null = null;

  constructor(
    private readonly config: MainProcessConfig,
    private readonly navigation: ExternalNavigationService,
    private readonly rendererEvents: RendererEventService,
    private readonly lifecycle: { focused(): void; blurred(): void } = {
      focused() {},
      blurred() {},
    },
  ) {}

  create(): Promise<BrowserWindow> {
    if (this.creation) return this.creation;
    if (this.window && !this.window.isDestroyed())
      return Promise.resolve(this.window);
    const pending = this.createWindow();
    this.creation = pending;
    const release = () => {
      if (this.creation === pending) this.creation = null;
    };
    void pending.then(release, release);
    return pending;
  }

  private async createWindow(): Promise<BrowserWindow> {
    const window = new BrowserWindow({
      ...this.config.window,
      icon: this.config.appIconPath,
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
      webPreferences: {
        preload: this.config.preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    this.window = window;
    this.rendererEvents.attach(window);

    window.webContents.setWindowOpenHandler(({ url }) => {
      void this.navigation.open(url);
      return { action: "deny" };
    });
    window.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      void this.navigation.open(url);
    });
    window.on("focus", () => this.lifecycle.focused());
    window.on("blur", () => this.lifecycle.blurred());
    window.on("closed", () => {
      this.rendererEvents.detach(window);
      if (this.window === window) this.window = null;
    });

    try {
      if (this.config.isDevelopment) {
        await window.loadURL(this.config.developmentServerUrl);
        window.webContents.openDevTools({ mode: "detach" });
      } else {
        await window.loadFile(this.config.rendererHtmlPath);
      }
    } catch (error) {
      // A failed load must not leave a blank window registered as usable.
      // The closed listener releases both ownership and renderer delivery.
      if (!window.isDestroyed()) window.destroy();
      throw error;
    }
    return window;
  }

  authorizeIpc(event: IpcMainInvokeEvent): boolean {
    const window = this.window;
    if (!window || window.isDestroyed()) return false;
    return isAuthorizedRenderer(event, {
      sender: window.webContents,
      mainFrame: window.webContents.mainFrame,
      documentUrl: this.config.isDevelopment
        ? this.config.developmentServerUrl
        : pathToFileURL(this.config.rendererHtmlPath).href,
    });
  }

  hasWindow(): boolean {
    return Boolean(this.window && !this.window.isDestroyed());
  }

  focus(): void {
    this.rendererEvents.focus();
  }
}
