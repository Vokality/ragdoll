import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { app } from "electron";
import { createMainProcessConfig } from "../electron/main-process-config.js";
import { WindowService } from "../electron/services/window-service.js";
import { RendererEventService } from "../electron/services/renderer-event-service.js";
import { ExternalNavigationService } from "../electron/services/external-navigation-service.js";

export async function verifyWindowLoadRecovery(): Promise<void> {
  const directory = await mkdtemp(
    join(app.getPath("userData"), "window-test-"),
  );
  const config = createMainProcessConfig(app, directory);
  config.isDevelopment = false;
  config.rendererHtmlPath = join(directory, "renderer.html");
  config.preloadPath = join(directory, "preload.cjs");
  await writeFile(config.preloadPath, "");
  const events = new RendererEventService();
  const service = new WindowService(
    config,
    new ExternalNavigationService(async () => {}),
    events,
  );
  try {
    const first = service.create();
    const second = service.create();
    await Promise.all([
      assert.rejects(first, /ERR_FILE_NOT_FOUND/),
      assert.rejects(second, /ERR_FILE_NOT_FOUND/),
    ]);
    assert.equal(
      first,
      second,
      "Concurrent callers did not share window loading",
    );
    assert.equal(
      service.hasWindow(),
      false,
      "Failed load retained a blank window",
    );
    events.slotsChanged();
    await writeFile(
      config.rendererHtmlPath,
      "<!doctype html><title>Recovered window</title><p>Ready</p>",
    );
    const recovered = await service.create();
    try {
      assert.equal(service.hasWindow(), true);
      assert.equal(recovered.webContents.getTitle(), "Recovered window");
      assert.equal(
        await service.create(),
        recovered,
        "Live window was duplicated",
      );
    } finally {
      recovered.destroy();
    }
    assert.equal(service.hasWindow(), false);
    console.log(
      "PASS: failed window load releases ownership and subsequent creation recovers",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}
