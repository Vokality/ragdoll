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
});
