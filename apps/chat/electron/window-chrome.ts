import type { BrowserWindowConstructorOptions } from "electron";

/** Caption-button glyphs on the Window Controls Overlay. Matches `--text-primary`. */
export const WINDOW_CHROME_SYMBOL_COLOR = "#eef4fb";

const TRAFFIC_LIGHTS = { x: 16, y: 16 } as const;

/**
 * Native chrome that reads as part of the Lumen shell.
 *
 * macOS keeps inset traffic lights. Windows and Linux hide the system title
 * bar and paint the Window Controls Overlay with the same surface as
 * `--bg-primary`, so the caption is not a light OS strip above the app.
 */
export function windowChromeOptions(
  platform: NodeJS.Platform,
  backgroundColor: string,
): Pick<
  BrowserWindowConstructorOptions,
  "titleBarStyle" | "titleBarOverlay" | "trafficLightPosition"
> {
  if (platform === "darwin") {
    return {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: TRAFFIC_LIGHTS,
    };
  }
  return {
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: backgroundColor,
      symbolColor: WINDOW_CHROME_SYMBOL_COLOR,
      height: 36,
    },
  };
}
