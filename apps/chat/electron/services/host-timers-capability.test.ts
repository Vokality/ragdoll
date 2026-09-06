import { expect, test } from "bun:test";
import { createHostTimersCapability } from "./host-timers-capability.js";

test("opaque timer handles cancel only timers owned by their capability", async () => {
  const first = createHostTimersCapability();
  const second = createHostTimersCapability();
  const fired = Promise.withResolvers<void>();
  const handle = first.setTimeout(() => fired.resolve(), 1);
  second.clearTimeout(handle);
  first.clearTimeout({});
  await fired.promise;
  first.clearTimeout(handle);
  let cancelledFired = false;
  const cancelled = first.setTimeout(() => {
    cancelledFired = true;
  }, 1);
  first.clearInterval(cancelled);
  await new Promise<void>((resolve) => first.setTimeout(resolve, 10));
  expect(cancelledFired).toBe(false);
});

test("interval cancellation stops future callbacks", async () => {
  const timers = createHostTimersCapability();
  const fired = Promise.withResolvers<void>();
  let count = 0;
  const handle = timers.setInterval(() => {
    count++;
    fired.resolve();
  }, 1);
  await fired.promise;
  timers.clearTimeout(handle);
  const stoppedAt = count;
  await new Promise<void>((resolve) => timers.setTimeout(resolve, 10));
  expect(count).toBe(stoppedAt);
});
