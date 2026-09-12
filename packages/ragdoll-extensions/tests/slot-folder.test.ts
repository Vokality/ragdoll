import { describe, expect, test } from "bun:test";
import { combineSlotBadges } from "../src/ui/combine-slot-badges.ts";

describe("combineSlotBadges", () => {
  test("sums numeric badges and ignores empty values", () => {
    expect(combineSlotBadges([3, 0, null, 2, undefined])).toBe(5);
  });

  test("keeps the first string badge when nothing is numeric", () => {
    expect(combineSlotBadges([null, "due", "later"])).toBe("due");
  });

  test("prefers a numeric total over a string badge", () => {
    expect(combineSlotBadges(["due", 4])).toBe(4);
  });
});
