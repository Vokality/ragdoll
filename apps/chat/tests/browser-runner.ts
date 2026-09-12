import { browserPages } from "./browser-pages.js";
import { verifyProductionRenderer } from "./production-renderer.js";
import { app, BrowserWindow } from "electron";
import { verifyProviderIpc } from "./provider-ipc.js";
import { verifyChatIpc } from "./chat-ipc.js";
import { verifyWindowLoadRecovery } from "./window-lifecycle.js";

const origin = process.env.RAGDOLL_TEST_ORIGIN;
const profile = process.env.RAGDOLL_TEST_PROFILE;
const preload = process.env.RAGDOLL_TEST_PRELOAD;
const renderer = process.env.RAGDOLL_TEST_RENDERER;
if (
  !origin ||
  new URL(origin).hostname !== "127.0.0.1" ||
  !profile ||
  !preload ||
  !renderer
) {
  throw new Error("Run browser tests through the test:browser script");
}
app.setPath("userData", profile);
// Linux CI runs fixture pages in an isolated disposable process under Xvfb.
if (process.platform === "linux") {
  app.commandLine.appendSwitch("enable-unsafe-swiftshader");
  app.commandLine.appendSwitch("use-angle", "swiftshader");
}
app.on("window-all-closed", () => {});

async function run(): Promise<void> {
  const startupDeadline = setTimeout(() => {
    console.error("Electron did not become ready within 30 seconds");
    app.exit(1);
  }, 30_000);
  await app.whenReady();
  clearTimeout(startupDeadline);
  await verifyWindowLoadRecovery();
  if (!preload) throw new Error("Missing test preload");
  if (!renderer) throw new Error("Missing production renderer");
  await verifyProductionRenderer(preload, renderer);
  await verifyProviderIpc(preload);
  await verifyChatIpc(preload);
  for (const page of browserPages) {
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
  console.log(
    `Verified ${browserPages.length} browser regressions in Electron.`,
  );
}
void run().then(
  () => app.exit(0),
  (error) => {
    console.error(error);
    app.exit(1);
  },
);
