import React, { act, useLayoutEffect } from "react";
import { createRoot } from "react-dom/client";
import { useExtensionConfiguration } from "../src/hooks/use-extension-configuration.ts";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const configuration = (value) => ({
  schema: { name: { type: "string", label: "Name" } },
  status: {
    isConfigured: true,
    missingFields: [],
    values: { name: value },
  },
  values: { name: value },
});
let saveRequest;
let api;
let saveCalls = 0;
let connected;
const service = {
  loadConfiguration: async (id) => configuration(id),
  getOAuthState: async () => null,
  saveConfiguration: () => {
    saveCalls++;
    return saveRequest.promise;
  },
  onOAuthConnected: (callback) => {
    connected = callback;
    return () => {};
  },
  onOAuthFailed: () => () => {},
};
function Sample({ id }) {
  const state = useExtensionConfiguration(service, {
    extensionId: id,
    hasConfig: true,
    hasOAuth: true,
    isOpen: true,
  });
  useLayoutEffect(() => {
    api = state;
  });
  return null;
}
const root = createRoot(document.getElementById("root"));
const render = (id) =>
  act(async () => root.render(React.createElement(Sample, { id })));
const check = (value, message) => {
  if (!value) throw new Error(message);
};
try {
  await render("first");
  await act(async () => api.changeValue("name", "submitted"));
  saveRequest = Promise.withResolvers();
  let pending;
  await act(async () => {
    pending = api.save();
    void api.save();
  });
  check(saveCalls === 1, "Duplicate save was sent");
  await act(async () => api.changeValue("name", "newer edit"));
  await act(async () => {
    saveRequest.resolve({
      configuration: configuration("submitted"),
      oauth: null,
    });
    await pending;
  });
  check(api.values.name === "newer edit", "Save erased newer edit");
  saveRequest = Promise.withResolvers();
  await act(async () => {
    pending = api.save();
  });
  await render("second");
  await act(async () => {
    saveRequest.resolve({
      configuration: configuration("old response"),
      oauth: null,
    });
    await pending;
  });
  check(api.values.name === "second", "Old save changed another extension");
  check(!api.saving, "Saving indicator was left active");
  service.getOAuthState = async () => {
    throw new Error("OAuth refresh failed");
  };
  await act(async () => connected({ extensionId: "second" }));
  check(
    api.error === "OAuth refresh failed",
    "OAuth refresh failure escaped the hook",
  );
  document.getElementById("result").textContent =
    "PASS: duplicate save, edits during save, extension switch, and OAuth failure";
} catch (error) {
  document.getElementById("result").textContent = `FAIL: ${error.message}`;
  throw error;
} finally {
  await act(async () => root.unmount());
}
