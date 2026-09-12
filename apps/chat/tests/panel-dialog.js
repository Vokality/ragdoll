import React, { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SlotPanelBase } from "../../../packages/ragdoll-extensions/src/ui/slot-panel.tsx";
import { ModalShell } from "../src/components/modal-shell.tsx";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById("root"));
const opener = document.getElementById("opener");
const background = document.getElementById("background");
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
let closeCalls = 0;
const render = (isOpen) =>
  root.render(
    React.createElement(
      StrictMode,
      null,
      React.createElement(SlotPanelBase, {
        isOpen,
        onClose: () => {
          closeCalls++;
          render(false);
        },
        panel: {
          type: "list",
          title: "Test panel",
          items: [],
          actions: [{ id: "act", label: "Action", onClick() {} }],
        },
      }),
    ),
  );
try {
  opener.focus();
  await act(async () => render(true));
  const dialog = document.querySelector("dialog");
  check(dialog.matches(":modal"), "Panel must enter the browser modal layer");
  check(
    dialog.contains(document.activeElement),
    "Opening must move focus into panel",
  );
  background.focus();
  check(
    dialog.contains(document.activeElement),
    "Background must remain inert",
  );
  const nested = document.createElement("dialog");
  nested.innerHTML = "<button>Nested control</button>";
  dialog.append(nested);
  nested.showModal();
  nested.requestClose();
  check(
    dialog.open && closeCalls === 0,
    "Closing a nested dialog must not dismiss its panel",
  );
  nested.remove();
  await act(async () => dialog.requestClose());
  check(closeCalls === 1, "Native cancellation must notify the owner once");
  check(
    dialog.matches(":modal"),
    "Exit animation must retain modal focus ownership",
  );
  await act(async () => new Promise((resolve) => setTimeout(resolve, 350)));
  check(!document.querySelector("dialog"), "Closed dialog must unmount");
  check(
    document.activeElement === opener,
    "Closing must restore the opener focus",
  );
  await act(async () => render(true));
  check(
    document.querySelector("dialog").matches(":modal"),
    "Reopened panel must be modal",
  );
  await act(async () => root.render(null));
  check(
    document.activeElement === opener,
    "Unmount must release focus to opener",
  );
  await act(async () =>
    root.render(
      React.createElement(
        StrictMode,
        null,
        React.createElement(
          ModalShell,
          {
            title: "Settings",
            maxWidth: 400,
            onClose: () => root.render(null),
          },
          React.createElement("input", { "aria-label": "Setting" }),
        ),
      ),
    ),
  );
  check(
    document.querySelector("dialog").matches(":modal"),
    "Settings must be modal",
  );
  await act(async () =>
    document.querySelector('button[aria-label="Close Settings"]').click(),
  );
  check(
    document.activeElement === opener,
    "Settings close must restore opener focus",
  );
  await act(async () => root.unmount());
  document.getElementById("result").textContent =
    "PASS: panel and Settings focus, inert background, nested cancellation, animated close, reopen, and unmount";
} catch (error) {
  document.getElementById("result").textContent = `FAIL: ${error.message}`;
  console.error(error);
}
