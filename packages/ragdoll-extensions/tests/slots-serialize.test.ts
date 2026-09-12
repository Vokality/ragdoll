import { describe, expect, it } from "bun:test";
import { serializeSlotState } from "../src/slots.js";

describe("serializeSlotState", () => {
  it("strips list callbacks and sets capability flags", () => {
    const serialized = serializeSlotState({
      badge: 1,
      visible: true,
      panel: {
        type: "list",
        title: "Tasks",
        status: { label: "Ready", tone: "success" },
        progress: { current: 2, total: 3 },
        items: [
          {
            id: "a",
            label: "A",
            onClick: () => undefined,
            onToggle: () => undefined,
          },
          {
            id: "b",
            label: "B",
          },
        ],
        actions: [{ id: "new", label: "New", onClick: () => undefined }],
      },
    });

    expect(serialized.panel.status).toEqual({
      label: "Ready",
      tone: "success",
    });
    expect(serialized.panel.progress).toEqual({ current: 2, total: 3 });
    expect(serialized.panel.type).toBe("list");
    if (serialized.panel.type !== "list") throw new Error("expected list");
    expect(serialized.panel.items).toEqual([
      { id: "a", label: "A", canClick: true, canToggle: true },
      { id: "b", label: "B", canClick: false, canToggle: false },
    ]);
    expect(serialized.panel.actions).toEqual([{ id: "new", label: "New" }]);
    const firstItem = serialized.panel.items?.[0];
    if (!firstItem) throw new Error("expected first list item");
    expect("onClick" in (firstItem as unknown as Record<string, unknown>)).toBe(
      false,
    );
  });

  it("strips document footer callbacks", () => {
    const serialized = serializeSlotState({
      badge: 2,
      visible: true,
      panel: {
        type: "document",
        title: "Weekend plan",
        body: "Saturday: market\nSunday: rest",
        emptyMessage: "No note yet",
        status: { label: "1 note" },
        actions: [{ id: "back", label: "All notes", onClick: () => undefined }],
      },
    });

    expect(serialized.panel.type).toBe("document");
    if (serialized.panel.type !== "document") {
      throw new Error("expected document");
    }
    expect(serialized.panel.body).toBe("Saturday: market\nSunday: rest");
    expect(serialized.panel.emptyMessage).toBe("No note yet");
    expect(serialized.panel.status).toEqual({ label: "1 note" });
    expect(serialized.panel.actions).toEqual([
      { id: "back", label: "All notes" },
    ]);
    expect(
      "onClick" in
        ((serialized.panel.actions?.[0] ?? {}) as Record<string, unknown>),
    ).toBe(false);
  });

  it("strips grid cell callbacks and sets canClick", () => {
    const serialized = serializeSlotState({
      badge: null,
      visible: true,
      panel: {
        type: "grid",
        title: "Board",
        columns: 3,
        result: {
          title: "You win!",
          message: "Three in a row.",
          status: "success",
        },
        cells: [
          { id: "0-0", label: "X" },
          { id: "0-1", label: "", onClick: () => undefined },
          {
            id: "0-2",
            label: "O",
            disabled: true,
            onClick: () => undefined,
          },
        ],
        actions: [{ id: "reset", label: "Reset", onClick: () => undefined }],
      },
    });

    expect(serialized.panel.type).toBe("grid");
    if (serialized.panel.type !== "grid") throw new Error("expected grid");
    expect(serialized.panel.columns).toBe(3);
    expect(serialized.panel.result).toEqual({
      title: "You win!",
      message: "Three in a row.",
      status: "success",
    });
    expect(serialized.panel.cells).toEqual([
      { id: "0-0", label: "X", canClick: false },
      { id: "0-1", label: "", canClick: true },
      { id: "0-2", label: "O", disabled: true, canClick: false },
    ]);
    expect(serialized.panel.actions).toEqual([{ id: "reset", label: "Reset" }]);
    expect(
      "onClick" in (serialized.panel.cells[1] as Record<string, unknown>),
    ).toBe(false);
  });

  it("strips cards submit handler and sets canSubmit for front phase", () => {
    const serialized = serializeSlotState({
      badge: 2,
      visible: true,
      panel: {
        type: "cards",
        title: "Review",
        progress: { current: 1, total: 3, label: "Due" },
        card: {
          id: "card-1",
          attemptId: "attempt-1",
          front: "hola",
          back: "hello",
          face: "front",
        },
        answerInput: {
          id: "attempt-1",
          placeholder: "Type the answer",
          submitLabel: "Check",
          maxLength: 100,
        },
        actions: [{ id: "end", label: "End", onClick: () => undefined }],
        onSubmitAnswer: () => undefined,
      },
    });

    expect(serialized.panel.type).toBe("cards");
    if (serialized.panel.type !== "cards") throw new Error("expected cards");
    expect(serialized.panel.canSubmit).toBe(true);
    expect(serialized.panel.card).toEqual({
      id: "card-1",
      attemptId: "attempt-1",
      front: "hola",
      back: "hello",
      face: "front",
    });
    expect(serialized.panel.answerInput).toEqual({
      id: "attempt-1",
      placeholder: "Type the answer",
      submitLabel: "Check",
      maxLength: 100,
    });
    expect(serialized.panel.actions).toEqual([{ id: "end", label: "End" }]);
    expect(
      "onSubmitAnswer" in
        (serialized.panel as unknown as Record<string, unknown>),
    ).toBe(false);
  });

  it("disables canSubmit when answer input is disabled or mismatched", () => {
    const disabled = serializeSlotState({
      badge: null,
      visible: true,
      panel: {
        type: "cards",
        title: "Review",
        progress: { current: 1, total: 1 },
        card: {
          id: "card-1",
          attemptId: "attempt-1",
          front: "hola",
          back: "hello",
          face: "front",
        },
        answerInput: {
          id: "attempt-1",
          disabled: true,
        },
        onSubmitAnswer: () => undefined,
      },
    });
    expect(disabled.panel.type).toBe("cards");
    if (disabled.panel.type !== "cards") throw new Error("expected cards");
    expect(disabled.panel.canSubmit).toBe(false);

    const mismatched = serializeSlotState({
      badge: null,
      visible: true,
      panel: {
        type: "cards",
        title: "Review",
        progress: { current: 1, total: 1 },
        card: {
          id: "card-1",
          attemptId: "attempt-1",
          front: "hola",
          back: "hello",
          face: "front",
        },
        answerInput: {
          id: "stale-attempt",
        },
        onSubmitAnswer: () => undefined,
      },
    });
    expect(mismatched.panel.type).toBe("cards");
    if (mismatched.panel.type !== "cards") throw new Error("expected cards");
    expect(mismatched.panel.canSubmit).toBe(false);
  });

  it("serializes revealed cards without canSubmit", () => {
    const serialized = serializeSlotState({
      badge: null,
      visible: true,
      panel: {
        type: "cards",
        title: "Review",
        progress: { current: 2, total: 4 },
        card: {
          id: "card-2",
          attemptId: "attempt-2",
          front: "hola",
          back: "hello",
          face: "back",
        },
        result: {
          title: "Correct",
          message: "Nice work",
          status: "success",
        },
        actions: [
          {
            id: "attempt-2:easy",
            label: "Easy",
            onClick: () => undefined,
          },
        ],
      },
    });

    expect(serialized.panel.type).toBe("cards");
    if (serialized.panel.type !== "cards") throw new Error("expected cards");
    expect(serialized.panel.canSubmit).toBe(false);
    expect(serialized.panel.result).toEqual({
      title: "Correct",
      message: "Nice work",
      status: "success",
    });
    expect(serialized.panel.answerInput).toBeUndefined();
    expect(serialized.panel.actions).toEqual([
      { id: "attempt-2:easy", label: "Easy" },
    ]);
  });
});
