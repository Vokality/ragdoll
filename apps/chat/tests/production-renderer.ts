import {
  app,
  BrowserWindow,
  type Event as ElectronEvent,
  type WebContents,
} from "electron";
import { LumenApplication } from "../electron/lumen-application.js";
import { createMainProcessConfig } from "../electron/main-process-config.js";

export async function verifyProductionRenderer(
  preloadPath: string,
  rendererHtmlPath: string,
): Promise<void> {
  const config = createMainProcessConfig(app, app.getAppPath());
  const application = await LumenApplication.create({
    ...config,
    isDevelopment: false,
    preloadPath,
    rendererHtmlPath,
  });
  const captureErrors = (_event: ElectronEvent, contents: WebContents) => {
    contents.on("console-message", (details) => {
      if (details.level === "error")
        console.error(`Production renderer: ${details.message}`);
    });
    contents.on("preload-error", (_event, path, error) =>
      console.error(`Preload ${path}:`, error),
    );
  };
  app.on("web-contents-created", captureErrors);
  try {
    await application.createWindow();
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) throw new Error("Production renderer did not create a window");
    const result: unknown = await window.webContents.executeJavaScript(`
      new Promise((resolve, reject) => {
        const deadline = setTimeout(() => { observer.disconnect(); reject(new Error("Production setup did not render: " + document.body.innerText)); }, 10000);
        const read = () => {
          if (!document.querySelector('input[type="password"]')) return;
          clearTimeout(deadline);
          observer.disconnect();
          resolve({
            protocol: location.protocol,
            styles: document.styleSheets.length,
            hasProvider: document.body.textContent.includes("OpenAI"),
            policy: document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content,
          });
        };
        const observer = new MutationObserver(read);
        observer.observe(document.body, { childList: true, subtree: true });
        read();
      })
    `);
    if (
      typeof result !== "object" ||
      result === null ||
      !("protocol" in result) ||
      result.protocol !== "file:" ||
      !("styles" in result) ||
      typeof result.styles !== "number" ||
      result.styles === 0 ||
      !("hasProvider" in result) ||
      !result.hasProvider ||
      !("policy" in result) ||
      typeof result.policy !== "string" ||
      !result.policy.includes("script-src 'self' https://sdk.scdn.co;") ||
      result.policy.includes("blob:")
    ) {
      throw new Error(`Production renderer failed: ${JSON.stringify(result)}`);
    }
    console.log(
      "PASS: Bun production HTML loads scripts, styles, and real provider setup through file:// and the isolated preload",
    );
  } finally {
    app.off("web-contents-created", captureErrors);
    for (const window of BrowserWindow.getAllWindows()) window.destroy();
    await application.destroy();
  }
}
