import { BrowserWindow } from "electron";
import type { MainProcessConfig } from "../main-process-config.js";
import type { ExternalNavigationService } from "./external-navigation-service.js";
import type { RendererEventService } from "./renderer-event-service.js";

export class WindowService {
  private window: BrowserWindow | null = null;

  constructor(
    private readonly config: MainProcessConfig,
    private readonly navigation: ExternalNavigationService,
    private readonly rendererEvents: RendererEventService,
  ) {}

  async create(): Promise<BrowserWindow> {
    if (this.window && !this.window.isDestroyed()) return this.window;

    const window = new BrowserWindow({
      ...this.config.window,
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
    window.on("closed", () => {
      this.rendererEvents.detach(window);
      if (this.window === window) this.window = null;
    });

    if (this.config.isDevelopment) {
      await window.loadURL(this.config.developmentServerUrl);
      window.webContents.openDevTools({ mode: "detach" });
    } else {
      await window.loadFile(this.config.rendererHtmlPath);
    }
    return window;
  }

  hasWindow(): boolean {
    return Boolean(this.window && !this.window.isDestroyed());
  }

  focus(): void {
    this.rendererEvents.focus();
  }
}
