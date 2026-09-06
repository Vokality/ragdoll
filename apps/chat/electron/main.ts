import { app } from "electron";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LumenApplication } from "./lumen-application.js";
import { createMainProcessConfig } from "./main-process-config.js";
import { QuitCoordinator } from "./services/quit-coordinator.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
let application: LumenApplication | null = null;
let initialization = Promise.resolve();
const shutdown = new QuitCoordinator(
  async () => {
    await initialization;
    await application?.destroy();
  },
  () => app.quit(),
  (error) => reportFailure("Application shutdown failed", error),
);

function reportFailure(context: string, error: unknown): void {
  console.error(context, error);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("before-quit", shutdown.beforeQuit);
  app.on("second-instance", () => {
    if (!shutdown.isQuitting) application?.focusWindow();
  });

  initialization = app
    .whenReady()
    .then(async () => {
      const config = createMainProcessConfig(app, moduleDirectory);
      app.dock?.setIcon(config.appIconPath);
      application = await LumenApplication.create(config);
      if (shutdown.isQuitting) return;
      await application.createWindow();

      app.on("activate", () => {
        if (!shutdown.isQuitting && !application?.hasWindow()) {
          void application
            ?.createWindow()
            .catch((error: unknown) =>
              reportFailure("Window creation failed", error),
            );
        }
      });
    })
    .catch((error: unknown) => {
      reportFailure("Lumen startup failed", error);
      app.quit();
    });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
