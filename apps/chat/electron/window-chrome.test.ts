import { describe, expect, test } from "bun:test";
import {
  WINDOW_CHROME_SYMBOL_COLOR,
  windowChromeOptions,
} from "./window-chrome.js";

describe("windowChromeOptions", () => {
  test("keeps inset traffic lights on macOS", () => {
    expect(windowChromeOptions("darwin", "#0a101f")).toEqual({
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 16, y: 16 },
    });
  });

  test("paints the caption overlay with the app surface on Windows and Linux", () => {
    const expected = {
      titleBarStyle: "hidden" as const,
      titleBarOverlay: {
        color: "#0a101f",
        symbolColor: WINDOW_CHROME_SYMBOL_COLOR,
        height: 36,
      },
    };
    expect(windowChromeOptions("linux", "#0a101f")).toEqual(expected);
    expect(windowChromeOptions("win32", "#0a101f")).toEqual(expected);
  });
});
