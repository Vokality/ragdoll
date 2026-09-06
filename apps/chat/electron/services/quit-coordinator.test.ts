import { expect, it } from "bun:test";
import { QuitCoordinator } from "./quit-coordinator.js";

it("holds repeated quit requests until cleanup completes, then permits the final quit", async () => {
  let finishCleanup = () => {};
  const cleanup = new Promise<void>((resolve) => {
    finishCleanup = resolve;
  });
  let cleanupCalls = 0;
  let prevented = 0;
  let quitCalls = 0;
  const coordinator = new QuitCoordinator(
    () => {
      cleanupCalls += 1;
      return cleanup;
    },
    () => {
      quitCalls += 1;
      coordinator.beforeQuit(event);
    },
    () => {
      throw new Error("Unexpected cleanup error");
    },
  );
  const event = {
    preventDefault: () => {
      prevented += 1;
    },
  };
  coordinator.beforeQuit(event);
  coordinator.beforeQuit(event);
  expect(coordinator.isQuitting).toBe(true);
  expect(cleanupCalls).toBe(1);
  expect(quitCalls).toBe(0);
  expect(prevented).toBe(2);
  finishCleanup();
  await cleanup;
  expect(quitCalls).toBe(1);
  expect(prevented).toBe(2);
});

it("reports a failed cleanup and still permits the application to quit", async () => {
  const failure = new Error("Cleanup failed");
  const errors: unknown[] = [];
  let finishQuit = () => {};
  const quit = new Promise<void>((resolve) => {
    finishQuit = resolve;
  });
  const coordinator = new QuitCoordinator(
    async () => {
      throw failure;
    },
    finishQuit,
    (error) => errors.push(error),
  );
  coordinator.beforeQuit({ preventDefault() {} });
  await quit;
  expect(errors).toEqual([failure]);
  let prevented = false;
  coordinator.beforeQuit({
    preventDefault() {
      prevented = true;
    },
  });
  expect(prevented).toBe(false);
});
