import { describe, expect, it } from "bun:test";
import { createHostTimersCapability } from "./host-timers-capability.js";
import { createHostSchedulerCapability } from "./host-scheduler-capability.js";

describe("createHostSchedulerCapability", () => {
  it("runs high-priority work before low-priority work queued at the same time", async () => {
    const scheduler = createHostSchedulerCapability(
      createHostTimersCapability(),
    );
    const order: string[] = [];

    const low = scheduler.schedule(
      () => {
        order.push("low");
      },
      { priority: "low" },
    );
    const high = scheduler.schedule(
      () => {
        order.push("high");
      },
      { priority: "high" },
    );

    await Promise.all([low, high]);
    expect(order).toEqual(["high", "low"]);
  });

  it("honors delayMs before enqueueing work", async () => {
    const scheduler = createHostSchedulerCapability(
      createHostTimersCapability(),
    );
    const order: string[] = [];

    const delayed = scheduler.schedule(
      () => {
        order.push("delayed");
      },
      { delayMs: 20, priority: "high" },
    );
    const immediate = scheduler.schedule(() => {
      order.push("immediate");
    });

    await Promise.all([delayed, immediate]);
    expect(order).toEqual(["immediate", "delayed"]);
  });
});
