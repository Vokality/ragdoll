import { describe, it, expect } from "bun:test";
import {
  getTheme,
  getDefaultTheme,
  getAllThemes,
  registerTheme,
  hasTheme,
} from "../../src/themes/theme-registry";
import type { RagdollTheme } from "../../src/themes/types";

describe("Theme Registry", () => {
  describe("getTheme", () => {
    it("should get theme by ID", () => {
      const theme = getTheme("default");
      expect(theme).toBeDefined();
      expect(theme.id).toBe("default");
    });

    it("should get robot theme", () => {
      const theme = getTheme("robot");
      expect(theme.id).toBe("robot");
    });

    it("should get alien theme", () => {
      const theme = getTheme("alien");
      expect(theme.id).toBe("alien");
    });

    it("should get monochrome theme", () => {
      const theme = getTheme("monochrome");
      expect(theme.id).toBe("monochrome");
    });

    it("should reject an unknown theme", () => {
      expect(() => getTheme("nonexistent")).toThrow("Unknown theme");
    });
  });

  describe("getDefaultTheme", () => {
    it("should return default theme", () => {
      const theme = getDefaultTheme();
      expect(theme).toBeDefined();
      expect(theme.id).toBe("default");
    });
  });

  describe("getAllThemes", () => {
    it("should return all themes", () => {
      const themes = getAllThemes();
      expect(themes.length).toBeGreaterThan(0);
      expect(themes.some((t) => t.id === "default")).toBe(true);
    });

    it("should include all built-in themes", () => {
      const themes = getAllThemes();
      const ids = themes.map((t) => t.id);
      expect(ids).toContain("default");
      expect(ids).toContain("robot");
      expect(ids).toContain("alien");
      expect(ids).toContain("monochrome");
    });
  });

  describe("registerTheme", () => {
    it("should register custom theme", () => {
      const customTheme: RagdollTheme = {
        ...structuredClone(getDefaultTheme()),
        id: "test-theme",
        name: "Test Theme",
      };
      registerTheme(customTheme);
      const theme = getTheme("test-theme");
      expect(theme.id).toBe("test-theme");
    });

    it("should override existing theme", () => {
      const customTheme: RagdollTheme = {
        ...structuredClone(getDefaultTheme()),
        id: "default",
        name: "Custom Default",
      };
      const original = getTheme("default");
      try {
        registerTheme(customTheme);
        const theme = getTheme("default");
        expect(theme.name).toBe("Custom Default");
        expect(theme).toBe(customTheme);
      } finally {
        registerTheme(original);
      }
      expect(getTheme("default")).toBe(original);
    });
  });

  describe("hasTheme", () => {
    it("should return true for existing theme", () => {
      expect(hasTheme("default")).toBe(true);
      expect(hasTheme("robot")).toBe(true);
      expect(hasTheme("alien")).toBe(true);
      expect(hasTheme("monochrome")).toBe(true);
    });

    it("should return false for nonexistent theme", () => {
      expect(hasTheme("nonexistent")).toBe(false);
    });

    it("should return true for registered custom theme", () => {
      const customTheme: RagdollTheme = {
        ...structuredClone(getDefaultTheme()),
        id: "custom-test",
        name: "Custom Test",
      };
      registerTheme(customTheme);
      expect(hasTheme("custom-test")).toBe(true);
    });
  });

  describe("theme data structure validation", () => {
    it("should have valid theme structure", () => {
      const theme = getTheme("default");
      expect(theme.id).toBeDefined();
      expect(theme.name).toBeDefined();
      expect(theme.colors).toBeDefined();
      expect(theme.colors.skin).toBeDefined();
      expect(theme.colors.hair).toBeDefined();
      expect(theme.colors.eyes).toBeDefined();
      expect(theme.colors.lips).toBeDefined();
      expect(theme.colors.teeth).toBeDefined();
    });

    it("should have valid colors", () => {
      const theme = getTheme("default");
      expect(typeof theme.colors.skin.mid).toBe("string");
      expect(typeof theme.colors.hair.dark).toBe("string");
      expect(typeof theme.colors.eyes.iris).toBe("string");
      expect(typeof theme.colors.lips.upperDark).toBe("string");
      expect(typeof theme.colors.teeth).toBe("string");
    });
  });
});
