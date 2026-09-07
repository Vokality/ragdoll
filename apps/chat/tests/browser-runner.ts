import { app, BrowserWindow } from "electron";
import { verifyWindowLoadRecovery } from "./window-lifecycle.js";

const origin = process.env.RAGDOLL_TEST_ORIGIN;
const profile = process.env.RAGDOLL_TEST_PROFILE;
if (!origin || new URL(origin).hostname !== "127.0.0.1" || !profile) {
  throw new Error("Run browser tests through the test:browser script");
}
app.setPath("userData", profile);
// Linux CI runs fixture pages in an isolated disposable process under Xvfb.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");
  app.commandLine.appendSwitch("use-angle", "swiftshader");
}
app.on("window-all-closed", () => {});

const pages = [
  "apps/chat/tests/smooth-text.html",
  "apps/chat/tests/web-citations.html",
  "apps/chat/tests/message-markdown.html",
  "apps/chat/tests/agent-progress.html",
  "apps/chat/tests/personal-memory.html",
  "apps/chat/tests/settings-navigation.html",
  "apps/chat/tests/app-layout.html",
  "apps/chat/tests/extension-configuration.html",
  "apps/chat/tests/extension-settings.html",
  "apps/chat/tests/connections-settings.html",
  "apps/chat/tests/character-card.html",
  "apps/chat/tests/canvas-panel.html",
  "apps/chat/tests/agent-card-controls.html",
  "apps/chat/tests/compact-forms.html",
  "apps/chat/tests/visible-slots.html",
  "apps/chat/tests/panel-actions.html",
  "apps/chat/tests/panel-dialog.html",
  "apps/chat/tests/composer-input.html",
  "packages/ragdoll/tests/renderers/lifecycle.html",
];

async function run(): Promise<void> {
  const startupDeadline = setTimeout(() => {
    console.error("Electron did not become ready within 30 seconds");
    app.exit(1);
  }, 30_000);
  await app.whenReady();
  clearTimeout(startupDeadline);
  await verifyWindowLoadRecovery();
  for (const page of pages) {
    const window = new BrowserWindow({
      show: false,
      width: page.endsWith("app-layout.html") ? 400 : 800,
      height: page.endsWith("app-layout.html") ? 600 : 900,
      useContentSize: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    const deadline = setTimeout(() => {
      console.error(`${page}: timed out after 30 seconds`);
      app.exit(1);
    }, 30_000);
    try {
      await window.loadURL(new URL(page, `${origin}/`).href);
      const result: unknown = await window.webContents.executeJavaScript(`
        new Promise((resolve, reject) => {
          const read = () => {
            const result = document.getElementById("result")?.textContent ?? "";
            if (result.startsWith("PASS:") || result.startsWith("FAIL:")) {
              observer.disconnect();
              resolve(result);
            }
          };
          const observer = new MutationObserver(read);
          observer.observe(document.body, {childList:true,subtree:true,characterData:true});
          read();
          window.addEventListener("error", event => reject(new Error(event.message)), {once:true});
        })
      `);
      if (typeof result !== "string" || !result.startsWith("PASS:")) {
        throw new Error(`${page}: ${String(result)}`);
      }
      console.log(`${page}: ${result}`);
    } finally {
      clearTimeout(deadline);
      if (!window.isDestroyed()) window.destroy();
    }
  }
  console.log(`Verified ${pages.length} browser regressions in Electron.`);
}
void run().then(
  () => app.exit(0),
  (error) => {
    console.error(error);
    app.exit(1);
  },
);
