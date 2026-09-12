import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { SlotPanelBase } from "../../../packages/ragdoll-extensions/src/ui/slot-panel.tsx";
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const root = createRoot(document.getElementById("root"));
const errors = [];
const unhandled = (event) => {
  errors.push(event.reason);
  event.preventDefault();
};
window.addEventListener("unhandledrejection", unhandled);
const check = (condition, message) => {
  if (!condition) throw new Error(message);
};
const render = (panel) =>
  act(async () =>
    root.render(
      React.createElement(SlotPanelBase, {
        isOpen: true,
        onClose: () => {},
        panel,
      }),
    ),
  );
try {
  let calls = 0;
  const pending = Promise.withResolvers();
  await render({
    type: "list",
    title: "Tasks",
    items: [],
    actions: [
      {
        id: "run",
        label: "Run",
        onClick: () => {
          calls++;
          return calls === 1 ? pending.promise : Promise.resolve();
        },
      },
    ],
  });
  const button = document.querySelector(".slot-panel-action");
  await act(async () => {
    button.click();
    button.click();
  });
  check(calls === 1, "Duplicate action ran");
  await act(async () => {
    pending.reject(new Error("Action failed"));
  });
  check(
    document.querySelector('[role="alert"]').textContent === "Action failed",
    "Action failure was not shown",
  );
  await act(async () => button.click());
  check(calls === 2 && !button.disabled, "Retry was not available");
  const fail = async () => {
    throw new Error("Control failed");
  };
  await render({
    type: "list",
    title: "List",
    sections: [
      {
        id: "section",
        title: "Section",
        items: [
          {
            id: "item",
            label: "Item",
            checkable: true,
            checked: false,
            onClick: fail,
            onToggle: fail,
          },
        ],
        actions: [
          {
            id: "section-action",
            label: "Section action",
            onClick: fail,
          },
        ],
      },
    ],
  });
  for (const selector of [
    ".slot-panel-checkbox",
    ".slot-panel-item-clickable",
    ".slot-panel-section-action",
  ]) {
    const control = document.querySelector(selector);
    check(control?.tagName === "BUTTON", "Control is not keyboard accessible");
    await act(async () => control.click());
    check(
      [...document.querySelectorAll('[role="alert"]')].some(
        (node) => node.textContent === "Control failed",
      ),
      "Control error was not shown",
    );
    check(!control.disabled, "Control stayed disabled after failure");
  }
  await render({
    type: "grid",
    title: "Grid",
    columns: 1,
    cells: [{ id: "cell", label: "Cell", onClick: fail }],
  });
  await act(async () =>
    document.querySelector(".slot-panel-grid-cell").click(),
  );
  check(
    document.querySelector('[role="alert"]').textContent === "Control failed",
    "Grid failure was not shown",
  );
  let submitted = 0;
  await render({
    type: "cards",
    title: "Review",
    progress: { current: 1, total: 1 },
    card: {
      id: "one",
      attemptId: "attempt",
      front: "hola",
      back: "hello",
      face: "front",
    },
    answerInput: { id: "answer", placeholder: "Answer" },
    onSubmitAnswer: async () => {
      submitted++;
      throw new Error("Answer failed");
    },
    actions: [],
  });
  const input = document.querySelector("input");
  await act(async () => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    ).set.call(input, "hello");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () =>
    document
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
  check(submitted === 1, "Answer was not submitted");
  check(
    document.querySelector('[role="alert"]').textContent === "Answer failed",
    "Answer failure was not shown",
  );
  check(!input.disabled, "Answer remained disabled after failure");
  check(errors.length === 0, "Unhandled promise rejection escaped");
  document.getElementById("result").textContent =
    "PASS: duplicate action, retries, list controls, section actions, grid cells, and answers";
} catch (error) {
  document.getElementById("result").textContent = `FAIL: ${error.message}`;
  throw error;
} finally {
  await act(async () => root.unmount());
  window.removeEventListener("unhandledrejection", unhandled);
}
