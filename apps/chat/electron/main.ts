import { app } from "electron";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LumenApplication } from "./lumen-application.js";
import { createMainProcessConfig } from "./main-process-config.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
let application: LumenApplication | null = null;

function reportFailure(context: string, error: unknown): void {
  console.error(context, error);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    application?.focusWindow();
  });

  void app
    .whenReady()
    .then(async () => {
      const config = createMainProcessConfig(app, moduleDirectory);
      app.dock?.setIcon(config.appIconPath);
      application = await LumenApplication.create(config);
      await application.createWindow();

      app.on("activate", () => {
        if (!application?.hasWindow()) {
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

app.on("will-quit", () => {
  void application
    ?.destroy()
    .catch((error: unknown) =>
      reportFailure("Application shutdown failed", error),
    );
});
