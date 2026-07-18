import { app } from "electron";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { LumenApplication } from "./lumen-application.js";
import {
  createMainProcessConfig,
  LUMEN_PROTOCOL_SCHEME,
} from "./main-process-config.js";

const moduleDirectory = dirname(fileURLToPath(import.meta.url));
const pendingOAuthUrls: string[] = [];
let application: LumenApplication | null = null;

function findOAuthUrl(arguments_: readonly string[]): string | undefined {
  return arguments_.find((argument) =>
    argument.startsWith(`${LUMEN_PROTOCOL_SCHEME}://`),
  );
}

function reportFailure(context: string, error: unknown): void {
  console.error(context, error);
}

function handleOAuthUrl(url: string): void {
  if (!application) {
    pendingOAuthUrls.push(url);
    return;
  }
  void application
    .handleOAuthUrl(url)
    .catch((error: unknown) => reportFailure("OAuth callback failed", error));
}

function registerProtocolHandler(protocolScheme: string): void {
  if (process.defaultApp) {
    const entrypoint = process.argv[1];
    if (!entrypoint)
      throw new Error("Electron development entrypoint is missing");
    app.setAsDefaultProtocolClient(protocolScheme, process.execPath, [
      resolve(entrypoint),
    ]);
    return;
  }
  app.setAsDefaultProtocolClient(protocolScheme);
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_event, commandLine) => {
    application?.focusWindow();
    const url = findOAuthUrl(commandLine);
    if (url) handleOAuthUrl(url);
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleOAuthUrl(url);
  });

  void app
    .whenReady()
    .then(async () => {
      const config = createMainProcessConfig(app, moduleDirectory);
      registerProtocolHandler(config.protocolScheme);
      application = await LumenApplication.create(config);
      await application.createWindow();

      for (const url of pendingOAuthUrls.splice(0)) handleOAuthUrl(url);

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
