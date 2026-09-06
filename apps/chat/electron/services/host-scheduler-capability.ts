import type {
  HostSchedulerCapability,
  HostSchedulerPriority,
  HostTimersCapability,
} from "@vokality/ragdoll-extensions";

const PRIORITY_ORDER: Record<HostSchedulerPriority, number> = {
  high: 0,
  normal: 1,
  low: 2,
};

interface ScheduledWork {
  task: () => Promise<void> | void;
  resolve: () => void;
  reject: (error: unknown) => void;
  priority: number;
}

/**
 * Cooperative scheduler backed by the host timer surface.
 * Same-tick work is batched, then run one-at-a-time in priority order.
 */
export function createHostSchedulerCapability(
  timers: HostTimersCapability,
): HostSchedulerCapability {
  const queue: ScheduledWork[] = [];
  let draining = false;

  const drain = (): void => {
    if (draining) return;
    draining = true;
    queueMicrotask(() => {
      const runNext = (): void => {
        const next = queue.shift();
        if (!next) {
          draining = false;
          return;
        }
        void Promise.resolve()
          .then(() => next.task())
          .then(next.resolve, next.reject)
          .finally(() => {
            timers.setTimeout(runNext, 0);
          });
      };
      runNext();
    });
  };

  return {
    schedule(task, options) {
      const delayMs = Math.max(0, options?.delayMs ?? 0);
      const priority = PRIORITY_ORDER[options?.priority ?? "normal"];

      return new Promise<void>((resolve, reject) => {
        const enqueue = () => {
          queue.push({ task, resolve, reject, priority });
          queue.sort((left, right) => left.priority - right.priority);
          drain();
        };
        if (delayMs === 0) {
          enqueue();
          return;
        }
        timers.setTimeout(enqueue, delayMs);
      });
    },
  };
}
