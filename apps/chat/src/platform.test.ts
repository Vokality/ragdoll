import { expect, test } from "bun:test";
import { composerFocusShortcutLabel, isApplePlatform } from "./platform";

test("composer shortcut uses Ctrl on Linux and Windows and ⌘ on macOS", () => {
  expect(isApplePlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe(false);
  expect(isApplePlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe(
    false,
  );
  expect(
    isApplePlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"),
  ).toBe(true);
  expect(composerFocusShortcutLabel("Mozilla/5.0 (X11; Linux x86_64)")).toBe(
    "Ctrl+K",
  );
  expect(
    composerFocusShortcutLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"),
  ).toBe("Ctrl+K");
  expect(
    composerFocusShortcutLabel(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    ),
  ).toBe("⌘K");
});
