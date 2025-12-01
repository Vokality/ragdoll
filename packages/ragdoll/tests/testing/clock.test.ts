import { describe, it, expect, beforeEach } from "bun:test";
import { MockClock, SystemClock } from "../../src/testing/clock";

describe("MockClock", () => {
  let clock: MockClock;

  beforeEach(() => {
    clock = new MockClock();
  });

  describe("time tracking", () => {
    it("should start at time 0", () => {
      expect(clock.now()).toBe(0);
    });

    it("should advance time", () => {
      clock.advance(1000);
      expect(clock.now()).toBe(1000);
    });

    it("should advance time multiple times", () => {
      clock.advance(500);
      clock.advance(300);
      expect(clock.now()).toBe(800);
    });

    it("should set time directly", () => {
      clock.setTime(5000);
      expect(clock.now()).toBe(5000);
    });

    it("should reset to time 0", () => {
      clock.advance(1000);
      clock.reset();
      expect(clock.now()).toBe(0);
    });
  });

  describe("setTimeout execution", () => {
    it("should execute setTimeout callback after delay", () => {
      let executed = false;
      clock.setTimeout(() => {
        executed = true;
      }, 1000);
      expect(executed).toBe(false);
      clock.advance(1000);
      expect(executed).toBe(true);
    });

    it("should execute callbacks in order", () => {
      const order: number[] = [];
      clock.setTimeout(() => {
        order.push(1);
      }, 1000);
      clock.setTimeout(() => {
        order.push(2);
      }, 500);
      clock.advance(1500);
      expect(order).toEqual([2, 1]);
    });

    it("should not execute callback before delay", () => {
      let executed = false;
      clock.setTimeout(() => {
        executed = true;
      }, 1000);
      clock.advance(500);
      expect(executed).toBe(false);
    });

    it("should execute callback exactly at delay time", () => {
      let executed = false;
      clock.setTimeout(() => {
        executed = true;
      }, 1000);
      clock.advance(999);
      expect(executed).toBe(false);
      clock.advance(1);
      expect(executed).toBe(true);
    });
  });

  describe("setInterval execution", () => {
    it("should execute setInterval callback repeatedly", () => {
      let count = 0;
      clock.setInterval(() => {
        count++;
      }, 1000);
      clock.advance(3500);
      expect(count).toBe(3);
    });

    it("should execute at correct intervals", () => {
      const times: number[] = [];
      clock.setInterval(() => {
        times.push(clock.now());
      }, 1000);
      clock.advance(5000);
      expect(times.length).toBe(5);
      expect(times[0]).toBe(1000);
      expect(times[1]).toBe(2000);
      expect(times[2]).toBe(3000);
    });
  });

  describe("clearTimeout/clearInterval", () => {
    it("should clear setTimeout", () => {
      let executed = false;
      const id = clock.setTimeout(() => {
        executed = true;
      }, 1000);
      clock.clearTimeout(id);
      clock.advance(1000);
      expect(executed).toBe(false);
    });

    it("should clear setInterval", () => {
      let count = 0;
      const id = clock.setInterval(() => {
        count++;
      }, 1000);
      clock.advance(2000);
      clock.clearInterval(id);
      clock.advance(2000);
      expect(count).toBe(2);
    });
  });

  describe("multiple timers", () => {
    it("should handle multiple setTimeout calls", () => {
      let count = 0;
      clock.setTimeout(() => {
        count++;
      }, 1000);
      clock.setTimeout(() => {
        count++;
      }, 2000);
      clock.setTimeout(() => {
        count++;
      }, 3000);
      clock.advance(3500);
      expect(count).toBe(3);
    });

    it("should handle multiple setInterval calls", () => {
      let count1 = 0;
      let count2 = 0;
      clock.setInterval(() => {
        count1++;
      }, 1000);
      clock.setInterval(() => {
        count2++;
      }, 500);
      clock.advance(2000);
      expect(count1).toBe(2);
      expect(count2).toBe(4);
    });

    it("should handle mix of setTimeout and setInterval", () => {
      let timeoutCount = 0;
      let intervalCount = 0;
      clock.setTimeout(() => {
        timeoutCount++;
      }, 500);
      clock.setInterval(() => {
        intervalCount++;
      }, 1000);
      clock.advance(2500);
      expect(timeoutCount).toBe(1);
      expect(intervalCount).toBe(2);
    });
  });

  describe("timer ordering", () => {
    it("should execute timers in correct order", () => {
      const order: number[] = [];
      clock.setTimeout(() => {
        order.push(1);
      }, 3000);
      clock.setTimeout(() => {
        order.push(2);
      }, 1000);
      clock.setTimeout(() => {
        order.push(3);
      }, 2000);
      clock.advance(3500);
      expect(order).toEqual([2, 3, 1]);
    });

    it("should handle timers scheduled at same time", () => {
      const order: number[] = [];
      clock.setTimeout(() => {
        order.push(1);
      }, 1000);
      clock.setTimeout(() => {
        order.push(2);
      }, 1000);
      clock.advance(1500);
      expect(order.length).toBe(2);
      expect(order).toContain(1);
      expect(order).toContain(2);
    });
  });

  describe("reset", () => {
    it("should clear all scheduled timers", () => {
      let executed = false;
      clock.setTimeout(() => {
        executed = true;
      }, 1000);
      clock.reset();
      clock.advance(1000);
      expect(executed).toBe(false);
    });

    it("should reset time to 0", () => {
      clock.advance(5000);
      clock.reset();
      expect(clock.now()).toBe(0);
    });
  });
});

describe("SystemClock", () => {
  let clock: SystemClock;

  beforeEach(() => {
    clock = new SystemClock();
  });

  describe("time tracking", () => {
    it("should return current system time", () => {
      const time1 = clock.now();
      const time2 = Date.now();
      // Should be close (within 100ms)
      expect(Math.abs(time1 - time2)).toBeLessThan(100);
    });
  });

  describe("setTimeout", () => {
    it("should schedule setTimeout", () => {
      let executed = false;
      const id = clock.setTimeout(() => {
        executed = true;
      }, 10);
      // Wait a bit for execution
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(executed).toBe(true);
          clock.clearTimeout(id);
          resolve();
        }, 50);
      });
    });
  });

  describe("setInterval", () => {
    it("should schedule setInterval", () => {
      let count = 0;
      const id = clock.setInterval(() => {
        count++;
      }, 10);
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(count).toBeGreaterThan(0);
          clock.clearInterval(id);
          resolve();
        }, 50);
      });
    });
  });
});

