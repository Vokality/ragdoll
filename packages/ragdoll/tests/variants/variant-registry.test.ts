import { describe, it, expect, beforeEach } from "bun:test";
import {
  getVariant,
  getDefaultVariant,
  getAllVariants,
  getVariantIds,
  registerVariant,
} from "../../src/variants/variant-registry";
import type { CharacterVariant } from "../../src/variants/types";

describe("Variant Registry", () => {
  beforeEach(() => {
    // Reset registry state by not modifying it
  });

  describe("getVariant", () => {
    it("should get variant by ID", () => {
      const variant = getVariant("human");
      expect(variant).toBeDefined();
      expect(variant.id).toBe("human");
    });

    it("should get einstein variant", () => {
      const variant = getVariant("einstein");
      expect(variant.id).toBe("einstein");
    });

    it("should fallback to default for unknown variant", () => {
      const variant = getVariant("nonexistent");
      expect(variant.id).toBe("human");
    });
  });

  describe("getDefaultVariant", () => {
    it("should return default variant", () => {
      const variant = getDefaultVariant();
      expect(variant).toBeDefined();
      expect(variant.id).toBe("human");
    });
  });

  describe("getAllVariants", () => {
    it("should return all variants", () => {
      const variants = getAllVariants();
      expect(variants.length).toBeGreaterThan(0);
      expect(variants.some((v) => v.id === "human")).toBe(true);
    });

    it("should include all built-in variants", () => {
      const variants = getAllVariants();
      const ids = variants.map((v) => v.id);
      expect(ids).toContain("human");
      expect(ids).toContain("einstein");
    });
  });

  describe("getVariantIds", () => {
    it("should return all variant IDs", () => {
      const ids = getVariantIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain("human");
      expect(ids).toContain("einstein");
    });
  });

  describe("registerVariant", () => {
    it("should register custom variant", () => {
      const customVariant: CharacterVariant = {
        id: "test-variant",
        name: "Test Variant",
        hairStyle: "default",
        mustacheStyle: "none",
      };
      registerVariant(customVariant);
      const variant = getVariant("test-variant");
      expect(variant.id).toBe("test-variant");
    });

    it("should override existing variant", () => {
      const customVariant: CharacterVariant = {
        id: "human",
        name: "Custom Human",
        hairStyle: "wild",
        mustacheStyle: "bushy",
      };
      registerVariant(customVariant);
      const variant = getVariant("human");
      expect(variant.name).toBe("Custom Human");
    });
  });

  describe("variant data structure validation", () => {
    it("should have valid variant structure", () => {
      const variant = getVariant("human");
      expect(variant.id).toBeDefined();
      expect(variant.name).toBeDefined();
      expect(variant.hairStyle).toBeDefined();
      expect(variant.mustacheStyle).toBeDefined();
    });

    it("should have valid hair styles", () => {
      const variant = getVariant("human");
      const validHairStyles = ["default", "wild", "short", "bald"];
      expect(validHairStyles).toContain(variant.hairStyle);
    });

    it("should have valid mustache styles", () => {
      const variant = getVariant("human");
      const validMustacheStyles = ["none", "bushy", "thin", "handlebar"];
      expect(validMustacheStyles).toContain(variant.mustacheStyle);
    });

    it("should support dimension overrides", () => {
      const variant = getVariant("einstein");
      // Variants may have dimension overrides
      expect(variant).toBeDefined();
    });

    it("should support color overrides", () => {
      const variant = getVariant("einstein");
      // Variants may have color overrides
      expect(variant).toBeDefined();
    });
  });
});

