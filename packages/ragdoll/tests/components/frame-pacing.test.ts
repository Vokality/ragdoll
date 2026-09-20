import { describe, it, expect } from "bun:test";
import { frameDeltaSeconds } from "../../src/components/frame-pacing";

describe("frameDeltaSeconds", () => {
  it("simulates every frame of a 60Hz display despite timestamp jitter", () => {
    let last = 0;
    let simulated = 0;
    for (let frame = 1; frame <= 120; frame++) {
      // Alternate a hair early and a hair late around 16.667ms.
      const now = frame * (1000 / 60) + (frame % 2 === 0 ? -0.3 : 0.3);
      const delta = frameDeltaSeconds(now, last);
      if (delta === null) continue;
      simulated++;
      last = now;
    }
    expect(simulated).toBe(120);
  });

  it("caps faster displays at roughly 60 simulated frames per second", () => {
    let last = 0;
    let simulated = 0;
    for (let frame = 1; frame <= 240; frame++) {
      const now = frame * (1000 / 120);
      if (frameDeltaSeconds(now, last) === null) continue;
      simulated++;
      last = now;
    }
    expect(simulated).toBe(120);
  });

  it("clamps long gaps such as a backgrounded tab", () => {
    expect(frameDeltaSeconds(5000, 0)).toBe(0.05);
  });
});
