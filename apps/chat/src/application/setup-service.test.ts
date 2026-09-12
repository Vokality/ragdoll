import { expect, it } from "bun:test";
import { SetupService, type SetupGateway } from "./setup-service";

it("validates and saves the selected provider together, never changing selection on validation failure", async () => {
  const saved: unknown[] = [];
  let valid = false;
  const gateway: SetupGateway = {
    getModelProviders: async () => [],
    selectModelProvider: async () => ({ success: true }),
    clearApiKey: async () => ({ success: true }),
    openExternal: async () => ({ success: true }),
    validateApiKey: async (credential) => {
      expect(credential).toEqual({ provider: "grok", key: "xai-test" });
      return valid
        ? { valid: true }
        : { valid: false, error: "Invalid API key" };
    },
    setApiKey: async (credential) => {
      saved.push(credential);
      return { success: true };
    },
  };
  const setup = new SetupService(gateway);
  expect(await setup.configureApiKey("grok", "xai-test")).toEqual({
    success: false,
    error: "Invalid API key",
  });
  expect(saved).toEqual([]);
  valid = true;
  expect(await setup.configureApiKey("grok", "xai-test")).toEqual({
    success: true,
  });
  expect(saved).toEqual([{ provider: "grok", key: "xai-test" }]);
});
