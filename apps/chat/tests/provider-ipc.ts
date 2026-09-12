import assert from "node:assert/strict";
import { BrowserWindow, ipcMain } from "electron";
import { ApiKeyService } from "../electron/services/api-key-service.js";
import { createModelProviders } from "../electron/services/model-provider.js";
import { createInMemoryStorageRepository } from "../electron/test-support/in-memory-storage-repository.js";
import { IpcRegistrar } from "../electron/ipc/registrar.js";
import { registerAuthIpc } from "../electron/ipc/register-auth-ipc.js";

export async function verifyProviderIpc(preload: string): Promise<void> {
  const storage = createInMemoryStorageRepository();
  const providers = new Map(createModelProviders());
  const validations: string[] = [];
  for (const [id, provider] of providers) {
    providers.set(id, {
      ...provider,
      validateKey: async (key) => {
        validations.push(`${id}:${key}`);
      },
    });
  }
  const service = new ApiKeyService(
    storage,
    {
      isEncryptionAvailable: () => true,
      encryptString: (value) => Buffer.from(value),
      decryptString: (value) => value.toString(),
    },
    providers,
  );
  const window = new BrowserWindow({
    show: false,
    webPreferences: { preload, contextIsolation: true, sandbox: true },
  });
  const registrar = new IpcRegistrar(
    ipcMain,
    (event) => event.sender === window.webContents,
  );
  registerAuthIpc(registrar, service);
  try {
    await window.loadURL(
      "data:text/html,<title>Provider IPC regression</title>",
    );
    const result: unknown = await window.webContents
      .executeJavaScript(`(async () => {
      const api = window.electronAPI;
      const checks = [];
      const key = "xai-test-key-123456789012345";
      checks.push((await api.getModelProviders()).length === 2);
      checks.push((await api.validateApiKey({provider:"grok",key})).valid);
      checks.push((await api.setApiKey({provider:"grok",key})).success);
      checks.push(await api.hasApiKey());
      const providers = await api.getModelProviders();
      checks.push(providers.find(item => item.id === "grok").selected);
      checks.push(!JSON.stringify(providers).includes(key));
      for (const invalid of [{provider:"unknown",key}, {provider:"grok",key:42}, {provider:"grok",key,baseURL:"https://example.com"}]) {
        try { await api.setApiKey(invalid); checks.push(false); } catch { checks.push(true); }
      }
      try { await api.selectModelProvider("unknown"); checks.push(false); } catch { checks.push(true); }
      checks.push((await api.selectModelProvider("grok")).success);
      checks.push((await api.clearApiKey("grok")).success);
      checks.push(!(await api.hasApiKey()));
      return checks;
    })()`);
    assert(
      Array.isArray(result) &&
        result.length === 13 &&
        result.every((check) => check === true),
      "Provider IPC assertions failed",
    );
    assert.deepEqual(validations, ["grok:xai-test-key-123456789012345"]);
    assert.deepEqual(storage.snapshot().providerKeysEncrypted, {});
    console.log(
      "PASS: real preload and provider IPC validate credentials, selection, removal and unknown inputs",
    );
  } finally {
    await registrar.dispose();
    window.destroy();
  }
}
